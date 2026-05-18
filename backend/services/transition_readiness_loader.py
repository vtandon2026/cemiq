"""
services/transition_readiness_loader.py
Computes transition readiness and carbon exposure scores from GEM tracker data.
Uses _yes_no_to_bool from carbon_problem_loader for consistent flag parsing,
and the comprehensive _REGION_MAP from green_future_loader for consistent
region assignment across both ESG pages.
"""
from __future__ import annotations
import re
import pandas as pd
import numpy as np
from typing import Optional

# ── Reuse the better flag parser from sibling loader ─────────────────────────
from services.carbon_problem_loader import _yes_no_to_bool
from services.green_future_loader import _REGION_MAP as _GREEN_REGION_MAP

# Build our own region map: same as green_future but remap "South America"
# → "Latin America" to preserve the existing Latin America heatmap column.
_REGION_MAP = {
    k: ("Latin America" if v == "South America" else v)
    for k, v in _GREEN_REGION_MAP.items()
}

_CAP_COL     = "Cement Capacity (millions metric tonnes per annum)"
_COUNTRY_COL = "Country/Area"
_OWNER_COL   = "Owner name (English)"
_STATUS_COL  = "Operating status"
_TYPE_COL    = "Production type"
_PLANT_COL   = "Plant type"
_START_COL   = "Start date"
_ALT_COL     = "Alternative Fuel"
_CCUS_COL    = "CCS/CCUS"
_CLAY_COL    = "Clay Calcination"

# Keep REGION_MAP as an alias for backwards compat (used by router /meta)
REGION_MAP = _REGION_MAP


def _parse_owner(raw: str) -> str:
    if not raw or str(raw).strip().lower() in ("nan", "n/a", "unknown", ""):
        return "Unknown"
    first = str(raw).split(";")[0].strip()
    first = re.sub(r"\s*\[\d+\.?\d*%?\]", "", first).strip()
    return first or "Unknown"


def _yn_float(val) -> float:
    """Convert yes/no to 1.0/0.0 using the robust _yes_no_to_bool parser."""
    result = _yes_no_to_bool(val)
    if result is True:
        return 1.0
    return 0.0


# ── Cache the expensive prep ──────────────────────────────────────────────────
_prep_cache: dict = {}

def _prep_df(df: pd.DataFrame, statuses: list[str] | None = None) -> pd.DataFrame:
    cache_key = tuple(sorted(statuses)) if statuses else "all"
    if cache_key in _prep_cache:
        return _prep_cache[cache_key]

    fdf = df.copy()
    if statuses:
        fdf = fdf[fdf[_STATUS_COL].astype(str).str.strip().str.lower().isin(
            [s.lower() for s in statuses]
        )]

    fdf = fdf.dropna(subset=[_CAP_COL])
    fdf[_CAP_COL] = pd.to_numeric(fdf[_CAP_COL], errors="coerce")
    fdf = fdf[fdf[_CAP_COL] > 0].copy()

    fdf["_owner"]  = fdf[_OWNER_COL].astype(str).apply(_parse_owner)
    fdf["_region"] = fdf[_COUNTRY_COL].astype(str).map(_REGION_MAP).fillna("Other")

    prod_lower  = fdf[_TYPE_COL].astype(str).str.lower()
    plant_lower = fdf[_PLANT_COL].astype(str).str.lower()

    fdf["_is_wet"]        = prod_lower.str.contains("wet", na=False).astype(float)
    fdf["_is_integrated"] = plant_lower.str.contains("integrated", na=False).astype(float)
    fdf["_is_dry"]        = prod_lower.str.contains("dry", na=False).astype(float)

    # ── Use _yes_no_to_bool for robust flag parsing ───────────────────────────
    # Handles "Yes", "YES", "yes", "Y", "y", trailing spaces, None, NaN
    # Returns True/False/None — convert to 1.0/0.0 for vectorized arithmetic
    fdf["_alt_fuel"] = fdf[_ALT_COL].apply(_yn_float)
    fdf["_ccus"]     = fdf[_CCUS_COL].apply(_yn_float)
    fdf["_clay"]     = fdf[_CLAY_COL].apply(_yn_float)

    start_year = pd.to_numeric(
        fdf[_START_COL].astype(str).str[:4], errors="coerce"
    )
    fdf["_new_plant"] = (start_year >= 2000).astype(float)

    _prep_cache[cache_key] = fdf
    return fdf


