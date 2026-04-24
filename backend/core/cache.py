"""
core/cache.py
Simple file-based + in-memory LRU cache helpers.
Replaces @st.cache_data from Streamlit.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from functools import lru_cache, wraps
from pathlib import Path
from typing import Any, Callable, Optional


CACHE_DIR = Path(os.getenv("CACHE_DIR", "./.cache"))


def _ensure_cache_dir() -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _cache_key(payload: Any) -> str:
    raw = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def file_cache_get(key: str, ttl_seconds: int = 3600) -> Optional[Any]:
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        if (time.time() - path.stat().st_mtime) > ttl_seconds:
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def file_cache_set(key: str, data: Any) -> None:
    try:
        _ensure_cache_dir()
        with open(_cache_path(key), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, default=str)
    except Exception:
        pass


def file_cache_delete(key: str) -> None:
    try:
        _cache_path(key).unlink(missing_ok=True)
    except Exception:
        pass


def cached(ttl_seconds: int = 3600, key_fn: Optional[Callable] = None):
    """
    Decorator: cache the return value of a function to disk.

    Usage:
        @cached(ttl_seconds=3600)
        def expensive_function(arg1, arg2):
            ...
    """
    def decorator(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if key_fn:
                raw_key = key_fn(*args, **kwargs)
            else:
                raw_key = {"fn": fn.__name__, "args": args, "kwargs": kwargs}
            key = _cache_key(raw_key)
            hit = file_cache_get(key, ttl_seconds)
            if hit is not None:
                return hit
            result = fn(*args, **kwargs)
            file_cache_set(key, result)
            return result
        return wrapper
    return decorator