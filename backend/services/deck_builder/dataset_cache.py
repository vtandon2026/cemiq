# dataset_cache.py
from __future__ import annotations

from pathlib import Path
from typing import Optional

import pandas as pd

try:
    import streamlit as st  # type: ignore
except Exception:  # pragma: no cover
    st = None  # type: ignore


def _cache_data_decorator():
    if st is not None:
        return st.cache_data

    def _noop(*args, **kwargs):
        return lambda fn: fn

    return _noop


cache_data = _cache_data_decorator()


def _parquet_cache_path(src_path: Path, cache_stem: Optional[str] = None) -> Path:
    cache_dir = src_path.parent / ".cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    stem = cache_stem or src_path.stem
    return cache_dir / f"{stem}.parquet"


@cache_data(show_spinner="Loading CIQ financial data...")  # type: ignore[misc]
def _read_ciq_from_parquet_cached(parquet_path: str, parquet_mtime: float) -> Optional[pd.DataFrame]:
    try:
        df = pd.read_parquet(parquet_path)
        return df if isinstance(df, pd.DataFrame) and not df.empty else None
    except Exception:
        return None


def load_ciq_long_df(
    xlsx_path: str | Path,
    *,
    prefer_parquet: bool = True,
    rebuild_if_missing: bool = True,
) -> Optional[pd.DataFrame]:
    src = Path(xlsx_path)
    if not src.exists():
        return None

    parquet_path = _parquet_cache_path(src, cache_stem=f"{src.stem}.ciq_long")

    if prefer_parquet and parquet_path.exists():
        try:
            if parquet_path.stat().st_mtime >= src.stat().st_mtime:
                return _read_ciq_from_parquet_cached(
                    str(parquet_path.resolve()),
                    parquet_path.stat().st_mtime,
                )
        except Exception:
            pass

    if not rebuild_if_missing:
        return None

    try:
        from cld import ciq_helpers as ch  # type: ignore

        df = ch.load_ciq_ids_linked(src)
        if isinstance(df, pd.DataFrame) and not df.empty:
            try:
                df.to_parquet(parquet_path, index=False)
            except Exception:
                pass
            return df
        return None
    except Exception:
        return None


@cache_data(show_spinner=False)  # type: ignore[misc]
def _read_excel_via_openpyxl_cached(path: str, mtime: float, header_row: int) -> pd.DataFrame:
    df = pd.read_excel(path, header=header_row, engine="openpyxl")
    df.columns = [str(c).strip() for c in df.columns]
    return df


@cache_data(show_spinner=False)  # type: ignore[misc]
def _read_parquet_cached(parquet_path: str, parquet_mtime: float) -> pd.DataFrame:
    return pd.read_parquet(parquet_path)


def load_excel_with_parquet_cache(
    xlsx_path: str | Path,
    *,
    header_row: int = 0,
    cache_stem_suffix: str = "excel_cache",
) -> pd.DataFrame:
    src = Path(xlsx_path)
    if not src.exists():
        raise FileNotFoundError(f"File not found: {src}")

    parquet_path = _parquet_cache_path(src, cache_stem=f"{src.stem}.{cache_stem_suffix}")

    if parquet_path.exists():
        try:
            if parquet_path.stat().st_mtime >= src.stat().st_mtime:
                return _read_parquet_cached(
                    str(parquet_path.resolve()),
                    parquet_path.stat().st_mtime,
                )
        except Exception:
            pass

    df = _read_excel_via_openpyxl_cached(
        str(src.resolve()),
        src.stat().st_mtime,
        header_row,
    )

    try:
        df.to_parquet(parquet_path, index=False)
    except Exception:
        pass

    return df