"""
services/flat_file_loader.py
Loads and caches Construction_Cement_FlatFile.xlsx.
All Mekko + Growth data logic lives here.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


SHEET_NAME = "Flat file"


@lru_cache(maxsize=2)
def get_flat_file_df() -> pd.DataFrame:
    """Load flat file, disk-cached after first read."""
    return cached_read(
        settings.flat_file_path,
        lambda: pd.read_excel(settings.flat_file_path, sheet_name=SHEET_NAME, engine="calamine"),
        extra=SHEET_NAME,
    )



def get_year_columns(df: pd.DataFrame) -> List[int]:
    years = []
    for c in df.columns:
        try:
            years.append(int(str(c)))
        except (ValueError, TypeError):
            pass
    return sorted(set(years))


def get_categories(df: pd.DataFrame) -> List[str]:
    if "Category" not in df.columns:
        return []
    return sorted(df["Category"].dropna().astype(str).unique().tolist())


def get_regions(df: pd.DataFrame, category: Optional[str] = None) -> List[str]:
    base = df if category is None else df[df["Category"] == category]
    if "Region" not in base.columns:
        return []
    return sorted(base["Region"].dropna().astype(str).unique().tolist())


def get_countries(
    df: pd.DataFrame,
    category: Optional[str] = None,
    region: Optional[str] = None,
) -> List[str]:
    base = df.copy()
    if category:
        base = base[base["Category"] == category]
    if region:
        base = base[base["Region"] == region]
    if "Country" not in base.columns:
        return []
    return sorted(base["Country"].dropna().astype(str).unique().tolist())


def get_kpi_columns(df: pd.DataFrame) -> List[str]:
    return sorted([
        c for c in df.columns
        if isinstance(c, str) and c.strip().lower().startswith("kpi level")
    ])


def get_unit(df: pd.DataFrame, category: str) -> str:
    base = df[df["Category"] == category]
    if "Unit" not in base.columns or base.empty:
        return "$ Mn"
    unit_vals = base["Unit"].dropna().astype(str).unique().tolist()
    if len(unit_vals) == 1:
        return unit_vals[0].replace("(real)", "").replace("(nominal)", "").strip()
    if len(unit_vals) > 1:
        return "Multiple units"
    return "$ Mn"


def get_mekko_data(
    df: pd.DataFrame,
    category: str,
    year: int,
    top_n: int = 10,
    show_other: bool = True,
    kpi_filters: Optional[Dict[str, str]] = None,
) -> List[Dict]:
    """
    Returns list of {Region, Country, value} records for Mekko chart.
    Mirrors cacd_category_page.py Mekko logic exactly.
    """
    base = df[df["Category"] == category].copy()

    if kpi_filters:
        for col, val in kpi_filters.items():
            if val and val != "(All)" and col in base.columns:
                base = base[base[col] == val]

    year_col = str(year)
    if year_col not in base.columns:
        return []

    base[year_col] = pd.to_numeric(base[year_col], errors="coerce")
    base = base.dropna(subset=[year_col])

    if "Region" in base.columns:
        base = base[base["Region"].astype(str).str.lower() != "world"]
    if "Country" in base.columns:
        base = base[base["Country"].astype(str).str.lower() != "all"]

    g = (
        base.groupby(["Region", "Country"], as_index=False)[year_col]
        .sum()
        .rename(columns={year_col: "value"})
    )
    g = g[g["value"] > 0].copy()
    if g.empty:
        return []

    # Avoid groupby().apply() entirely to sidestep pandas >= 2.2 behaviour
    # where the groupby key column is dropped from the group DataFrame.
    parts = []
    for region_name, grp in g.groupby("Region", sort=False):
        grp = grp.sort_values("value", ascending=False).copy()
        top = grp.head(top_n)
        rest = grp.iloc[top_n:]
        if len(rest) > 0 and show_other:
            other_val = rest["value"].sum()
            if other_val > 0:
                other_row = pd.DataFrame({
                    "Region":  [region_name],
                    "Country": ["Other"],
                    "value":   [other_val],
                })
                top = pd.concat([top, other_row], ignore_index=True)
        parts.append(top)
    result = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame(columns=["Region", "Country", "value"])
    return result.to_dict(orient="records")


def get_growth_data(
    df: pd.DataFrame,
    category: str,
    region: str,
    country: str,
    year_min: int = 2010,
    year_max: int = 2029,
    kpi_filters: Optional[Dict[str, str]] = None,
) -> Dict:
    """
    Returns {years, revenue, yoy} for the growth line chart.
    Mirrors cacd_category_page.py growth logic exactly.
    """
    base = df[df["Category"] == category].copy()

    if kpi_filters:
        for col, val in kpi_filters.items():
            if val and val != "(All)" and col in base.columns:
                base = base[base[col] == val]

    all_years = get_year_columns(df)
    years = [y for y in all_years if year_min <= y <= year_max]

    if country == "All Countries":
        slice_df = base[base["Region"] == region].copy()
    else:
        slice_df = base[
            (base["Region"] == region) & (base["Country"] == country)
        ].copy()

    revenue: Dict[int, Optional[float]] = {}
    for y in years:
        col = str(y)
        if col not in slice_df.columns or slice_df.empty:
            revenue[y] = None
            continue
        s = pd.to_numeric(slice_df[col], errors="coerce")
        revenue[y] = float(s.sum(skipna=True)) if not s.dropna().empty else None

    yoy: Dict[int, Optional[float]] = {}
    for i, y in enumerate(years):
        if i == 0:
            yoy[y] = None
            continue
        prev = revenue.get(years[i - 1])
        cur = revenue.get(y)
        if prev is None or cur is None or prev == 0:
            yoy[y] = None
        else:
            yoy[y] = (cur / prev) - 1.0

    cagr_periods = [(2010, 2019), (2020, 2024), (2025, 2029)]
    cagr_rows = []
    for start, end in cagr_periods:
        sv = revenue.get(start)
        ev = revenue.get(end)
        n = end - start
        rate = None
        if sv and ev and sv > 0 and n > 0:
            rate = (ev / sv) ** (1.0 / n) - 1.0
        cagr_rows.append({"period": f"{start}-{end}", "start": sv, "end": ev, "cagr": rate})

    return {
        "years": years,
        "revenue": {str(k): v for k, v in revenue.items()},
        "yoy": {str(k): v for k, v in yoy.items()},
        "cagr": cagr_rows,
        "cutoff_year": 2024,
    }