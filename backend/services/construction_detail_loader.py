"""
services/construction_detail_loader.py

Loads Construction_Detail.xlsx which has columns:
  Region | Country | Segment | New/Ren | Source | 2019 | 2020 | ... | 2029

Provides Mekko and Growth data for the Construction Detail page.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read

SHEET_NAME = 0   # first sheet


@lru_cache(maxsize=1)
def get_construction_detail_df() -> pd.DataFrame:
    """Load Construction Detail file — disk-cached after first parse."""
    def _load():
        df = pd.read_excel(
            settings.construction_detail_path,
            sheet_name=SHEET_NAME,
            engine="calamine",
        )
        # Normalize column names: strip whitespace and convert float years to int
        # e.g. "2019.0" -> "2019"
        new_cols = []
        for c in df.columns:
            s = str(c).strip()
            try:
                v = float(s)
                if v == int(v):
                    s = str(int(v))
            except (ValueError, TypeError):
                pass
            new_cols.append(s)
        df.columns = new_cols
        return df
    return cached_read(settings.construction_detail_path, _load)


# ── Meta helpers ──────────────────────────────────────────────────────────────

def get_year_columns(df: pd.DataFrame) -> List[int]:
    years = []
    for c in df.columns:
        try:
            # Handle both "2019" and "2019.0" (pandas sometimes reads int cols as float)
            years.append(int(float(str(c).strip())))
        except (ValueError, TypeError):
            pass
    return sorted(set(years))


def get_regions(df: pd.DataFrame) -> List[str]:
    if "Region" not in df.columns:
        return []
    return sorted(df["Region"].dropna().astype(str).unique().tolist())


def get_countries(
    df: pd.DataFrame,
    region: Optional[str] = None,
    segment: Optional[str] = None,
    new_ren: Optional[str] = None,
) -> List[str]:
    base = df.copy()
    if region and region != "All":
        base = base[base["Region"].astype(str) == region]
    if segment and segment != "All":
        base = base[base["Segment"].astype(str) == segment]
    if new_ren and new_ren != "All":
        base = base[base["New/Ren"].astype(str) == new_ren]
    if "Country" not in base.columns:
        return []
    return sorted(base["Country"].dropna().astype(str).unique().tolist())


def get_segments(df: pd.DataFrame) -> List[str]:
    if "Segment" not in df.columns:
        return []
    return sorted(df["Segment"].dropna().astype(str).unique().tolist())


def get_new_ren_values(df: pd.DataFrame) -> List[str]:
    col = "New/Ren"
    if col not in df.columns:
        return []
    return sorted(df[col].dropna().astype(str).unique().tolist())


def get_sources(df: pd.DataFrame) -> List[str]:
    if "Source" not in df.columns:
        return []
    return sorted(df["Source"].dropna().astype(str).unique().tolist())


# ── Mekko data ────────────────────────────────────────────────────────────────

def get_mekko_data(
    df: pd.DataFrame,
    year: int,
    top_n: int = 10,
    show_other: bool = True,
    segment: Optional[str] = None,
    new_ren: Optional[str] = None,
    source: Optional[str] = None,
) -> List[Dict]:
    """
    Returns [{Region, Country, value}] for Mekko chart.
    Aggregates across Segment / New/Ren rows matching filters.
    """
    base = df.copy()
    if segment and segment != "All":
        base = base[base["Segment"].astype(str) == segment]
    if new_ren and new_ren != "All":
        base = base[base["New/Ren"].astype(str) == new_ren]
    if source and source != "All":
        base = base[base["Source"].astype(str) == source]

    # Find the actual column name — could be "2024" or "2024.0"
    year_col = str(year)
    if year_col not in base.columns:
        # Try float variant e.g. "2024.0"
        year_col_f = f"{year}.0"
        if year_col_f in base.columns:
            year_col = year_col_f
        else:
            return []

    base[year_col] = pd.to_numeric(base[year_col], errors="coerce")
    base = base.dropna(subset=[year_col])
    base = base[base[year_col] > 0]

    if base.empty:
        return []

    g = (
        base.groupby(["Region", "Country"], as_index=False)[year_col]
        .sum()
        .rename(columns={year_col: "value"})
    )

    parts = []
    for region_name, grp in g.groupby("Region", sort=False):
        grp = grp.sort_values("value", ascending=False).copy()
        top  = grp.head(top_n)
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

    if not parts:
        return []
    return pd.concat(parts, ignore_index=True).to_dict(orient="records")


# ── Growth data ───────────────────────────────────────────────────────────────

# Source weights for weighted average CAGR
SOURCE_WEIGHTS: Dict[str, float] = {
    "globaldata":    1.0,
    "ihs":           2.0,
    "euroconstruct": 2.0,
}

KNOWN_SOURCES = ["GlobalData", "IHS", "Euroconstruct"]


def _cagr_rate(v_start: Optional[float], v_end: Optional[float], n: int) -> Optional[float]:
    if v_start and v_end and v_start > 0 and n > 0:
        return (v_end / v_start) ** (1.0 / n) - 1.0
    return None


def _slice_revenue(
    df: pd.DataFrame,
    region: str,
    country: str,
    years: List[int],
    segment: Optional[str],
    new_ren: Optional[str],
    source_filter: Optional[str],
) -> Dict[int, Optional[float]]:
    """Sum values for a given slice (region/country/segment/new_ren/source)."""
    base = df.copy()
    if segment and segment != "All":
        base = base[base["Segment"].astype(str) == segment]
    if new_ren and new_ren != "All":
        base = base[base["New/Ren"].astype(str) == new_ren]
    if source_filter:
        base = base[base["Source"].astype(str).str.casefold() == source_filter.casefold()]

    if country == "All Countries":
        slice_df = base[base["Region"].astype(str) == region].copy()
    else:
        slice_df = base[
            (base["Region"].astype(str) == region) &
            (base["Country"].astype(str) == country)
        ].copy()

    revenue: Dict[int, Optional[float]] = {}
    for y in years:
        col = str(y)
        if col not in slice_df.columns:
            col = f"{y}.0"
        if col not in slice_df.columns or slice_df.empty:
            revenue[y] = None
            continue
        s = pd.to_numeric(slice_df[col], errors="coerce")
        revenue[y] = float(s.sum(skipna=True)) if not s.dropna().empty else None
    return revenue


def get_growth_data(
    df: pd.DataFrame,
    region: str,
    country: str,
    year_min: int = 2010,
    year_max: int = 2029,
    segment: Optional[str] = None,
    new_ren: Optional[str] = None,
    source: Optional[str] = None,
) -> Dict:
    """
    Returns {years, revenue, yoy, cagr, cutoff_year} for Growth chart.
    cagr rows include per-source CAGRs and weighted average.
    Weights: GlobalData=1, IHS=2, Euroconstruct=2
    """
    all_years = get_year_columns(df)
    years = [y for y in all_years if year_min <= y <= year_max]

    # Overall revenue (all sources combined or filtered)
    revenue = _slice_revenue(df, region, country, years, segment, new_ren, source)

    yoy: Dict[int, Optional[float]] = {}
    for i, y in enumerate(years):
        if i == 0:
            yoy[y] = None
            continue
        prev = revenue.get(years[i - 1])
        cur  = revenue.get(y)
        yoy[y] = ((cur / prev) - 1.0) if (prev and cur is not None and prev != 0) else None

    # Per-source revenue for CAGR breakdown
    # Detect which sources actually exist in the data
    avail_sources = df["Source"].dropna().astype(str).str.strip().unique().tolist() if "Source" in df.columns else []
    source_name_map: Dict[str, str] = {}
    for s in avail_sources:
        sl = s.casefold()
        if "globaldata" in sl:
            source_name_map["GlobalData"] = s
        elif "ihs" in sl:
            source_name_map["IHS"] = s
        elif "euroconstruct" in sl:
            source_name_map["Euroconstruct"] = s

    cagr_rows = []
    for start, end in [(2019, 2024), (2024, 2029)]:
        n = end - start

        # Overall start/end values
        sv = revenue.get(start)
        ev = revenue.get(end)

        # Per-source CAGRs
        source_cagrs: Dict[str, Optional[float]] = {}
        for label in ["GlobalData", "IHS", "Euroconstruct"]:
            raw_src = source_name_map.get(label)
            if raw_src:
                src_rev = _slice_revenue(df, region, country, [start, end], segment, new_ren, raw_src)
                source_cagrs[label] = _cagr_rate(src_rev.get(start), src_rev.get(end), n)
            else:
                source_cagrs[label] = None

        # Weighted average CAGR
        weight_key_map = {"GlobalData": "globaldata", "IHS": "ihs", "Euroconstruct": "euroconstruct"}
        total_w, weighted_sum = 0.0, 0.0
        for label, cagr_val in source_cagrs.items():
            if cagr_val is not None:
                w = SOURCE_WEIGHTS.get(weight_key_map[label], 1.0)
                weighted_sum += cagr_val * w
                total_w += w
        weighted_avg = (weighted_sum / total_w) if total_w > 0 else None

        cagr_rows.append({
            "period":            f"{start}–{end}",
            "start":             sv,
            "end":               ev,
            "cagr":              _cagr_rate(sv, ev, n),          # overall
            "globaldata_cagr":   source_cagrs.get("GlobalData"),
            "ihs_cagr":          source_cagrs.get("IHS"),
            "euroconstruct_cagr":source_cagrs.get("Euroconstruct"),
            "weighted_avg_cagr": weighted_avg,
        })

    return {
        "years":       years,
        "revenue":     {str(k): v for k, v in revenue.items()},
        "yoy":         {str(k): v for k, v in yoy.items()},
        "cagr":        cagr_rows,
        "cutoff_year": 2024,
    }