def _score_group(grp: pd.DataFrame) -> dict:
    cap = grp[_CAP_COL].sum()
    if cap == 0:
        return {}

    w = grp[_CAP_COL]
    wet_share   = (grp["_is_wet"]        * w).sum() / cap
    dry_share   = (grp["_is_dry"]        * w).sum() / cap
    integ_share = (grp["_is_integrated"] * w).sum() / cap
    alt_share   = (grp["_alt_fuel"]      * w).sum() / cap
    ccus_share  = (grp["_ccus"]          * w).sum() / cap
    clay_share  = (grp["_clay"]          * w).sum() / cap
    new_share   = (grp["_new_plant"]     * w).sum() / cap

    carbon_exp = (0.40 * wet_share + 0.30 * integ_share + 0.20 * (1 - dry_share) + 0.10 * (1 - new_share)) * 100
    readiness  = (0.30 * dry_share + 0.30 * alt_share + 0.20 * ccus_share + 0.10 * clay_share + 0.10 * new_share) * 100

    future_ready_cap = grp.loc[
        (grp["_is_dry"] == 1) & (grp["_alt_fuel"] == 1) & ((grp["_ccus"] == 1) | (grp["_clay"] == 1)),
        _CAP_COL
    ].sum()

    return {
        "total_capacity":   round(cap, 2),
        "wet_share":        round(wet_share * 100, 1),
        "dry_share":        round(dry_share * 100, 1),
        "integrated_share": round(integ_share * 100, 1),
        "alt_fuel_pct":     round(alt_share * 100, 1),
        "ccus_pct":         round(ccus_share * 100, 1),
        "clay_pct":         round(clay_share * 100, 1),
        "new_plant_pct":    round(new_share * 100, 1),
        "carbon_exposure":  round(carbon_exp, 1),
        "readiness_score":  round(readiness, 1),
        "future_ready_cap": round(future_ready_cap, 2),
    }


def compute_matrix(
    df: pd.DataFrame,
    group_by: str = "company",
    statuses: list[str] | None = None,
    regions: list[str] | None = None,
    countries: list[str] | None = None,
    min_capacity: float = 1.0,
) -> list[dict]:
    fdf = _prep_df(df, statuses)
    if regions:
        fdf = fdf[fdf["_region"].isin(regions)]
    if countries:
        fdf = fdf[fdf[_COUNTRY_COL].isin(countries)]

    key_col = "_owner" if group_by == "company" else ("_region" if group_by == "region" else _COUNTRY_COL)

    rows = []
    for key, grp in fdf.groupby(key_col):
        s = _score_group(grp)
        if not s or s["total_capacity"] < min_capacity:
            continue
        rows.append({
            "name":    key,
            "region":  grp["_region"].mode()[0] if group_by != "region" else key,
            "country": grp[_COUNTRY_COL].mode()[0] if group_by == "company" else "",
            **s,
        })
    return sorted(rows, key=lambda r: r["total_capacity"], reverse=True)


HEATMAP_REGIONS = ["Europe", "North America", "China", "APAC", "MEA", "Latin America"]

HEATMAP_TECHS = [
    {"value": "alt_fuel", "label": "Alternative Fuel"},
    {"value": "ccus",     "label": "CCUS"},
    {"value": "clay",     "label": "Clay Calcination"},
]

def compute_heatmap(
    df: pd.DataFrame,
    statuses: list[str] | None = None,
) -> dict:
    """Returns GreenHeatmapData-compatible shape so AdoptionHeatmap can be used directly."""
    fdf = _prep_df(df, statuses)
    cells = []
    for tech in HEATMAP_TECHS:
        col = f"_{tech['value']}"
        for reg in HEATMAP_REGIONS:
            rdf = fdf[fdf["_region"] == reg]
            total_cap = float(rdf[_CAP_COL].sum())
            if total_cap <= 0:
                cells.append({
                    "tech":        tech["value"],
                    "tech_label":  tech["label"],
                    "region":      reg,
                    "value":       None,
                    "cap":         0.0,
                    "highlighted": False,
                })
                continue
            enabled_cap = float((rdf[col] * rdf[_CAP_COL]).sum())
            cells.append({
                "tech":        tech["value"],
                "tech_label":  tech["label"],
                "region":      reg,
                "value":       round(enabled_cap / total_cap * 100, 1),
                "cap":         round(enabled_cap, 2),
                "highlighted": False,
            })
    return {
        "data":             cells,
        "regions":          HEATMAP_REGIONS,
        "techs":            HEATMAP_TECHS,
        "unit":             "% of regional capacity",
        "highlighted_cols": [],
    }


def compute_kpis(
    df: pd.DataFrame,
    statuses: list[str] | None = None,
    regions: list[str] | None = None,
    countries: list[str] | None = None,
) -> dict:
    fdf = _prep_df(df, statuses)
    if regions:
        fdf = fdf[fdf["_region"].isin(regions)]
    if countries:
        fdf = fdf[fdf[_COUNTRY_COL].isin(countries)]
    s = _score_group(fdf)
    return {
        "future_readiness_score": round(s.get("readiness_score", 0), 1),
        "alt_fuel_pct":           round(s.get("alt_fuel_pct", 0), 1),
        "ccus_pct":               round(s.get("ccus_pct", 0), 1),
        "future_ready_cap":       round(s.get("future_ready_cap", 0), 1),
        "total_capacity":         round(s.get("total_capacity", 0), 1),
    }