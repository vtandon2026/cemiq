"""
services/ciq_loader.py
Loads TBD_CIQ_Company financials xlsx and exposes KPI computation.
Wraps cld/ciq_helpers.py logic for FastAPI use.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Dict, List, Optional

import numpy as np
import pandas as pd

from core.config import settings
from services.cache_utils import cached_read


CIQ_SHEET = "CIQ IDs (Linked)"


@lru_cache(maxsize=1)
def get_ciq_long_df() -> pd.DataFrame:
    """
    Load CIQ financials into long format:
    CIQ_ID | Company | Ticker | Country | Metric | Year | Value | AsOf
    Mirrors cld/ciq_helpers.load_ciq_ids_linked() exactly.
    """

    def _load() -> pd.DataFrame:
        path = settings.ciq_financials_path
        raw = pd.read_excel(path, sheet_name=CIQ_SHEET, header=None, engine="calamine")

        ciq_id_col, name_col, ticker_col, country_col = 1, 2, 3, 4
        metric_row = raw.iloc[1, :].copy()
        subhdr_row = raw.iloc[2, :].copy()

        if raw.shape[1] > 6:
            metric_row.iloc[6:] = metric_row.iloc[6:].ffill()

        def _parse_year_and_asof(sub_val: str):
            s = (sub_val or "").strip()
            if not s:
                return None, None
            if s.startswith("FY"):
                try:
                    return int(s.replace("FY", "")), None
                except Exception:
                    return None, None
            try:
                ts = pd.to_datetime(s, errors="coerce")
                if pd.notna(ts):
                    return int(ts.year), ts.strftime("%Y-%m-%d")
            except Exception:
                pass
            m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
            if m:
                yy = int(m.group(3))
                if yy < 100:
                    yy += 2000
                return yy, f"{yy:04d}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
            return None, None

        records = []
        for j in range(6, raw.shape[1]):
            metric = metric_row.iloc[j]
            sub = subhdr_row.iloc[j]
            if pd.isna(metric) or pd.isna(sub):
                continue
            metric = str(metric).strip()
            sub = str(sub).strip()
            year, asof = _parse_year_and_asof(sub)
            if year is None:
                continue

            for i in range(3, raw.shape[0]):
                ciq_id = raw.iloc[i, ciq_id_col]
                if pd.isna(ciq_id):
                    continue
                records.append({
                    "CIQ_ID": str(ciq_id).strip(),
                    "Company": str(raw.iloc[i, name_col]).strip() if not pd.isna(raw.iloc[i, name_col]) else "",
                    "Ticker": str(raw.iloc[i, ticker_col]).strip() if not pd.isna(raw.iloc[i, ticker_col]) else "",
                    "Country": str(raw.iloc[i, country_col]).strip() if not pd.isna(raw.iloc[i, country_col]) else "",
                    "Metric": metric,
                    "Year": year,
                    "Value": raw.iloc[i, j],
                    "AsOf": asof,
                })

        df = pd.DataFrame.from_records(records)
        if df.empty:
            return df
        df["Year"] = pd.to_numeric(df["Year"], errors="coerce").astype("Int64")
        df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
        df["AsOf"] = df["AsOf"].astype("string")
        return df

    return cached_read(settings.ciq_financials_path, _load, extra=CIQ_SHEET)


def get_available_years(long_df: pd.DataFrame) -> List[int]:
    return sorted([int(y) for y in long_df["Year"].dropna().unique().tolist()])


def get_companies(long_df: pd.DataFrame, country: Optional[str] = None) -> List[str]:
    df = long_df
    if country and country != "All":
        df = df[df["Country"].astype(str) == country]
    return sorted(df["Company"].dropna().astype(str).unique().tolist())


def get_countries_ciq(long_df: pd.DataFrame) -> List[str]:
    return sorted(long_df["Country"].dropna().astype(str).unique().tolist())


def wide_for_year(long_df: pd.DataFrame, year: int) -> pd.DataFrame:
    df = long_df[long_df["Year"].astype(int) == int(year)].copy()
    if df.empty:
        return pd.DataFrame()
    wide = (
        df.pivot_table(
            index=["CIQ_ID", "Company", "Ticker", "Country"],
            columns="Metric",
            values="Value",
            aggfunc="first",
        )
        .reset_index()
    )
    wide.columns.name = None
    return wide


@lru_cache(maxsize=32)
def get_ciq_wide_df_for_year(year: int) -> pd.DataFrame:
    return wide_for_year(get_ciq_long_df(), year)


def _safe_div(n: pd.Series, d: pd.Series) -> pd.Series:
    n = pd.to_numeric(n, errors="coerce")
    d = pd.to_numeric(d, errors="coerce")
    out = n / d
    out[(d == 0) | d.isna() | n.isna()] = np.nan
    return out


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _find_col(w: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    cols = {_norm(c): c for c in w.columns}
    for cand in candidates:
        key = _norm(cand)
        if key in cols:
            return cols[key]
    return None


def _to_fraction_if_percent(s: pd.Series) -> pd.Series:
    v = pd.to_numeric(s, errors="coerce")
    med = v.dropna().abs().median()
    if pd.notna(med) and med > 1.5:
        return v / 100.0
    return v


def compute_metrics(wide: pd.DataFrame) -> pd.DataFrame:
    """
    Derives all KPI columns from raw CIQ wide table.
    Mirrors cld/ciq_helpers._compute_metrics() exactly.
    """
    w = wide.copy()

    revenue_col = _find_col(w, ["Revenue ($ mn)", "Total Revenue"])
    ebit_col = _find_col(w, ["EBIT ($ mn)", "Operating Income", "EBIT"])
    ebitda_col = _find_col(w, ["EBITDA ($ mn)"])
    assets_col = _find_col(w, ["Total Assets ($ mn)", "Total Assets"])
    capex_col = _find_col(w, ["Capital expenditure ($ mn)", "Capex ($ mn)", "CAPEX ($ mn)"])
    opcf_col = _find_col(w, ["Operating cashflow ($ mn)", "Operating cash flow ($ mn)"])
    net_debt_col = _find_col(w, ["Net debt ($ mn)", "Net Debt", "Net Debt ($ mn)"])
    emp_col = _find_col(w, ["Full-time employees", "Full-Time Employees", "Employees"])
    da_col = _find_col(w, [
        "Depreciation and Amortization, Total ($ mn) (from Income Statement)",
        "Depreciation and Amortization, Total ($ mn) (from Cashflow Statement)",
    ])
    market_cap_col = _find_col(w, ["Market Capitalisation", "Market Capitalization", "Market capitalization ($ mn)"])
    ev_col = _find_col(w, ["Enterprise Value (Total)", "Enterprise Value", "Enterprise value ($ mn)"])
    fcf_col = _find_col(w, ["Free Cash Flow (Unlevered)", "Free Cash Flow", "Free cash flow ($ mn)"])
    ev_ebitda_col = _find_col(w, [
        "Enterprise Value to Earnings Before Interest, Taxes, Depreciation, and Amortization Multiple",
        "EV / EBITDA", "EV/EBITDA",
    ])
    pe_col = _find_col(w, ["Price to Earning Ratio", "P/E", "PE Ratio"])
    roic_col = _find_col(w, ["Return on Invested Capital ( %)", "Return on Invested Capital (%)", "ROIC (%)"])
    roce_col = _find_col(w, ["Return on Capital Employed ( %)", "Return on Capital Employed (%)", "ROCE (%)"])
    roa_col = _find_col(w, ["Return on Assets ( %)", "Return on Assets (%)", "ROA (%)"])
    asset_turnover_col = _find_col(w, ["Assets Turnover Ratio", "Asset Turnover Ratio"])
    net_ppe_col = _find_col(w, ["Net property , Plant and Equipment", "Net Property, Plant and Equipment", "Net PP&E"])
    ndebt_ebitda_col = _find_col(w, [
        "Net Debt to Earnings Before Interest, Taxes, Depreciation, and Amortization Ratio",
        "Net Debt / EBITDA", "Net debt / EBITDA",
    ])
    debt_to_equity_col = _find_col(w, ["Total Debt/Equity %", "Debt-to-Equity Ratio"])
    interest_cov_col = _find_col(w, ["Interest Coverage Ratio", "Interest Coverage"])
    interest_exp_col = _find_col(w, ["Interest expense ($ mn)", "Interest Expense ($ mn)"])
    st_debt_col = _find_col(w, ["Short term Borrowings", "Short-term debt ($ mn)"])
    total_debt_col = _find_col(w, ["Total Debt ($ mn)", "Total Debt"])

    ebitda_margin_col = _find_col(w, ["EBITDA Margin ( %)", "EBITDA Margin (%)"])

    if ebitda_margin_col:
        w["EBITDA margin"] = _to_fraction_if_percent(w[ebitda_margin_col])
    else:
        denom = w[revenue_col] if revenue_col else np.nan
        num = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else np.nan)
        w["EBITDA margin"] = _safe_div(num, denom) if revenue_col and (ebitda_col or ebit_col) else np.nan

    w["Operating profit margin"] = _safe_div(w[ebit_col], w[revenue_col]) * 100 if (ebit_col and revenue_col) else np.nan
    denom_cash = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else None)
    w["Cash conversion"] = _safe_div(w[opcf_col], denom_cash) if (opcf_col and denom_cash is not None) else np.nan
    w["CAPEX intensity"] = _safe_div(w[capex_col], w[revenue_col]) if (capex_col and revenue_col) else np.nan
    w["Net debt ($ mn)"] = w[net_debt_col] if net_debt_col else np.nan
    w["Market capitalization ($ mn)"] = w[market_cap_col] if market_cap_col else np.nan

    if ev_col:
        w["Enterprise value ($ mn)"] = w[ev_col]
    elif market_cap_col and net_debt_col:
        w["Enterprise value ($ mn)"] = pd.to_numeric(w[market_cap_col], errors="coerce") + pd.to_numeric(w[net_debt_col], errors="coerce")
    else:
        w["Enterprise value ($ mn)"] = np.nan

    w["ROIC (%)"] = pd.to_numeric(w[roic_col], errors="coerce") if roic_col else np.nan
    w["ROCE (%)"] = _to_fraction_if_percent(w[roce_col]) if roce_col else np.nan
    w["ROA (%)"] = _to_fraction_if_percent(w[roa_col]) if roa_col else np.nan

    w["Asset turnover"] = (
        pd.to_numeric(w[asset_turnover_col], errors="coerce") if asset_turnover_col
        else (_safe_div(w[revenue_col], w[assets_col]) if (revenue_col and assets_col) else np.nan)
    )

    w["Net PP&E ($ mn)"] = w[net_ppe_col] if net_ppe_col else np.nan

    w["Net debt / EBITDA"] = (
        pd.to_numeric(w[ndebt_ebitda_col], errors="coerce") if ndebt_ebitda_col
        else (_safe_div(w["Net debt ($ mn)"], w[ebitda_col]) if (net_debt_col and ebitda_col) else np.nan)
    )

    w["Debt-to-equity"] = pd.to_numeric(w[debt_to_equity_col], errors="coerce") if debt_to_equity_col else np.nan
    w["Interest coverage"] = (
        pd.to_numeric(w[interest_cov_col], errors="coerce") if interest_cov_col
        else (_safe_div(w[ebit_col], w[interest_exp_col]) if (ebit_col and interest_exp_col) else np.nan)
    )

    if st_debt_col and total_debt_col:
        w["% short-term debt"] = _safe_div(w[st_debt_col], w[total_debt_col])
    else:
        w["% short-term debt"] = np.nan

    w["Operating cash flow ($ mn)"] = w[opcf_col] if opcf_col else np.nan

    if fcf_col:
        w["Free cash flow ($ mn)"] = w[fcf_col]
    elif opcf_col and capex_col:
        w["Free cash flow ($ mn)"] = pd.to_numeric(w[opcf_col], errors="coerce") - pd.to_numeric(w[capex_col], errors="coerce")
    else:
        w["Free cash flow ($ mn)"] = np.nan

    w["FCF / EBITDA"] = _safe_div(w["Free cash flow ($ mn)"], denom_cash) if denom_cash is not None else np.nan

    w["EV / EBITDA"] = (
        pd.to_numeric(w[ev_ebitda_col], errors="coerce") if ev_ebitda_col
        else (_safe_div(w["Enterprise value ($ mn)"], denom_cash) if denom_cash is not None else np.nan)
    )

    w["P/E"] = pd.to_numeric(w[pe_col], errors="coerce") if pe_col else np.nan

    if emp_col:
        w["Full-time employees"] = pd.to_numeric(w[emp_col], errors="coerce")
        base_ebitda = w[ebitda_col] if ebitda_col else w.get(ebit_col, pd.Series(dtype=float))
        w["EBITDA per Employee (USD '000)"] = _safe_div(pd.to_numeric(base_ebitda, errors="coerce") * 1000.0, w[emp_col]).round(0)
        w["Revenue per Employee (USD '000)"] = _safe_div(pd.to_numeric(w[revenue_col], errors="coerce") * 1000.0, w[emp_col]).round(0) if revenue_col else np.nan
        w["Operating Cash Flow per Employee (USD '000)"] = _safe_div(pd.to_numeric(w[opcf_col], errors="coerce") * 1000.0, w[emp_col]).round(0) if opcf_col else np.nan
        w["Net PP&E per Employee (USD '000)"] = _safe_div(pd.to_numeric(w[net_ppe_col], errors="coerce") * 1000.0, w[emp_col]).round(0) if net_ppe_col else np.nan
        w["Labor intensity (FTE per $ mn revenue)"] = _safe_div(w[emp_col], w[revenue_col]) if revenue_col else np.nan
    else:
        for col in [
            "Full-time employees",
            "EBITDA per Employee (USD '000)",
            "Revenue per Employee (USD '000)",
            "Operating Cash Flow per Employee (USD '000)",
            "Net PP&E per Employee (USD '000)",
            "Labor intensity (FTE per $ mn revenue)",
        ]:
            w[col] = np.nan

    w["_Revenue"] = w[revenue_col] if revenue_col else np.nan
    w["_EBIT"] = w[ebit_col] if ebit_col else np.nan
    w["_EBITDA"] = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else np.nan)
    w["_Employees"] = w[emp_col] if emp_col else np.nan
    w["_Assets"] = w[assets_col] if assets_col else np.nan
    w["_DA"] = w[da_col] if da_col else np.nan
    w["_OpCF"] = w[opcf_col] if opcf_col else np.nan
    w["_CAPEX"] = w[capex_col] if capex_col else np.nan

    return w


@lru_cache(maxsize=32)
def get_ciq_metrics_df_for_year(year: int) -> pd.DataFrame:
    wide = get_ciq_wide_df_for_year(year)
    if wide is None or wide.empty:
        return pd.DataFrame()
    return compute_metrics(wide)


def compute_yoy_growth(long_df: pd.DataFrame, metric: str, year: int) -> pd.DataFrame:
    """YoY growth for a metric into selected year."""
    df = long_df[long_df["Metric"].astype(str).str.strip() == str(metric).strip()].copy()
    if df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "YoY Growth"])

    pivot = df.pivot_table(index=["CIQ_ID", "Company"], columns="Year", values="Value", aggfunc="first")
    if (year not in pivot.columns) or ((year - 1) not in pivot.columns):
        return pd.DataFrame(columns=["CIQ_ID", "Company", "YoY Growth"])

    cur = pd.to_numeric(pivot[year], errors="coerce")
    prev = pd.to_numeric(pivot[year - 1], errors="coerce")
    yoy = ((cur - prev) / prev) * 100
    yoy[(prev <= 0) | prev.isna() | cur.isna()] = np.nan

    out = yoy.reset_index()
    out["YoY Growth"] = yoy.values
    return out[["CIQ_ID", "Company", "YoY Growth"]]


def build_timeseries(
    long_df: pd.DataFrame,
    years: List[int],
    companies: List[str],
    value_col: str,
    country: Optional[str] = None,
) -> List[Dict]:
    """Build tidy time-series list for line charts."""
    rows = []
    for y in sorted(years):
        df = get_ciq_metrics_df_for_year(int(y)).copy()
        if df.empty:
            continue
        if country and country != "All" and "Country" in df.columns:
            df = df[df["Country"].astype(str) == country].copy()
        df = df[df["Company"].astype(str).isin(companies)].copy()
        if df.empty or value_col not in df.columns:
            continue
        df["Value"] = pd.to_numeric(df[value_col], errors="coerce")
        df = df.dropna(subset=["Value"])
        for _, r in df.iterrows():
            rows.append({
                "Year": int(y),
                "Company": str(r.get("Company", "")),
                "Ticker": str(r.get("Ticker", "")),
                "Country": str(r.get("Country", "")),
                "Value": float(r["Value"]),
            })
    return rows
