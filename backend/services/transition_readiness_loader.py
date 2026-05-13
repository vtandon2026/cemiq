"""
services/transition_readiness_loader.py
Computes transition readiness and carbon exposure scores from GEM tracker data.
"""
from __future__ import annotations
import re
import pandas as pd
import numpy as np
from typing import Optional

_CAP_COL    = "Cement Capacity (millions metric tonnes per annum)"
_COUNTRY_COL = "Country/Area"
_OWNER_COL  = "Owner name (English)"
_STATUS_COL = "Operating status"
_TYPE_COL   = "Production type"   # wet / dry
_PLANT_COL  = "Plant type"        # integrated / grinding
_START_COL  = "Start date"
_ALT_COL    = "Alternative Fuel"
_CCUS_COL   = "CCS/CCUS"
_CLAY_COL   = "Clay Calcination"

REGION_MAP = {
    "Germany": "Europe", "France": "Europe", "United Kingdom": "Europe",
    "Italy": "Europe", "Spain": "Europe", "Poland": "Europe",
    "Netherlands": "Europe", "Belgium": "Europe", "Austria": "Europe",
    "Switzerland": "Europe", "Sweden": "Europe", "Norway": "Europe",
    "Denmark": "Europe", "Finland": "Europe", "Portugal": "Europe",
    "Greece": "Europe", "Czech Republic": "Europe", "Romania": "Europe",
    "Hungary": "Europe", "Slovakia": "Europe", "Croatia": "Europe",
    "Bulgaria": "Europe", "Slovenia": "Europe", "Serbia": "Europe",
    "Ukraine": "Europe", "Russia": "Europe", "Belarus": "Europe",
    "Turkey": "Europe",
    "United States": "North America", "United States of America": "North America",
    "Canada": "North America", "Mexico": "North America",
    "China": "China",
    "India": "APAC", "Japan": "APAC", "South Korea": "APAC",
    "Australia": "APAC", "Indonesia": "APAC", "Thailand": "APAC",
    "Vietnam": "APAC", "Malaysia": "APAC", "Philippines": "APAC",
    "Pakistan": "APAC", "Bangladesh": "APAC", "Sri Lanka": "APAC",
    "Taiwan": "APAC", "Singapore": "APAC", "New Zealand": "APAC",
    "Cambodia": "APAC", "Myanmar": "APAC", "Mongolia": "APAC",
    "Kazakhstan": "APAC", "Uzbekistan": "APAC", "Azerbaijan": "APAC",
    "Egypt": "MEA", "Nigeria": "MEA", "South Africa": "MEA",
    "Morocco": "MEA", "Algeria": "MEA", "Kenya": "MEA",
    "Ethiopia": "MEA", "Tanzania": "MEA", "Ghana": "MEA",
    "Angola": "MEA", "Mozambique": "MEA", "Zambia": "MEA",
    "Cameroon": "MEA", "Tunisia": "MEA",
    "Saudi Arabia": "MEA", "United Arab Emirates": "MEA", "Iran": "MEA",
    "Iraq": "MEA", "Kuwait": "MEA", "Qatar": "MEA",
    "Bahrain": "MEA", "Oman": "MEA", "Israel": "MEA",
    "Brazil": "Latin America", "Argentina": "Latin America",
    "Colombia": "Latin America", "Peru": "Latin America",
    "Chile": "Latin America", "Bolivia": "Latin America",
    "Ecuador": "Latin America", "Uruguay": "Latin America",
    "Panama": "Latin America", "Dominican Republic": "Latin America",
}

def _get_region(country: str) -> str:
    return REGION_MAP.get(country, "Other")

def _parse_owner(raw: str) -> str:
    if not raw or str(raw).strip().lower() in ("nan", "n/a", "unknown", ""):
        return "Unknown"
    first = str(raw).split(";")[0].strip()
    first = re.sub(r"\s*\[\d+\.?\d*%?\]", "", first).strip()
    return first or "Unknown"

def _yn(val: str) -> float:
    v = str(val).strip().lower()
    if v == "yes": return 1.0
    if v == "no":  return 0.0
    return 0.0

def _normalize(series: pd.Series) -> pd.Series:
    mn, mx = series.min(), series.max()
    if mx == mn: return pd.Series(50.0, index=series.index)
    return (series - mn) / (mx - mn) * 100

