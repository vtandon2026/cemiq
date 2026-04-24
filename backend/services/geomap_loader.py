"""
services/geomap_loader.py
Loads US Cement capacity xlsx for the GeoMap page.
Mirrors geomap/geomap.py data logic exactly.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


@lru_cache(maxsize=1)
def get_geomap_df() -> pd.DataFrame:
    def _load() -> pd.DataFrame:
        df_raw = pd.read_excel(settings.us_capacity_path, engine="openpyxl")
        df_raw.columns = [str(c).strip() for c in df_raw.columns]

        df = pd.DataFrame({
            "company":              df_raw.get("Group Name"),
            "plant":                df_raw.get("Facility Name"),
            "chart_name":           df_raw.get("Chart Name (Clean)"),
            "cement_capacity_mta":  df_raw.get("Cement Capacity (Mta)"),
            "cement_type":          df_raw.get("Cement Type"),
            "state":                df_raw.get("State"),
            "city":                 df_raw.get("City"),
            "us_region":            df_raw.get("US Region"),
            "lat":                  df_raw.get("Latitude"),
            "lon":                  df_raw.get("Longitude"),
            "status":               df_raw.get("Status"),
        })

        df["cement_capacity_mta"] = pd.to_numeric(df["cement_capacity_mta"], errors="coerce")
        df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
        df["lon"] = pd.to_numeric(df["lon"], errors="coerce")
        df = df.dropna(subset=["company", "plant", "lat", "lon"])
        return df

    return cached_read(settings.us_capacity_path, _load, extra="geomap_v1")


def get_all_companies(df: pd.DataFrame) -> List[str]:
    return sorted(df["company"].dropna().astype(str).unique().tolist())


def get_capacity_range(df: pd.DataFrame) -> Tuple[float, float]:
    return (
        float(df["cement_capacity_mta"].min()),
        float(df["cement_capacity_mta"].max()),
    )


def filter_plants(
    df: pd.DataFrame,
    companies: Optional[List[str]] = None,
    cap_min: Optional[float] = None,
    cap_max: Optional[float] = None,
    status: Optional[List[str]] = None,
    cement_type: Optional[List[str]] = None,
    us_region: Optional[List[str]] = None,
) -> pd.DataFrame:
    result = df.copy()
    if companies:
        result = result[result["company"].isin(companies)]
    if cap_min is not None:
        result = result[result["cement_capacity_mta"] >= cap_min]
    if cap_max is not None:
        result = result[result["cement_capacity_mta"] <= cap_max]
    if status:
        result = result[result["status"].isin(status)]
    if cement_type:
        result = result[result["cement_type"].isin(cement_type)]
    if us_region:
        result = result[result["us_region"].isin(us_region)]
    return result


def get_plants_geojson(df: pd.DataFrame) -> List[Dict]:
    """Return plant records suitable for deck.gl ScatterplotLayer."""
    return df[[
        "company", "plant", "cement_capacity_mta", "cement_type",
        "state", "city", "us_region", "lat", "lon", "status",
    ]].dropna(subset=["lat", "lon"]).to_dict(orient="records")


def build_mekko_data(
    df: pd.DataFrame,
    top_n_state: int = 5,
    state_share_cutoff: float = 0.0,
) -> List[Dict]:
    """
    Returns aggregated [{US Region, State, Producer, Capacity, StateTotal, Share}]
    for the US Mekko chart. Mirrors usmekko/usemekko_chart.py build_mekko_data().
    """
    import numpy as np

    g = (
        df.groupby(["us_region", "state", "company"], as_index=False)["cement_capacity_mta"]
        .sum()
        .rename(columns={"company": "Producer", "cement_capacity_mta": "Capacity",
                          "us_region": "US Region", "state": "State"})
    )
    if g.empty:
        return []

    g["StateTotal"] = g.groupby(["US Region", "State"])["Capacity"].transform("sum")
    g["StateShare"]  = g["Capacity"] / g["StateTotal"]
    g["StateRank"]   = g.groupby(["US Region", "State"])["Capacity"].rank(method="first", ascending=False)

    keep = (g["StateRank"] <= top_n_state)
    if state_share_cutoff > 0:
        keep = keep | (g["StateShare"] >= state_share_cutoff / 100.0)

    g["Producer"] = np.where(keep, g["Producer"], "Other")
    g2 = (
        g.groupby(["US Region", "State", "Producer"], as_index=False)["Capacity"]
        .sum()
    )
    g2 = g2[~((g2["Producer"] == "Other") & (g2["Capacity"] <= 0))].copy()
    g2["StateTotal"] = g2.groupby(["US Region", "State"])["Capacity"].transform("sum")
    g2["Share"]      = g2["Capacity"] / g2["StateTotal"]

    return g2.to_dict(orient="records")
