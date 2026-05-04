"""
services/bain_pov_loader.py
Loads Bain POV Flat File_Wave4 1.xlsx and provides CAGR lookup by
(Country, Segment, New/Renovation).
"""
from __future__ import annotations

import functools
import os
import re
from typing import Optional
import pandas as pd

_FILE = os.path.join(os.path.dirname(__file__), "..", "data", "Bain POV Flat File_Wave4 1.xlsx")

_COL_COUNTRY  = "Country"
_COL_SEGMENT  = "Segment"
_COL_SUBSEG   = "Sub-segment"
_COL_NEWREN   = "New / Renovation"
_COL_CAGR     = "CAGR"
_COL_RANGE    = "CAGR Range"


@functools.lru_cache(maxsize=1)
def get_bain_pov_df() -> pd.DataFrame:
    import logging
    path = os.path.abspath(_FILE)
    # Check all sheet names
    xl = pd.ExcelFile(path, engine="openpyxl")
    logging.getLogger("cemiq").info(f"Bain POV sheets: {xl.sheet_names}")
    # Find the sheet that has 'Country' in its first few rows
    for sheet in xl.sheet_names:
        raw = pd.read_excel(xl, sheet_name=sheet, header=None, nrows=15)
        for i, row in raw.iterrows():
            vals = [str(v).strip().lower() for v in row.values if str(v).strip()]
            if "country" in vals:
                df = pd.read_excel(xl, sheet_name=sheet, header=i)
                df.columns = df.columns.str.strip()
                logging.getLogger("cemiq").info(f"Bain POV data on sheet '{sheet}' row {i}: {list(df.columns[:8])}")
                for col in [_COL_COUNTRY, _COL_SEGMENT, _COL_SUBSEG, _COL_NEWREN, _COL_CAGR, _COL_RANGE]:
                    if col in df.columns:
                        df[col] = df[col].astype(str).str.strip()
                return df
    logging.getLogger("cemiq").warning(f"Bain POV: data sheet not found among {xl.sheet_names}")
    return pd.read_excel(path, sheet_name=0, engine="openpyxl")


def _parse_cagr(val: str) -> Optional[float]:
    """Convert '2.6%' → 0.026, or 0.027 (already decimal) → 0.027, '-' → None."""
    if not val or val in ("-", "nan", "N/A", ""):
        return None
    try:
        if "%" in val:
            return float(val.replace("%", "").strip()) / 100.0
        else:
            num = float(val.strip())
            # If magnitude > 1, it's stored as percentage like 2.7 → divide by 100
            if abs(num) > 1:
                return num / 100.0
            return num
    except ValueError:
        return None


def _parse_range(val: str) -> Optional[str]:
    """Return range string like '1.5 to 3.5%' or None."""
    if not val or val in ("-", "nan", "N/A", ""):
        return None
    return val.strip()


def lookup_bain_pov(
    country: str,
    segment: str,
    new_ren: str,
) -> dict:
    """
    Returns {"cagr": float|None, "range": str|None} for the given filters.
    """
    if not country or country in ("All Countries", "All", ""):
        return {"cagr": None, "range": None}

    df = get_bain_pov_df()

    seg_val = "Overall" if not segment or segment in ("All", "Overall") else segment
    nr_val  = "Overall" if not new_ren  or new_ren  in ("All", "Overall") else new_ren

    mask = (
        (df[_COL_COUNTRY].str.lower() == country.lower()) &
        (df[_COL_SEGMENT].str.lower() == seg_val.lower()) &
        (df[_COL_NEWREN].str.lower()  == nr_val.lower())
    )
    rows = df[mask]

    if rows.empty:
        return {"cagr": None, "range": None}

    row = rows.iloc[0]
    return {
        "cagr":  _parse_cagr(row[_COL_CAGR]),
        "range": _parse_range(row[_COL_RANGE]),
    }