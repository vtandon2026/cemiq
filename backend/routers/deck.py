"""
routers/deck.py
POST /deck/build  — builds the full PPTX deck and returns it as a file download.
Wraps deck_builder/builder.py unchanged.
"""
from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models.deck import DeckBuildRequest
from services.cache_utils import ResponseCache

router = APIRouter()

# ── In-memory deck cache ──────────────────────────────────────────────────────
# Key: (country, company, year, comparison_fingerprint)
# Value: (pptx_bytes, filename)
_deck_cache = ResponseCache(maxsize=24, ttl_seconds=3600)


def _cache_key(req: DeckBuildRequest) -> str:
    """Stable cache key from request parameters."""
    return ResponseCache.make_key("deck_build", req.model_dump(mode="json"))


def clear_in_memory_deck_cache() -> None:
    _deck_cache.clear()


@router.post("/build")
def build_deck(req: DeckBuildRequest):
    """
    Build a multi-slide PPTX deck.
    Returns the PPTX file as a streaming download.
    """
    # ── Cache hit? ────────────────────────────────────────────────────────
    cache_hit = _deck_cache.get(_cache_key(req))
    if cache_hit:
        pptx_bytes, filename = cache_hit
        print(f"[DECK] Cache hit for {req.country}/{req.company}/{req.year}", flush=True)
        return StreamingResponse(
            io.BytesIO(pptx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    try:
        from services.flat_file_loader import get_flat_file_df
        from services.profit_pool_loader import get_profit_pool_df
        from services.ciq_loader import get_available_years, get_ciq_long_df, get_ciq_metrics_df_for_year
        from core.config import settings

        # ── Load DataFrames ────────────────────────────────────────────────
        df_flat        = get_flat_file_df()
        df_profit_pool = get_profit_pool_df()

        # ── Build ComparisonSlideRequest if KPI slides requested ───────────
        comparison_request = None
        if req.comparison_request is not None:
            cr = req.comparison_request

            # Import the deck_builder types from services/deck_builder/
            from services.deck_builder.slides.slide_06_company_comparison import (
                ComparisonSlideRequest,
                KpiSelection,
            )

            long_df = get_ciq_long_df()
            year    = cr.year

            # Build wide_df for point-in-time bar charts
            # Fall back to latest available year if requested year has no data
            wide_df = None
            needs_bar = any(
                s.chart_mode in ("point_in_time", "both")
                for s in cr.kpi_selections
            )
            if needs_bar:
                wide_df = get_ciq_metrics_df_for_year(year)
                if wide_df is None or wide_df.empty:
                    # Try latest available year
                    avail_years = get_available_years(long_df)
                    fallback_year = max((y for y in avail_years if y <= year), default=None)
                    if fallback_year and fallback_year != year:
                        print(f"[DECK] No wide_df for {year}, using {fallback_year}", flush=True)
                        wide_df = get_ciq_metrics_df_for_year(fallback_year)
                if wide_df is not None and not wide_df.empty:
                    print(f"[DECK] wide_df built: {wide_df.shape}", flush=True)

            kpi_selections = [
                KpiSelection(kpi_key=s.kpi_key, chart_mode=s.chart_mode)
                for s in cr.kpi_selections
            ]

            comparison_request = ComparisonSlideRequest(
                base_company=cr.base_company,
                peer_companies=cr.peer_companies,
                kpi_selections=kpi_selections,
                year=year,
                wide_df=wide_df,
                long_df=long_df,
                bar_template_path=str(settings.THINKCELL_TEMPLATE_BAR),
                line_template_path=str(settings.THINKCELL_TEMPLATE_GROWTH_OLD),
                country=cr.country,
                year_range_start=cr.year_range_start,
            )

        # ── Build deck ─────────────────────────────────────────────────────
        from services.deck_builder.builder import DeckRequest, build_deck as _build_deck

        deck_req = DeckRequest(
            country=req.country,
            company=req.company,
            year=req.year,
            df_flat=df_flat,
            df_profit_pool=df_profit_pool,
            comparison_request=comparison_request,
            tc_server_url=str(settings.THINKCELL_SERVER_URL),
            tc_growth_template_s2=str(settings.THINKCELL_TEMPLATE_GROWTH_S2),
            tc_growth_template_s3=str(settings.THINKCELL_TEMPLATE_GROWTH_S3),
            tc_growth_template_s4=str(settings.THINKCELL_TEMPLATE_GROWTH_S4),
            tc_category_template=str(settings.THINKCELL_TEMPLATE_CATEGORY),
        )

        prs  = _build_deck(deck_req)
        buf  = io.BytesIO()
        prs.save(buf)
        pptx_bytes = buf.getvalue()

        # ── Filename ───────────────────────────────────────────────────────
        parts    = [p for p in (req.country, req.company) if p]
        filename = ("_".join(parts) + "_Deck" if parts else "CemIQ_Deck") + ".pptx"

        # Store in cache
        _deck_cache.set(_cache_key(req), (pptx_bytes, filename))
        print(f"[DECK] Cached ({len(pptx_bytes):,} bytes)", flush=True)

        return StreamingResponse(
            io.BytesIO(pptx_bytes),
            media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[DECK BUILD ERROR]\n{tb}", flush=True)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n\n{tb}")


@router.delete("/cache")
def clear_deck_cache():
    """Clear the in-memory deck cache (e.g. after data refresh)."""
    clear_in_memory_deck_cache()
    return {"cleared": True}


@router.get("/meta")
def deck_meta():
    """
    Returns metadata needed by the Deck Builder UI:
    countries, companies (from stock universe), available years.
    """
    try:
        from services.stock_price_loader import (
            get_stock_prices_df,
            get_stock_years,
            get_stock_countries,
            get_stock_companies,
        )
        df   = get_stock_prices_df()
        return {
            "years":     get_stock_years(df),
            "countries": get_stock_countries(df),
            "companies": get_stock_companies(df),
        }
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        print(f"[DECK BUILD ERROR]\n{tb}", flush=True)
        raise HTTPException(status_code=500, detail=f"{type(e).__name__}: {e}\n\n{tb}")
