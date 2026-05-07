# services/trademad_loader.py
"""
Loads and processes 4 Trademad Excel files:
  - Trademad cement import value.xlsx
  - Trademad cement import volume.xlsx
  - Trademad cement export value.xlsx
  - Trademad cement export volume.xlsx

Returns GrowthData-shaped payloads for the cement demand page.
"""
from __future__ import annotations

import functools
import os
import re
from typing import Optional

import numpy as np
import pandas as pd

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")

_FILES = {
    ("import", "value"):  "Trademad cement import value.xlsx",
    ("import", "volume"): "Trademad cement import volume.xlsx",
    ("export", "value"):  "Trademad cement export value.xlsx",
    ("export", "volume"): "Trademad cement export volume.xlsx",
}

# ── Raw loaders ───────────────────────────────────────────────────────────────

def _load_value_file(path: str) -> pd.DataFrame:
    df = pd.read_excel(path, sheet_name=0, engine="openpyxl")
    df.columns = df.columns.str.strip()

    # First column is 'Exporters' or 'Importers' — rename to 'Country'
    country_col = df.columns[0]
    df = df.rename(columns={country_col: "Country"})
    year_cols = [c for c in df.columns if c != "Country"]

    # Extract year from column name e.g. "Imported value in 2006" → 2006
    year_map = {}
    for col in year_cols:
        m = re.search(r"\b(20\d{2})\b", str(col))
        if m:
            year_map[col] = int(m.group(1))

    records = []
    for _, row in df.iterrows():
        country = str(row["Country"]).strip()
        if not country or country.lower() in ("nan", "importers", "exporters"):
            continue
        for col, yr in year_map.items():
            val = pd.to_numeric(row[col], errors="coerce")
            if pd.notna(val):
                records.append({"Country": country, "Year": yr, "Value": float(val)})

    return pd.DataFrame(records)


def _load_volume_file(path: str) -> pd.DataFrame:
    """
    Volume files have messy multi-row headers with Unit columns and 'No Quantity'.
    Row 0: years (with some blank/repeated)
    Row 1: sub-headers ('Exported/Imported quantity, Tons' or 'Unit')
    Data starts at row 2.
    Returns long-format: Country | Year | Value  (None for 'No Quantity')
    """
    raw = pd.read_excel(path, sheet_name=0, header=None, engine="openpyxl")

    if raw.shape[0] < 3:
        return pd.DataFrame(columns=["Country", "Year", "Value"])

    year_row = raw.iloc[0].ffill()   # forward-fill year headers
    type_row = raw.iloc[1]           # 'Exported quantity, Tons' or 'Unit'

    # Build column index: only keep quantity columns (not 'Unit' columns)
    col_index = []  # list of (col_idx, year)
    for c in range(1, raw.shape[1]):
        yr_raw = year_row.iat[c]
        typ_raw = str(type_row.iat[c]).strip().lower()
        # Skip 'Unit' columns
        if "unit" in typ_raw:
            continue
        m = re.search(r"\b(20\d{2})\b", str(yr_raw))
        if m:
            col_index.append((c, int(m.group(1))))

    records = []
    for r in range(2, raw.shape[0]):
        country = raw.iat[r, 0]
        if pd.isna(country):
            continue
        country = str(country).strip()
        if not country or country.lower() == "nan":
            continue
        for c, yr in col_index:
            raw_val = raw.iat[r, c]
            if pd.isna(raw_val) or str(raw_val).strip().lower() == "no quantity":
                continue
            val = pd.to_numeric(raw_val, errors="coerce")
            if pd.notna(val):
                records.append({"Country": country, "Year": yr, "Value": float(val)})

    return pd.DataFrame(records)


@functools.lru_cache(maxsize=4)
def _get_trade_df(direction: str, measure: str) -> pd.DataFrame:
    """Load and cache one of the 4 trade files."""
    fname = _FILES.get((direction, measure))
    if not fname:
        raise ValueError(f"Unknown trade file: {direction}/{measure}")
    path = os.path.abspath(os.path.join(_DATA_DIR, fname))
    if not os.path.exists(path):
        raise FileNotFoundError(f"Trade file not found: {path}")
    if measure == "value":
        return _load_value_file(path)
    return _load_volume_file(path)


# ── Public API ────────────────────────────────────────────────────────────────

def get_trade_countries(direction: str, measure: str) -> list[str]:
    df = _get_trade_df(direction, measure)
    return sorted(df["Country"].dropna().unique().tolist())


def get_trade_years(direction: str, measure: str) -> list[int]:
    df = _get_trade_df(direction, measure)
    return sorted(df["Year"].dropna().unique().astype(int).tolist())


def get_trade_growth_data(
    direction: str,
    measure: str,
    country: str,
    year_min: int = 2006,
    year_max: int = 2025,
    cutoff_year: int = 2024,
) -> dict:
    """
    Returns GrowthData-shaped payload for the cement demand page.
    """
    df = _get_trade_df(direction, measure)

    sub = df[
        (df["Country"].str.strip().str.casefold() == country.strip().casefold()) &
        (df["Year"] >= year_min) &
        (df["Year"] <= year_max)
    ].copy().sort_values("Year")

    if sub.empty:
        return {
            "years": [], "revenue": {}, "yoy": {},
            "cagr": [], "cutoff_year": cutoff_year,
        }

    years = sub["Year"].astype(int).tolist()
    values = {str(int(r["Year"])): float(r["Value"]) for _, r in sub.iterrows()}

    # YoY
    yoy: dict = {}
    for i, yr in enumerate(years):
        if i == 0:
            yoy[str(yr)] = None
            continue
        prev = values.get(str(years[i - 1]))
        cur  = values.get(str(yr))
        if prev and prev > 0 and cur is not None:
            yoy[str(yr)] = (cur / prev) - 1.0
        else:
            yoy[str(yr)] = None

    # CAGR
    def _cagr(y1: int, y2: int) -> Optional[float]:
        v1 = values.get(str(y1))
        v2 = values.get(str(y2))
        if v1 and v2 and v1 > 0 and v2 > 0 and y2 > y1:
            return (v2 / v1) ** (1.0 / (y2 - y1)) - 1.0
        return None

    cagr = []
    for p_start, p_end in [(2010, 2019), (2020, cutoff_year)]:
        if p_start in years and p_end in years:
            cagr.append({
                "period": f"{p_start}–{p_end}",
                "start":  values.get(str(p_start)),
                "end":    values.get(str(p_end)),
                "cagr":   _cagr(p_start, p_end),
                "country": country,
            })

    unit = "USD" if measure == "value" else "Tons"

    return {
        "years":        years,
        "revenue":      values,
        "yoy":          yoy,
        "cagr":         cagr,
        "cutoff_year":  cutoff_year,
        "kpi":          f"{direction.title()} {measure.title()}",
        "unit":         unit,
    }