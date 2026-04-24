"""
services/profit_pool_loader.py
Loads Profit_Pool.xlsx and computes category EBITDA margin view.
Mirrors imapp/profit_pool_page.py logic exactly.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Dict, List, Optional

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


COL_REGION    = "Geographic Region"
COL_COUNTRY   = "Headquarters - Country/Region"
COL_FINAL_TAG = "Final tagging"
COL_SIC       = "SIC Codes"
CEMENT_PARENT = "Building Materials (Except Cement)"
OTHER_REVENUE_THRESHOLD = 0.05

CATEGORY_RENAMES = {
    "Materials & Components": "Building Materials (Except Cement)",
    "Epc & Design": "EPC & Design",
}

AVAILABLE_YEARS = [2020, 2021, 2022, 2023, 2024]


@lru_cache(maxsize=1)
def get_profit_pool_df() -> pd.DataFrame:
    def _load() -> pd.DataFrame:
        df = pd.read_excel(settings.profit_pool_path, header=1, engine="openpyxl")
        df.columns = [str(c).strip() for c in df.columns]
        return df

    return cached_read(settings.profit_pool_path, _load, extra="profit_pool_header1")


def _revenue_col(year: int) -> str:
    return f"Total Revenue [FY {year}] ($USDmm, Historical rate)"


def _ebitda_col(year: int) -> str:
    return f"EBITDA [FY {year}] ($USDmm, Historical rate)"


def _normalize_category(s: pd.Series) -> pd.Series:
    return (
        s.fillna("").astype(str)
        .str.replace("\u00A0", " ", regex=False)
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
        .str.title()
    )


def _clean_str(s: pd.Series) -> pd.Series:
    return s.fillna("").astype(str).str.strip()


def get_available_profit_pool_years(df: pd.DataFrame) -> List[int]:
    available = []
    for col in df.columns:
        m = re.search(r"Total Revenue \[FY (\d{4})\]", str(col))
        if m:
            y = int(m.group(1))
            if _ebitda_col(y) in df.columns:
                available.append(y)
    return sorted(available) or AVAILABLE_YEARS


def get_profit_pool_regions(df: pd.DataFrame) -> List[str]:
    if COL_REGION not in df.columns:
        return []
    return sorted([v for v in _clean_str(df[COL_REGION]).unique().tolist() if v])


def get_profit_pool_countries(
    df: pd.DataFrame,
    regions: Optional[List[str]] = None,
) -> List[str]:
    if COL_COUNTRY not in df.columns:
        return []
    d = df.copy()
    if regions:
        d = d[_clean_str(d[COL_REGION]).isin(regions)]
    return sorted([v for v in _clean_str(d[COL_COUNTRY]).unique().tolist() if v])


def compute_profit_pool_view(
    df: pd.DataFrame,
    year: int,
    selected_regions: Optional[List[str]] = None,
    selected_countries: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Returns list of {Category, Revenue, EBITDA, EBITDA_margin, width, is_other}
    matching imapp/profit_pool_page.py make_category_mekko_margin_chart() logic exactly.
    """
    rev_col = _revenue_col(year)
    ebt_col = _ebitda_col(year)
    required = [COL_FINAL_TAG, COL_SIC, rev_col, ebt_col]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    d = df.copy()
    if selected_regions:
        d = d[_clean_str(d[COL_REGION]).isin(selected_regions)]
    if selected_countries:
        d = d[_clean_str(d[COL_COUNTRY]).isin(selected_countries)]

    d = d.copy()
    d[COL_FINAL_TAG] = _normalize_category(d[COL_FINAL_TAG])
    d[COL_SIC]       = _clean_str(d[COL_SIC])
    d[rev_col]       = pd.to_numeric(d[rev_col], errors="coerce").fillna(0.0)
    d[ebt_col]       = pd.to_numeric(d[ebt_col], errors="coerce").fillna(0.0)

    cement_mask = (
        (d[COL_FINAL_TAG].str.lower() == CEMENT_PARENT.lower())
        & d[COL_SIC].str.contains(r"cement", case=False, na=False)
    )
    cement_rev = float(d.loc[cement_mask, rev_col].sum())
    cement_ebt = float(d.loc[cement_mask, ebt_col].sum())

    rows = []
    for cat in [c for c in d[COL_FINAL_TAG].unique() if c]:
        if cat.strip().lower() == CEMENT_PARENT.lower():
            mask = (d[COL_FINAL_TAG].str.lower() == CEMENT_PARENT.lower()) & (~cement_mask)
        else:
            mask = d[COL_FINAL_TAG] == cat
        rev = float(d.loc[mask, rev_col].sum())
        ebt = float(d.loc[mask, ebt_col].sum())
        margin = (ebt / rev) if rev != 0 else 0.0
        rows.append({"Category": cat, "Revenue": rev, "EBITDA": ebt, "EBITDA_margin": margin})

    rows.append({
        "Category": "Cement",
        "Revenue": cement_rev,
        "EBITDA": cement_ebt,
        "EBITDA_margin": (cement_ebt / cement_rev) if cement_rev else 0.0,
    })

    df_view = pd.DataFrame(rows)
    df_view = df_view[df_view["Category"].astype(str).str.strip() != ""].copy()
    df_view["Category"] = df_view["Category"].replace(CATEGORY_RENAMES)

    total_rev = float(df_view["Revenue"].sum())
    if total_rev <= 0:
        return []

    df_view["width"] = df_view["Revenue"].clip(lower=0.0) / total_rev

    # Split into main (≥5%) and other (<5%)
    main_mask  = df_view["width"] >= OTHER_REVENUE_THRESHOLD
    df_main    = df_view[main_mask].sort_values("EBITDA_margin", ascending=False)
    df_small   = df_view[~main_mask]

    result = df_main.copy()
    result["is_other"] = False

    other_constituent: List[str] = []
    if not df_small.empty:
        other_constituent = df_small["Category"].tolist()
        other_rev   = float(df_small["Revenue"].sum())
        other_ebt   = float(df_small["EBITDA"].sum())
        other_margin = float(df_small["EBITDA_margin"].mean())
        other_row = pd.DataFrame([{
            "Category": "Other (<5% rev)",
            "Revenue": other_rev,
            "EBITDA": other_ebt,
            "EBITDA_margin": other_margin,
            "width": other_rev / total_rev,
            "is_other": True,
        }])
        result = pd.concat([result, other_row], ignore_index=True)

    out = result.to_dict(orient="records")
    for row in out:
        if row.get("is_other"):
            row["constituent_categories"] = other_constituent
    return out
