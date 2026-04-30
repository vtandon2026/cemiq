# services/dealogic_loader.py
"""
Loads and processes Dealogic-Cement Industry_M&A.xlsx
for the M&A Deals page.
"""
from __future__ import annotations

import functools
import os
import pandas as pd
import numpy as np

_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Dealogic-Cement Industry_M&A.xlsx")

_DEAL_ID_COL    = "GIB Deal #"
_VALUE_COL      = "Deal Value USD (m)"
_DATE_COL       = "Pricing/Completion Date"
_REGION_COL     = "Deal Region"
_TARGET_REG_COL = "Target Region (Primary)"
_STATUS_COL     = "Deal Status"
_TECHNIQUE_COL  = "Deal Technique"


@functools.lru_cache(maxsize=1)
def get_dealogic_df() -> pd.DataFrame:
    """Read & cache the Dealogic Excel file."""
    path = os.path.abspath(_EXCEL_PATH)
    df = pd.read_excel(path, sheet_name=0, engine="openpyxl")
    df.columns = df.columns.str.strip()

    # Parse date column — extract year
    df[_DATE_COL] = pd.to_datetime(df[_DATE_COL], errors="coerce", dayfirst=True)
    df["_year"] = df[_DATE_COL].dt.year

    # Clean value column
    df[_VALUE_COL] = pd.to_numeric(df[_VALUE_COL], errors="coerce")

    # Clean string cols
    for col in [_REGION_COL, _TARGET_REG_COL, _STATUS_COL, _TECHNIQUE_COL]:
        if col in df.columns:
            df[col] = df[col].astype(str).str.strip()

    return df


def get_year_range(df: pd.DataFrame) -> tuple[int, int]:
    years = df["_year"].dropna()
    return int(years.min()), int(years.max())


def get_deal_regions(df: pd.DataFrame) -> list[str]:
    return sorted(df[_REGION_COL].dropna().unique().tolist())


def get_target_regions(df: pd.DataFrame) -> list[str]:
    return sorted(df[_TARGET_REG_COL].dropna().unique().tolist())


def get_deal_statuses(df: pd.DataFrame) -> list[str]:
    return sorted(df[_STATUS_COL].dropna().unique().tolist())


def get_deal_techniques(df: pd.DataFrame) -> list[str]:
    vals = []
    for v in df[_TECHNIQUE_COL].dropna().unique():
        # Some cells have multiple techniques separated by newlines
        for t in str(v).split("\n"):
            t = t.strip()
            if t and t not in vals:
                vals.append(t)
    return sorted(vals)


def get_value_range(df: pd.DataFrame) -> tuple[float, float]:
    v = df[_VALUE_COL].dropna()
    return float(v.min()), float(v.max())


def compute_chart_data(
    df: pd.DataFrame,
    year_min: int,
    year_max: int,
    deal_regions: list[str] | None,
    target_regions: list[str] | None,
    deal_statuses: list[str] | None,
    deal_techniques: list[str] | None,
    min_deal_value: float | None,
) -> list[dict]:
    """
    Returns list of { year, deal_value_b, deal_count, deal_value_yoy }
    sorted by year.
    """
    fdf = df.copy()

    # Year filter
    fdf = fdf[(fdf["_year"] >= year_min) & (fdf["_year"] <= year_max)]

    # Region filters
    if deal_regions:
        fdf = fdf[fdf[_REGION_COL].isin(deal_regions)]
    if target_regions:
        fdf = fdf[fdf[_TARGET_REG_COL].isin(target_regions)]

    # Status filter
    if deal_statuses:
        fdf = fdf[fdf[_STATUS_COL].isin(deal_statuses)]

    # Technique filter — handle multi-value cells
    if deal_techniques:
        mask = fdf[_TECHNIQUE_COL].apply(
            lambda v: any(t.strip() in deal_techniques for t in str(v).split("\n"))
        )
        fdf = fdf[mask]

    # Min deal value filter
    if min_deal_value is not None and min_deal_value > 0:
        fdf = fdf[fdf[_VALUE_COL] >= min_deal_value]

    # Group by year
    grp = fdf.groupby("_year").agg(
        deal_value_m=(      _VALUE_COL, "sum"),
        deal_count=(        _DEAL_ID_COL, "nunique"),
    ).reset_index().rename(columns={"_year": "year"})

    grp = grp.sort_values("year")

    # Convert to $B
    grp["deal_value_b"] = (grp["deal_value_m"] / 1000).round(2)

    # YoY % change on deal value
    grp["deal_value_yoy"] = grp["deal_value_b"].pct_change() * 100
    grp["deal_value_yoy"] = grp["deal_value_yoy"].round(2)

    # Replace NaN with None for JSON
    grp = grp.replace({np.nan: None})

    return grp[["year", "deal_value_b", "deal_count", "deal_value_yoy"]].to_dict(orient="records")


def get_deals_table(
    df: pd.DataFrame,
    year_min: int,
    year_max: int,
    deal_regions: list[str] | None,
    target_regions: list[str] | None,
    deal_statuses: list[str] | None,
    deal_techniques: list[str] | None,
    min_deal_value: float | None,
) -> list[dict]:
    """Returns filtered deal rows for the data table."""
    fdf = df.copy()
    fdf = fdf[(fdf["_year"] >= year_min) & (fdf["_year"] <= year_max)]
    if deal_regions:
        fdf = fdf[fdf[_REGION_COL].isin(deal_regions)]
    if target_regions:
        fdf = fdf[fdf[_TARGET_REG_COL].isin(target_regions)]
    if deal_statuses:
        fdf = fdf[fdf[_STATUS_COL].isin(deal_statuses)]
    if deal_techniques:
        mask = fdf[_TECHNIQUE_COL].apply(
            lambda v: any(t.strip() in deal_techniques for t in str(v).split("\n"))
        )
        fdf = fdf[mask]
    if min_deal_value is not None and min_deal_value > 0:
        fdf = fdf[fdf[_VALUE_COL] >= min_deal_value]

    # Pick display columns
    display_cols = [
        _DEAL_ID_COL, "Acquiror", "Divestor", "Target Region (Primary)",
        _VALUE_COL, _STATUS_COL, _TECHNIQUE_COL, "Pricing/Completion Date",
    ]
    display_cols = [c for c in display_cols if c in fdf.columns]
    out = fdf[display_cols].copy()
    out["Pricing/Completion Date"] = out["Pricing/Completion Date"].astype(str)
    out = out.replace({np.nan: None})
    return out.head(500).to_dict(orient="records")