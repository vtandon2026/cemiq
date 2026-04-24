"""
services/cache_utils.py
Disk-based pickle cache for DataFrames.
Avoids re-parsing Excel on every backend restart.

Cache location: <backend_dir>/.df_cache/
Cache key:      MD5 of (absolute_path + mtime + size + extra)
Invalidation:   Automatic when source file changes (mtime or size differs)
"""
from __future__ import annotations

import hashlib
import logging
import pickle
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any, Callable, Optional

import pandas as pd

logger = logging.getLogger("cemiq.cache")

# Always resolve relative to THIS file so it works regardless of cwd
_THIS_DIR  = Path(__file__).resolve().parent.parent   # backend/
CACHE_DIR  = _THIS_DIR / ".df_cache"

try:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    logger.debug(f"Cache dir: {CACHE_DIR}")
except Exception as e:
    logger.warning(f"Could not create cache dir {CACHE_DIR}: {e}")


def _cache_key(source_path: Path, extra: str = "") -> str:
    """Stable key based on file identity + modification state."""
    try:
        p    = Path(source_path).resolve()
        stat = p.stat()
        raw  = f"{p}:{stat.st_mtime}:{stat.st_size}:{extra}"
    except Exception:
        raw = f"{source_path}:{extra}"
    return hashlib.md5(raw.encode()).hexdigest()


def cached_read(
    source_path: Path,
    loader_fn: Callable[[], pd.DataFrame],
    extra: str = "",
) -> pd.DataFrame:
    """
    Return a cached DataFrame for source_path.

    - On first call: parse with loader_fn, pickle to .df_cache/
    - On subsequent calls: load pickle if source file unchanged (~0.1s)
    - On source file change: re-parse and update pickle automatically
    """
    source_path = Path(source_path).resolve()
    key         = _cache_key(source_path, extra)
    pkl_path    = CACHE_DIR / f"{key}.pkl"

    if pkl_path.exists():
        try:
            t0 = time.perf_counter()
            with open(pkl_path, "rb") as f:
                df = pickle.load(f)
            elapsed = time.perf_counter() - t0
            logger.info(f"✓ Cache hit  {source_path.name:<45} {elapsed:.2f}s  ({len(df):,} rows)")
            return df
        except Exception as e:
            logger.warning(f"Cache read failed {source_path.name}: {e} — re-parsing")
            try:
                pkl_path.unlink(missing_ok=True)
            except Exception:
                pass

    logger.info(f"⏳ Parsing   {source_path.name} ...")
    t0      = time.perf_counter()
    df      = loader_fn()
    elapsed = time.perf_counter() - t0
    logger.info(f"✓ Parsed     {source_path.name:<45} {elapsed:.1f}s  ({len(df):,} rows)")

    try:
        tmp = pkl_path.with_suffix(".tmp")
        with open(tmp, "wb") as f:
            pickle.dump(df, f, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(pkl_path)   # atomic rename — avoids corrupt cache on crash
        logger.info(f"✓ Cached     {source_path.name} → {pkl_path.name}")
    except Exception as e:
        logger.warning(f"Cache write failed {source_path.name}: {e}")

    return df


def cache_info() -> dict:
    """Return info about all cached files (for /health endpoint)."""
    files = list(CACHE_DIR.glob("*.pkl")) if CACHE_DIR.exists() else []
    total = sum(f.stat().st_size for f in files)
    return {
        "cache_dir":   str(CACHE_DIR),
        "files":       len(files),
        "total_mb":    round(total / 1024 / 1024, 1),
    }


def clear_cache() -> int:
    """Delete all .pkl files. Returns count deleted."""
    deleted = 0
    for pkl in CACHE_DIR.glob("*.pkl"):
        try:
            pkl.unlink()
            deleted += 1
        except Exception:
            pass
    logger.info(f"Cache cleared: {deleted} files deleted")
    return deleted


class ResponseCache:
    """Small thread-safe LRU cache for expensive response payloads."""

    def __init__(self, maxsize: int = 128, ttl_seconds: Optional[int] = None):
        self.maxsize = maxsize
        self.ttl_seconds = ttl_seconds
        self._lock = threading.RLock()
        self._store: "OrderedDict[str, tuple[float, Any]]" = OrderedDict()

    @staticmethod
    def make_key(prefix: str, payload: Any) -> str:
        raw = pickle.dumps((prefix, payload), protocol=pickle.HIGHEST_PROTOCOL)
        return hashlib.md5(raw).hexdigest()

    def get(self, key: str) -> Any:
        with self._lock:
            item = self._store.get(key)
            if item is None:
                return None

            created_at, value = item
            if self.ttl_seconds is not None and (time.time() - created_at) > self.ttl_seconds:
                self._store.pop(key, None)
                return None

            self._store.move_to_end(key)
            return value

    def set(self, key: str, value: Any) -> Any:
        with self._lock:
            self._store[key] = (time.time(), value)
            self._store.move_to_end(key)
            while len(self._store) > self.maxsize:
                self._store.popitem(last=False)
        return value

    def get_or_set(self, key: str, factory: Callable[[], Any]) -> Any:
        cached = self.get(key)
        if cached is not None:
            return cached
        return self.set(key, factory())

    def clear(self) -> None:
        with self._lock:
            self._store.clear()
