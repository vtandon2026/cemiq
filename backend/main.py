"""
main.py — CemIQ FastAPI application entry point.

Run with:
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cemiq")

# ── Pre-load all datasets at import time in a thread pool ─────────────────────
# This runs BEFORE the server starts accepting requests so:
# 1. Startup is still fast (non-blocking to uvicorn)
# 2. First API requests are fast (data already cached)

_datasets_ready: bool = False

async def _preload_all():
    """Load all Excel files into cache concurrently."""
    global _datasets_ready
    from services.flat_file_loader     import get_flat_file_df
    from services.profit_pool_loader   import get_profit_pool_df
    from services.geomap_loader        import get_geomap_df
    from services.global_cement_loader import get_global_cement_df
    from services.stock_price_loader   import get_stock_prices_df
    from services.ciq_loader           import get_ciq_long_df

    loaders = [
        ("CIQ Financials",  get_ciq_long_df),
        ("Flat file",       get_flat_file_df),
        ("Profit Pool",     get_profit_pool_df),
        ("GeoMap",          get_geomap_df),
        ("Global Cement",   get_global_cement_df),
        ("Stock Prices",    get_stock_prices_df),
    ]

    async def _warm(name: str, fn):
        try:
            await asyncio.to_thread(fn)
            logger.info(f"✓ {name} ready")
        except Exception as e:
            logger.warning(f"✗ {name} failed: {e}")

    logger.info("🚀 Pre-loading datasets in background...")
    await asyncio.gather(*[_warm(n, f) for n, f in loaders], return_exceptions=True)
    _datasets_ready = True
    logger.info("✅ All datasets loaded — full speed ahead!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_preload_all())
    try:
        yield
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass


app = FastAPI(
    title="CemIQ API",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
from starlette.middleware.gzip import GZipMiddleware
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ── Routers ───────────────────────────────────────────────────────────────────
from routers import data, export, chat, deck, exec_summary

app.include_router(data.router,         prefix="/data")
app.include_router(export.router,       prefix="/export")
app.include_router(chat.router,         prefix="/chat")
app.include_router(deck.router,         prefix="/deck")
app.include_router(exec_summary.router, prefix="/exec-summary")


@app.get("/health")
def health():
    from services.cache_utils import cache_info
    return {
        "status":          "ok",
        "datasets_ready":  _datasets_ready,
        "disk_cache":      cache_info(),
    }


@app.delete("/cache")
def clear_data_cache():
    """Clear the disk pickle cache — forces Excel re-parse on next request."""
    from services.cache_utils import clear_cache
    from routers.data import clear_chart_cache
    from routers.deck import clear_in_memory_deck_cache
    deleted = clear_cache()
    # Also clear lru_cache on all loaders so they re-read from disk
    from services import flat_file_loader, ciq_loader, profit_pool_loader
    from services import geomap_loader, stock_price_loader, global_cement_loader
    for mod in (flat_file_loader, ciq_loader, profit_pool_loader,
                geomap_loader, stock_price_loader, global_cement_loader):
        for attr in dir(mod):
            fn = getattr(mod, attr)
            if callable(fn) and hasattr(fn, "cache_clear"):
                fn.cache_clear()
    clear_chart_cache()
    clear_in_memory_deck_cache()
    return {"cleared_pkl_files": deleted, "lru_caches": "reset", "response_caches": "reset"}


@app.get("/")
def root():
    return {"message": "CemIQ API", "docs": "/docs"}