def _prep_df(df: pd.DataFrame, statuses: list[str] | None = None) -> pd.DataFrame:
    import logging
    logging.getLogger("cemiq").info(f"GEM all columns: {list(df.columns)}")
    logging.getLogger("cemiq").info(f"Production type values: {df['Production type'].dropna().unique().tolist()[:10]}")
    logging.getLogger("cemiq").info(f"Plant type values: {df['Plant type'].dropna().unique().tolist()[:10]}")
    logging.getLogger("cemiq").info(f"CCS/CCUS values: {df['CCS/CCUS'].dropna().unique().tolist()}")
    logging.getLogger("cemiq").info(f"Alternative Fuel values: {df['Alternative Fuel'].dropna().unique().tolist()}")
    logging.getLogger("cemiq").info(f"Clay Calcination values: {df['Clay Calcination'].dropna().unique().tolist()}")
    logging.getLogger("cemiq").info(f"Operating status values: {df['Operating status'].dropna().unique().tolist()[:10]}")
    fdf = df.copy()
    if statuses:
        fdf = fdf[fdf[_STATUS_COL].astype(str).str.strip().str.lower().isin([s.lower() for s in statuses])]
    fdf = fdf.dropna(subset=[_CAP_COL])
    fdf[_CAP_COL] = pd.to_numeric(fdf[_CAP_COL], errors="coerce")
    fdf = fdf[fdf[_CAP_COL] > 0]
    fdf["_owner"]  = fdf[_OWNER_COL].apply(_parse_owner)
    fdf["_region"] = fdf[_COUNTRY_COL].apply(_get_region)
    fdf["_is_wet"]        = fdf[_TYPE_COL].astype(str).str.lower().str.contains("wet").astype(float)
    fdf["_is_integrated"] = fdf[_PLANT_COL].astype(str).str.lower().str.contains("integrated").astype(float)
    fdf["_is_dry"]        = fdf[_TYPE_COL].astype(str).str.lower().str.contains("dry").astype(float)
    fdf["_alt_fuel"]      = fdf[_ALT_COL].apply(_yn)
    fdf["_ccus"]          = fdf[_CCUS_COL].apply(_yn)
    fdf["_clay"]          = fdf[_CLAY_COL].apply(_yn)
    fdf["_start"]         = pd.to_numeric(fdf[_START_COL].astype(str).str[:4], errors="coerce")
    fdf["_new_plant"]     = (fdf["_start"] >= 2000).astype(float)
    return fdf

def _score_group(grp: pd.DataFrame) -> dict:
    cap = grp[_CAP_COL].sum()
    if cap == 0: return {}
    def wshare(col): return (grp[col] * grp[_CAP_COL]).sum() / cap

    wet_share  = wshare("_is_wet")
    dry_share  = wshare("_is_dry")
    integ_share= wshare("_is_integrated")
    alt_share  = wshare("_alt_fuel")
    ccus_share = wshare("_ccus")
    clay_share = wshare("_clay")
    new_share  = wshare("_new_plant")

    carbon_exp = (0.40 * wet_share + 0.30 * integ_share + 0.20 * (1 - dry_share) + 0.10 * (1 - new_share)) * 100
    readiness  = (0.30 * dry_share + 0.30 * alt_share + 0.20 * ccus_share + 0.10 * clay_share + 0.10 * new_share) * 100
    future_ready_cap = grp.loc[
        (grp["_is_dry"] == 1) & (grp["_alt_fuel"] == 1) & ((grp["_ccus"] == 1) | (grp["_clay"] == 1)),
        _CAP_COL
    ].sum()

    return {
        "total_capacity":    round(cap, 2),
        "wet_share":         round(wet_share * 100, 1),
        "dry_share":         round(dry_share * 100, 1),
        "integrated_share":  round(integ_share * 100, 1),
        "alt_fuel_pct":      round(alt_share * 100, 1),
        "ccus_pct":          round(ccus_share * 100, 1),
        "clay_pct":          round(clay_share * 100, 1),
        "new_plant_pct":     round(new_share * 100, 1),
        "carbon_exposure":   round(carbon_exp, 1),
        "readiness_score":   round(readiness, 1),
        "future_ready_cap":  round(future_ready_cap, 2),
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


def compute_heatmap(
    df: pd.DataFrame,
    statuses: list[str] | None = None,
) -> list[dict]:
    fdf = _prep_df(df, statuses)
    regions = ["Europe", "North America", "China", "APAC", "MEA", "Latin America"]
    techs = ["alt_fuel", "ccus", "clay"]
    rows = []
    for tech in techs:
        col = f"_{tech}" if tech != "alt_fuel" else "_alt_fuel"
        row = {"technology": tech}
        for reg in regions:
            rdf = fdf[fdf["_region"] == reg]
            cap = rdf[_CAP_COL].sum()
            val = ((rdf[col] * rdf[_CAP_COL]).sum() / cap * 100) if cap > 0 else 0
            row[reg] = round(val, 1)
        rows.append(row)
    return rows


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