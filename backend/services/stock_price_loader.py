"""
services/stock_price_loader.py
Loads stock price xlsx into long format and computes indexed performance.
Mirrors stock_prices/company_stock_prices_page.py logic exactly.
"""
from __future__ import annotations

import datetime as dt
from functools import lru_cache
from typing import Dict, List, Optional, Tuple

import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


SHEET_NAME   = "Share price CIQ IDs (linked)"
HEADER_ROW   = 7
MAX_DATA_DATE = pd.Timestamp("2026-01-31")


@lru_cache(maxsize=1)
def get_stock_prices_df() -> pd.DataFrame:
    """
    Load stock prices into long format:
    CIQ_ID | Company | Ticker | Country | Date | Price | Year | Month
    Mirrors company_stock_prices_page.py load_stock_prices_long() exactly.
    """
    def _load() -> pd.DataFrame:
        path = settings.stock_prices_path
        wide = pd.read_excel(path, sheet_name=SHEET_NAME, header=HEADER_ROW, engine="openpyxl")

        if wide.columns.size > 0 and str(wide.columns[0]).startswith("Unnamed"):
            wide = wide.drop(columns=[wide.columns[0]])

        rename_map = {
            "CIQ IDs": "CIQ_ID",
            "Company name": "Company",
            "Ticker": "Ticker",
            "Country": "Country",
        }
        for k, v in rename_map.items():
            if k in wide.columns:
                wide = wide.rename(columns={k: v})

        date_cols = [c for c in wide.columns if isinstance(c, (pd.Timestamp, dt.datetime, dt.date))]
        if not date_cols:
            return pd.DataFrame(columns=["CIQ_ID", "Company", "Ticker", "Country", "Date", "Price", "Year", "Month"])

        id_cols = ["CIQ_ID", "Company", "Ticker", "Country"]
        long_df = wide.melt(id_vars=id_cols, value_vars=date_cols, var_name="Date", value_name="Price")
        long_df["Date"] = pd.to_datetime(long_df["Date"], errors="coerce")
        long_df["Price"] = pd.to_numeric(long_df["Price"], errors="coerce")
        long_df = long_df.dropna(subset=["Date"])
        long_df["Year"] = long_df["Date"].dt.year.astype("Int64")
        long_df["Month"] = long_df["Date"].dt.month.astype("Int64")
        long_df.loc[long_df["Price"] == 0, "Price"] = pd.NA
        return long_df

    return cached_read(settings.stock_prices_path, _load, extra=f"{SHEET_NAME}:{HEADER_ROW}")


def get_stock_years(df: pd.DataFrame) -> List[int]:
    return sorted([int(y) for y in df["Year"].dropna().unique().tolist()])


def get_stock_countries(df: pd.DataFrame) -> List[str]:
    return sorted(df["Country"].dropna().astype(str).unique().tolist())


def get_stock_companies(df: pd.DataFrame, country: Optional[str] = None) -> List[str]:
    d = df
    if country and country != "All countries":
        d = d[d["Country"] == country]
    return sorted(d["Company"].dropna().astype(str).unique().tolist())


def get_indexed_price_data(
    df: pd.DataFrame,
    companies: List[str],
    start_year: int,
    end_year: int,
    country: Optional[str] = None,
) -> Dict:
    """
    Returns indexed price series (start=100) for each company in the window.
    Mirrors company_stock_prices_page.py chart logic.
    """
    window_start = pd.Timestamp(f"{start_year}-01-01")
    window_end   = min(pd.Timestamp(f"{end_year}-12-31"), MAX_DATA_DATE)

    view = df[(df["Date"] >= window_start) & (df["Date"] <= window_end)].copy()
    if country and country != "All countries":
        view = view[view["Country"] == country]
    view = view[view["Company"].isin(companies)]
    view = view.dropna(subset=["Price"])

    x_dates = sorted(view["Date"].dropna().unique().tolist())
    series: Dict[str, List] = {}
    raw_prices: Dict[str, List] = {}
    cagr_rows = []

    for comp in companies:
        sub = view[view["Company"] == comp].sort_values("Date")
        if sub.empty:
            continue

        base_row = sub.dropna(subset=["Price"]).head(1)
        if base_row.empty:
            continue
        base_price = float(base_row["Price"].iloc[0])
        if base_price <= 0:
            continue

        price_map = {pd.Timestamp(d): v for d, v in zip(sub["Date"], sub["Price"])}
        indexed_vals = []
        price_vals   = []
        for d in x_dates:
            p = price_map.get(pd.Timestamp(d))
            if p is None or pd.isna(p):
                indexed_vals.append(None)
                price_vals.append(None)
            else:
                indexed_vals.append(round(float(p) / base_price * 100.0, 3))
                price_vals.append(round(float(p), 4))

        series[comp]     = indexed_vals
        raw_prices[comp] = price_vals

        # CAGR
        valid = sub.dropna(subset=["Price"]).sort_values("Date")
        if len(valid) >= 2:
            sp = float(valid["Price"].iloc[0])
            ep = float(valid["Price"].iloc[-1])
            sd = pd.Timestamp(valid["Date"].iloc[0])
            ed = pd.Timestamp(valid["Date"].iloc[-1])
            months = (ed.year - sd.year) * 12 + (ed.month - sd.month)
            n_years = months / 12.0
            cagr = None
            if sp > 0 and ep > 0 and n_years > 0:
                cagr = round((ep / sp) ** (1.0 / n_years) - 1.0, 6)
            cagr_rows.append({
                "Company":     comp,
                "start_date":  sd.strftime("%Y-%m-%d"),
                "end_date":    ed.strftime("%Y-%m-%d"),
                "start_price": round(sp, 4),
                "end_price":   round(ep, 4),
                "cagr":        cagr,
            })

    return {
        "dates":       [pd.Timestamp(d).strftime("%Y-%m-%d") for d in x_dates],
        "series":      series,
        "raw_prices":  raw_prices,
        "cagr":        cagr_rows,
        "window":      {"start_year": start_year, "end_year": end_year},
    }
