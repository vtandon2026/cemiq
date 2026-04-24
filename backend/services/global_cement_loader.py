"""
services/global_cement_loader.py
Loads global_cement_metrics.xlsx and returns KPI data.
Mirrors gcm/global_cement_metric_page.py logic exactly.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


GLOBAL_METRICS_SHEET = "Sheet1"


@lru_cache(maxsize=1)
def get_global_cement_df() -> pd.DataFrame:
    """
    Load global_cement_metrics.xlsx into long format:
    Country | Year | KPI | Value
    Mirrors gcm/global_cement_metric_page.py load_global_metrics_long().
    """
    def _load() -> pd.DataFrame:
        path = settings.global_cement_path
        raw = pd.read_excel(path, sheet_name=GLOBAL_METRICS_SHEET, header=None, engine="openpyxl")

        if raw.empty or raw.shape[0] < 3:
            return pd.DataFrame(columns=["Country", "Year", "KPI", "Value"])

        year_row = raw.iloc[0, :].copy()
        kpi_row  = raw.iloc[1, :].copy()
        years_ffill = year_row.ffill()

        records = []
        for r in range(2, raw.shape[0]):
            country = raw.iat[r, 0]
            if pd.isna(country):
                continue
            country = str(country).strip()
            for c in range(1, raw.shape[1]):
                yr = years_ffill.iat[c]
                kpi = kpi_row.iat[c]
                if pd.isna(yr) or pd.isna(kpi):
                    continue
                try:
                    yr_int = int(str(yr).strip())
                except Exception:
                    continue
                kpi_name = str(kpi).strip()
                value_num = pd.to_numeric(raw.iat[r, c], errors="coerce")
                records.append({"Country": country, "Year": yr_int, "KPI": kpi_name, "Value": value_num})

        return pd.DataFrame(records)

    return cached_read(settings.global_cement_path, _load, extra=GLOBAL_METRICS_SHEET)


def _should_exclude_kpi(kpi_name: str) -> bool:
    s = str(kpi_name or "").strip().lower()
    if "cement capacity" in s and ("mta" in s or "million" in s):
        return True
    if "cement consumption" in s and "per capita" in s:
        return True
    return False


def _is_percentage_kpi(kpi_name: str) -> bool:
    s = str(kpi_name or "").lower()
    return ("%" in s) or ("percent" in s) or ("percentage" in s)


def get_available_kpis(df: pd.DataFrame) -> List[str]:
    all_kpis = df["KPI"].dropna().astype(str).unique().tolist()
    return sorted([k for k in all_kpis if not _should_exclude_kpi(k)])


def get_available_countries(df: pd.DataFrame) -> List[str]:
    return sorted(df["Country"].dropna().astype(str).unique().tolist())


def get_available_years_gcm(df: pd.DataFrame) -> List[int]:
    return sorted([int(y) for y in df["Year"].dropna().unique().tolist()])


def get_timeseries_data(
    df: pd.DataFrame,
    kpi: str,
    countries: List[str],
) -> List[Dict]:
    """Returns [{Country, Year, Value}] for a time-series line chart."""
    sub = df[(df["KPI"] == kpi) & (df["Country"].isin(countries))].copy()
    sub["Value"] = pd.to_numeric(sub["Value"], errors="coerce")
    sub = sub.dropna(subset=["Value"])
    return sub[["Country", "Year", "Value"]].sort_values(["Country", "Year"]).to_dict(orient="records")


def get_point_in_time_data(
    df: pd.DataFrame,
    kpi: str,
    countries: List[str],
    year: int,
) -> List[Dict]:
    """Returns [{Country, Value}] for a bar chart at a specific year."""
    sub = df[
        (df["KPI"] == kpi) &
        (df["Country"].isin(countries)) &
        (df["Year"] == int(year))
    ].copy()
    sub["Value"] = pd.to_numeric(sub["Value"], errors="coerce")
    sub = sub.dropna(subset=["Value"]).sort_values("Value", ascending=False)
    return sub[["Country", "Value"]].to_dict(orient="records")


def compute_cagr_table(
    df: pd.DataFrame,
    kpi: str,
    countries: List[str],
    periods: Optional[List[Tuple[int, int]]] = None,
) -> List[Dict]:
    """
    Returns CAGR rows for each country x period.
    Mirrors gcm/global_cement_metric_page.py compute_cagr_with_adjustments() logic.
    """
    if periods is None:
        periods = [(2012, 2019), (2020, 2024)]

    if _is_percentage_kpi(kpi):
        return []

    def _cagr(start_val, end_val, n_years):
        try:
            if start_val is None or end_val is None or n_years <= 0:
                return None
            if start_val <= 0 or end_val <= 0:
                return None
            return (end_val / start_val) ** (1.0 / n_years) - 1.0
        except Exception:
            return None

    rows = []
    for country in countries:
        row: Dict = {"Country": country}
        sub = df[(df["KPI"] == kpi) & (df["Country"] == country)].copy()
        sub = sub.dropna(subset=["Value"]).sort_values("Year")
        sub_pos = sub[sub["Value"] > 0]

        for start, end in periods:
            col_name = f"{start}-{end}"
            s_row = sub_pos[sub_pos["Year"] == start]
            e_row = sub_pos[sub_pos["Year"] == end]
            s_shifted = e_shifted = False

            if s_row.empty:
                s_row = sub_pos[sub_pos["Year"] > start].head(1)
                s_shifted = True
            if e_row.empty:
                e_row = sub_pos[sub_pos["Year"] < end].tail(1)
                e_shifted = True

            if s_row.empty or e_row.empty:
                row[col_name] = None
                continue

            ys = int(s_row["Year"].iloc[0])
            ye = int(e_row["Year"].iloc[0])
            vs = float(s_row["Value"].iloc[0])
            ve = float(e_row["Value"].iloc[0])
            cagr = _cagr(vs, ve, ye - ys)
            row[col_name] = cagr
        rows.append(row)
    return rows
