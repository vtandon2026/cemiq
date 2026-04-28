# cld/ciq_helpers.py
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import re

import base64
import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

# --------------------------------------------------------------------------------------
# Paths / assets
# --------------------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
BAIN_LOGO_PATH = SCRIPT_DIR.parent / "bainlogo.png"
BCN_LOGO_PATH = SCRIPT_DIR.parent / "bcnlogo.png"

# --------------------------------------------------------------------------------------
# Data loading
# --------------------------------------------------------------------------------------

@st.cache_data(show_spinner=False)
def load_ciq_ids_linked(path: Path) -> pd.DataFrame:
    """
    Load the CIQ export tab 'CIQ IDs (Linked)' into a long table:

        CIQ_ID | Company | Ticker | Country | Description | Metric | Year | Value

    The sheet structure is:
      - Row 1: metric names (starting col 6)
      - Row 2: sub-headers such as FY2020, FY2021...
      - Row 3+: company rows

    The CIQ export uses *wide blocks* where the metric name appears only once per
    block (e.g., the metric name appears above FY2020 but is blank above FY2021..FY2025).
    We forward-fill metric names across each block.

    The export also includes point-in-time columns (typically dated 12/31/YYYY) for
    market data fields. Per project convention, we treat these as FYYYYY and flag
    them so pages can add a footnote ("Data as of 12/31/YYYY treated as FYYYYY").
    """
    raw = pd.read_excel(path, sheet_name="CIQ IDs (Linked)", header=None)

    # Basic company id columns
    ciq_id_col = 1
    name_col = 2
    ticker_col = 3
    country_col = 4
    desc_col = 5

    metric_row = raw.iloc[1, :].copy()
    subhdr_row = raw.iloc[2, :].copy()

    # Forward-fill metric names across wide FY/date blocks
    if raw.shape[1] > 6:
        metric_row.iloc[6:] = metric_row.iloc[6:].ffill()

    records: list[dict] = []
    # Helper: detect / parse subheaders
    def _parse_year_and_asof(sub_val: str) -> tuple[Optional[int], Optional[str]]:
        s = (sub_val or "").strip()
        if not s:
            return None, None

        if s.startswith("FY"):
            try:
                return int(s.replace("FY", "")), None
            except Exception:
                return None, None

        # Point-in-time: often comes through as an Excel datetime (stringified)
        try:
            ts = pd.to_datetime(s, errors="coerce")
            if pd.notna(ts):
                return int(ts.year), ts.strftime("%Y-%m-%d")
        except Exception:
            pass

        # Fallback patterns: 12/31/20 or 12/31/2020
        m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s)
        if m:
            yy = int(m.group(3))
            if yy < 100:
                yy += 2000
            return yy, f"{yy:04d}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"

        return None, None

    records: list[dict] = []
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

            rec = {
                "CIQ_ID": str(ciq_id).strip(),
                "Company": str(raw.iloc[i, name_col]).strip() if not pd.isna(raw.iloc[i, name_col]) else "",
                "Ticker": str(raw.iloc[i, ticker_col]).strip() if not pd.isna(raw.iloc[i, ticker_col]) else "",
                "Country": str(raw.iloc[i, country_col]).strip() if not pd.isna(raw.iloc[i, country_col]) else "",
                "Description": str(raw.iloc[i, desc_col]).strip() if not pd.isna(raw.iloc[i, desc_col]) else "",
                "Metric": metric,
                "Year": year,
                "Value": raw.iloc[i, j],
                "AsOf": asof,  # None for FY-series; YYYY-MM-DD for point-in-time fields
            }
            records.append(rec)

    df = pd.DataFrame.from_records(records)
    if df.empty:
        return df

    df["Year"] = pd.to_numeric(df["Year"], errors="coerce").astype("Int64")
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
    df["AsOf"] = df["AsOf"].astype("string")
    return df


def _wide_for_year(long_df: pd.DataFrame, year: int) -> pd.DataFrame:
    """
    Pivot long table to a wide, one-row-per-company table for a given year.
    """
    df = long_df[long_df["Year"].astype(int) == int(year)].copy()
    if df.empty:
        return pd.DataFrame()

    wide = (
        df.pivot_table(
            index=["CIQ_ID", "Company", "Ticker", "Country", "Description"],
            columns="Metric",
            values="Value",
            aggfunc="first",
        )
        .reset_index()
    )
    wide.columns.name = None
    return wide


# --------------------------------------------------------------------------------------
# Helpers: robust column handling + normalization
# --------------------------------------------------------------------------------------

def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _find_col(w: pd.DataFrame, candidates: List[str]) -> Optional[str]:
    """Find a column by exact match (case/space-insensitive)."""
    if w is None or w.empty:
        return None
    cols = { _norm(c): c for c in w.columns }
    for cand in candidates:
        key = _norm(cand)
        if key in cols:
            return cols[key]
    return None


def _find_col_contains(w: pd.DataFrame, substrings: List[str]) -> Optional[str]:
    """Find a column by substring match (case/space-insensitive)."""
    if w is None or w.empty:
        return None
    subs = [_norm(s) for s in substrings]
    for col in w.columns:
        nc = _norm(col)
        if any(s in nc for s in subs):
            return col
    return None


def _to_fraction_if_percent(s: pd.Series) -> pd.Series:
    """
    Normalize percent-like fields:
      - If values look like 12.5 (=12.5%), convert to 0.125
      - If values already look like 0.125, keep as-is
    """
    v = pd.to_numeric(s, errors="coerce")
    med = v.dropna().abs().median()
    if pd.notna(med) and med > 1.5:
        return v / 100.0
    return v


def _pick_da_column(w: pd.DataFrame) -> Optional[str]:
    # Prefer Income Statement D&A, otherwise Cashflow Statement D&A
    cand = [
        "Depreciation and Amortization, Total ($ mn) (from Income Statement)",
        "Depreciation and Amortization, Total ($ mn) (from Cashflow Statement)",
        "D&A ($ mn)",
        "Depreciation & Amortization ($ mn)",
    ]
    return _find_col(w, cand)


def safe_div(n: pd.Series, d: pd.Series) -> pd.Series:
    n = pd.to_numeric(n, errors="coerce")
    d = pd.to_numeric(d, errors="coerce")
    out = n / d
    out[(d == 0) | d.isna() | n.isna()] = np.nan
    return out


# --------------------------------------------------------------------------------------
# KPI computation (single source of truth)
# --------------------------------------------------------------------------------------

def _compute_metrics(wide: pd.DataFrame) -> pd.DataFrame:
    """
    Compute derived metrics with robust column mapping to CIQ export labels.
    This function is designed to be globally compatible across all dashboard pages.
    """
    w = wide.copy()

    # ----- Canonical raw fields (with broad CIQ label mapping) -----
    revenue_col = _find_col(w, ["Revenue ($ mn)", "Total Revenue"])
    ebit_col = _find_col(w, ["EBIT ($ mn)", "Operating Income", "EBIT"])
    ebitda_col = _find_col(w, ["EBITDA ($ mn)"])
    assets_col = _find_col(w, ["Total Assets ($ mn)", "Total Assets"])
    capex_col = _find_col(w, ["Capital expenditure ($ mn)", "Capex ($ mn)", "CAPEX ($ mn)"])
    opcf_col = _find_col(w, ["Operating cashflow ($ mn)", "Operating cash flow ($ mn)", "Operating Cash Flow ($ mn)"])
    net_debt_col = _find_col(w, ["Net debt ($ mn)", "Net Debt", "Net debt", "Net Debt ($ mn)"])
    emp_col = _find_col(w, ["Full-time employees", "Full-Time Employees", "Employees", "Total Employees"])
    da_col = _pick_da_column(w)

    market_cap_col = _find_col(w, ["Market Capitalisation", "Market Capitalization", "Market capitalization ($ mn)", "Market Cap ($ mn)"])
    ev_col = _find_col(w, ["Enterprise Value (Total)", "Enterprise Value", "Enterprise value ($ mn)", "EV ($ mn)"])

    # Cash flow / valuation direct fields
    fcf_col = _find_col(w, ["Free Cash Flow (Unlevered)", "Free Cash Flow", "Free cash flow ($ mn)", "Free Cash Flow ($ mn)"])
    ev_ebitda_col = _find_col(w, [
        "Enterprise Value to Earnings Before Interest, Taxes, Depreciation, and Amortization Multiple",
        "EV / EBITDA",
        "EV/EBITDA",
    ])
    pe_col = _find_col(w, ["Price to Earning Ratio", "P/E", "PE Ratio", "Price/Earnings"])

    # Returns / efficiency direct fields
    roic_col = _find_col(w, ["Return on Invested Capital ( %)", "Return on Invested Capital (%)", "ROIC (%)"])
    roce_col = _find_col(w, ["Return on Capital Employed ( %)", "Return on Capital Employed (%)", "ROCE (%)"])
    roa_col = _find_col(w, ["Return on Assets ( %)", "Return on Assets (%)", "ROA (%)"])
    asset_turnover_col = _find_col(w, ["Assets Turnover Ratio", "Asset Turnover Ratio"])

    net_ppe_col = _find_col(w, ["Net property , Plant and Equipment", "Net Property, Plant and Equipment", "Net PP&E", "Net PPE ($ mn)"])

    # Leverage / risk direct fields
    ndebt_ebitda_ratio_col = _find_col(w, [
        "Net Debt to Earnings Before Interest, Taxes, Depreciation, and Amortization Ratio",
        "Net Debt / EBITDA",
        "Net debt / EBITDA",
    ])
    debt_to_equity_col = _find_col(w, ["Total Debt/Equity %", "Debt-to-Equity Ratio", "Debt to Equity Ratio"])
    interest_cov_col = _find_col(w, ["Interest Coverage Ratio", "Interest Coverage", "Interest coverage ratio"])
    interest_exp_col = _find_col(w, ["Interest expense ($ mn)", "Interest Expense ($ mn)", "Interest expense"])

    # Optional short-term debt share (not present in your CIQ IDs (Linked) export today)
    st_debt_col = _find_col(w, ["Short-term debt ($ mn)", "Short term debt ($ mn)", "Short term Borrowings", "Current portion of long term debt ($ mn)"])
    total_debt_col = _find_col(w, ["Total Debt ($ mn)", "Total Debt", "Debt ($ mn)"])

    # ----- Derived metrics (standardized dashboard labels) -----

    # Profitability
    if _find_col(w, ["EBITDA Margin ( %)", "EBITDA Margin (%)"]):
        w["EBITDA margin"] = _to_fraction_if_percent(w[_find_col(w, ["EBITDA Margin ( %)", "EBITDA Margin (%)"])])
    else:
        denom = w[revenue_col] if revenue_col else np.nan
        num = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else np.nan)
        w["EBITDA margin"] = safe_div(num, denom) if revenue_col and (ebitda_col or ebit_col) else np.nan

    # Operating margin (EBIT/Revenue)
    w["Operating profit margin"] = safe_div(w[ebit_col], w[revenue_col])*100 if (ebit_col and revenue_col) else np.nan

    # Cashflow quality
    denom_for_cash = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else None)
    w["Cash conversion"] = safe_div(w[opcf_col], denom_for_cash) if (opcf_col and denom_for_cash is not None) else np.nan
    w["CAPEX intensity"] = safe_div(w[capex_col], w[revenue_col]) if (capex_col and revenue_col) else np.nan

    # Balance sheet: Net Debt
    w["Net debt ($ mn)"] = w[net_debt_col] if net_debt_col else np.nan

    # Market cap and EV (note: your export provides these as point-in-time values)
    w["Market capitalization ($ mn)"] = w[market_cap_col] if market_cap_col else np.nan

    # EV: prefer direct EV; else approximate EV = Market Cap + Net debt
    if ev_col:
        w["Enterprise value ($ mn)"] = w[ev_col]
    else:
        if market_cap_col and net_debt_col:
            w["Enterprise value ($ mn)"] = pd.to_numeric(w[market_cap_col], errors="coerce") + pd.to_numeric(w[net_debt_col], errors="coerce")
        else:
            w["Enterprise value ($ mn)"] = np.nan

    # Returns (%)
    w["ROIC (%)"] = pd.to_numeric(w[roic_col], errors="coerce") if roic_col else np.nan
    w["ROCE (%)"] = _to_fraction_if_percent(w[roce_col]) if roce_col else np.nan
    w["ROA (%)"] = _to_fraction_if_percent(w[roa_col]) if roa_col else np.nan

    # Asset turnover
    if asset_turnover_col:
        w["Asset turnover"] = pd.to_numeric(w[asset_turnover_col], errors="coerce")
    else:
        w["Asset turnover"] = safe_div(w[revenue_col], w[assets_col]) if (revenue_col and assets_col) else np.nan

    # Net PP&E
    w["Net PP&E ($ mn)"] = w[net_ppe_col] if net_ppe_col else np.nan

    # Leverage ratios
    w["Net debt / EBITDA"] = pd.to_numeric(w[ndebt_ebitda_ratio_col], errors="coerce") if ndebt_ebitda_ratio_col else (
        safe_div(w["Net debt ($ mn)"], w[ebitda_col]) if (net_debt_col and ebitda_col) else np.nan
    )

    w["Debt-to-equity"] = pd.to_numeric(w[debt_to_equity_col], errors="coerce") if debt_to_equity_col else np.nan
    w["Interest coverage"] = pd.to_numeric(w[interest_cov_col], errors="coerce") if interest_cov_col else (
        safe_div(w[ebit_col], w[interest_exp_col]) if (ebit_col and interest_exp_col) else np.nan
    )

    if st_debt_col and total_debt_col:
        w["% short-term debt"] = safe_div(w[st_debt_col], w[total_debt_col])
    else:
        w["% short-term debt"] = np.nan

    # Cash generation
    w["Operating cash flow ($ mn)"] = w[opcf_col] if opcf_col else np.nan
    w["Free cash flow ($ mn)"] = w[fcf_col] if fcf_col else (
        (pd.to_numeric(w[opcf_col], errors="coerce") - pd.to_numeric(w[capex_col], errors="coerce")) if (opcf_col and capex_col) else np.nan
    )

    denom = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else None)
    w["FCF / EBITDA"] = safe_div(w["Free cash flow ($ mn)"], denom) if denom is not None else np.nan

    # Valuation multiples
    w["EV / EBITDA"] = pd.to_numeric(w[ev_ebitda_col], errors="coerce") if ev_ebitda_col else (
        safe_div(w["Enterprise value ($ mn)"], denom) if denom is not None else np.nan
    )
    w["P/E"] = pd.to_numeric(w[pe_col], errors="coerce") if pe_col else np.nan

    # FTE-based productivity (Bain-themed labels are handled in page; here we keep computed columns)
    if emp_col and ebitda_col:
        base_ebitda = w[ebitda_col] if ebitda_col else w[ebit_col]
        w["EBITDA per Employee (USD '000)"] = safe_div(pd.to_numeric(base_ebitda, errors="coerce") * 1000.0, w[emp_col]).round(0)
    else:
        w["EBITDA per Employee (USD '000)"] = np.nan

    if emp_col and revenue_col:
        w["Revenue per Employee (USD '000)"] = safe_div(pd.to_numeric(w[revenue_col], errors="coerce") * 1000.0, w[emp_col]).round(0)
    else:
        w["Revenue per Employee (USD '000)"] = np.nan

    if emp_col and opcf_col:
        w["Operating Cash Flow per Employee (USD '000)"] = safe_div(pd.to_numeric(w[opcf_col], errors="coerce") * 1000.0, w[emp_col]).round(0)
    else:
        w["Operating Cash Flow per Employee (USD '000)"] = np.nan

    if emp_col and net_ppe_col:
        w["Net PP&E per Employee (USD '000)"] = safe_div(pd.to_numeric(w[net_ppe_col], errors="coerce") * 1000.0, w[emp_col]).round(0)
    else:
        w["Net PP&E per Employee (USD '000)"] = np.nan

    if emp_col and revenue_col:
        w["Labor intensity (FTE per $ mn revenue)"] = safe_div(w[emp_col], w[revenue_col])
    else:
        w["Labor intensity (FTE per $ mn revenue)"] = np.nan

    # Keep numerators/denominators for tables / downstream pages (backwards-compatible keys)
    w["_Revenue"] = w[revenue_col] if revenue_col else np.nan
    w["_EBIT"] = w[ebit_col] if ebit_col else np.nan
    w["_EBITDA"] = w[ebitda_col] if ebitda_col else (w[ebit_col] if ebit_col else np.nan)
    w["_Employees"] = w[emp_col] if emp_col else np.nan
    w["_Assets"] = w[assets_col] if assets_col else np.nan
    w["_DA"] = w[da_col] if da_col else np.nan
    w["_OpCF"] = w[opcf_col] if opcf_col else np.nan
    w["_CAPEX"] = w[capex_col] if capex_col else np.nan

    return w


# --------------------------------------------------------------------------------------
# Time-series derived metrics for diagnostics pages
# --------------------------------------------------------------------------------------

def compute_yoy_growth(long_df: pd.DataFrame, metric: str, year: int) -> pd.DataFrame:
    """
    YoY growth into selected year:
      (metric_Y - metric_(Y-1)) / metric_(Y-1)

    Returns: CIQ_ID, Company, YoY Growth
    """
    if long_df is None or long_df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "YoY Growth"])

    df = long_df[long_df["Metric"].astype(str).str.strip() == str(metric).strip()].copy()
    if df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "YoY Growth"])

    pivot = df.pivot_table(index=["CIQ_ID", "Company"], columns="Year", values="Value", aggfunc="first")
    if (year not in pivot.columns) or ((year - 1) not in pivot.columns):
        return pd.DataFrame(columns=["CIQ_ID", "Company", "YoY Growth"])

    cur = pd.to_numeric(pivot[year], errors="coerce")
    prev = pd.to_numeric(pivot[year - 1], errors="coerce")

    yoy = ((cur - prev) / prev)*100
    yoy[(prev <= 0) | prev.isna() | cur.isna()] = np.nan

    out = yoy.reset_index()
    out = out.rename(columns={0: "YoY Growth", year: "YoY Growth"})
    out["YoY Growth"] = yoy.values
    return out[["CIQ_ID", "Company", "YoY Growth"]]


def compute_volatility_cv(
    long_df: pd.DataFrame,
    metric: str,
    year: int,
    window: int = 5,
    min_years: int = 3,
) -> pd.DataFrame:
    """
    Trailing-window volatility ending in selected year.
    Returns coefficient of variation (CV) = std / abs(mean).

    Output includes CIQ_ID and Company to support merges using standard keys.
    """
    if long_df is None or long_df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "Volatility (CV)"])

    start_year = year - window + 1
    df = long_df[
        (long_df["Metric"].astype(str).str.strip() == str(metric).strip())
        & (long_df["Year"].astype(int) >= start_year)
        & (long_df["Year"].astype(int) <= year)
    ].copy()

    if df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "Volatility (CV)"])

    meta = df[["CIQ_ID", "Company"]].drop_duplicates(subset=["CIQ_ID", "Company"]).copy()

    vals = df.pivot_table(index=["CIQ_ID", "Company"], columns="Year", values="Value", aggfunc="first")
    count = vals.notna().sum(axis=1)
    mean = vals.mean(axis=1, skipna=True)
    std = vals.std(axis=1, skipna=True, ddof=0)

    cv = std / mean.abs()
    cv[(count < min_years) | (mean == 0) | (mean.isna())] = np.nan

    out = cv.reset_index()
    out = out.rename(columns={0: "Volatility (CV)"})
    out["Volatility (CV)"] = cv.values
    return out[["CIQ_ID", "Company", "Volatility (CV)"]]


def compute_volatility_std(
    long_df: pd.DataFrame,
    metric: str,
    year: int,
    window: int = 5,
    min_years: int = 3,
) -> pd.DataFrame:
    """Trailing-window standard deviation ending in selected year.

    Used for the EBITDA Volatility KPI:
      STDEV(EBITDA over last N years), typically N=5.

    Notes:
      - Requires at least `min_years` non-null observations; otherwise returns NaN.
      - Includes negative values (they are part of real volatility).
    """
    if long_df is None or long_df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "Volatility (STD)"])

    start_year = year - window + 1
    df = long_df[
        (long_df["Metric"].astype(str).str.strip() == str(metric).strip())
        & (long_df["Year"].astype(int) >= start_year)
        & (long_df["Year"].astype(int) <= year)
    ].copy()

    if df.empty:
        return pd.DataFrame(columns=["CIQ_ID", "Company", "Volatility (STD)"])

    vals = df.pivot_table(index=["CIQ_ID", "Company"], columns="Year", values="Value", aggfunc="first")
    count = vals.notna().sum(axis=1)
    std = vals.std(axis=1, skipna=True, ddof=0)
    std[count < int(min_years)] = np.nan

    out = std.reset_index()
    out = out.rename(columns={0: "Volatility (STD)"})
    out["Volatility (STD)"] = std.values
    return out[["CIQ_ID", "Company", "Volatility (STD)"]]


# --------------------------------------------------------------------------------------
# Formatting utilities / UI helpers
# --------------------------------------------------------------------------------------

def format_ebitda_per_employee_display(x):
    if pd.isna(x):
        return "data not available"
    if x == 0:
        return "<1"
    return int(x)


def img_to_base64(img_path: Path) -> str:
    if not img_path.exists():
        return ""
    b64 = base64.b64encode(img_path.read_bytes()).decode("utf-8")
    ext = img_path.suffix.lower().replace(".", "")
    mime = "png" if ext == "png" else "jpeg"
    return f"data:image/{mime};base64,{b64}"


def render_banner():
    bain_uri = img_to_base64(BAIN_LOGO_PATH)
    bcn_uri = img_to_base64(BCN_LOGO_PATH)

    logos_block_w = 235
    spacing = 8

    st.markdown(
        f"""
        <div style="
            display:flex;
            align-items:center;
            justify-content:flex-start;
            width:100%;
            margin-bottom:10px;
            margin-top:-26px;
            box-sizing:border-box;
        ">
        <div style="
            background:#E11C2A;
            color:white;
            padding:14px 16px;
            border-radius:10px;
            font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            font-size:28px;
            font-weight:800;
            letter-spacing:0.2px;
            line-height:1.1;
            flex:1;
            box-shadow:0 8px 20px rgba(0,0,0,0.12);
        ">
            Company-level diagnosis
        </div>

        <div style="display:flex; align-items:center; margin-left:12px; gap:{spacing}px; width:{logos_block_w}px;">
            <div style="background:white; padding:6px 8px; border-radius:10px; box-shadow:0 6px 16px rgba(0,0,0,0.08); flex:1; display:flex; justify-content:center;">
                <img src="{bain_uri}" style="height:40px; object-fit:contain;" />
            </div>
            <div style="background:white; padding:6px 8px; border-radius:10px; box-shadow:0 6px 16px rgba(0,0,0,0.08); flex:1; display:flex; justify-content:center;">
                <img src="{bcn_uri}" style="height:40px; object-fit:contain;" />
            </div>
        </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_chart_footnote(text: str):
    """
    Business-friendly footnote under each chart describing what is being shown (definition),
    not a summary of performance.
    """
    txt = "" if text is None else str(text).strip()
    if not txt:
        return
    st.markdown(
        f"""<div style="margin-top:-6px; margin-bottom:14px; font-size:13px; color:#6C6C6C;">
        <span style="font-weight:600;">Note:</span> {txt}
        </div>""",
        unsafe_allow_html=True,
    )


def _default_top_companies(w: pd.DataFrame, n: int, analyzed_company: str) -> List[str]:
    """
    Default selection: top-N companies by revenue (descending), always include analyzed company.
    """
    if w.empty:
        return [analyzed_company] if analyzed_company else []

    revenue_col = "Revenue ($ mn)" if "Revenue ($ mn)" in w.columns else _find_col(w, ["Total Revenue"])
    if revenue_col is None:
        # fallback: arbitrary selection
        comps = w["Company"].dropna().astype(str).unique().tolist()[:n]
    else:
        tmp = w[["Company", revenue_col]].copy()
        tmp[revenue_col] = pd.to_numeric(tmp[revenue_col], errors="coerce")
        tmp = tmp.sort_values(revenue_col, ascending=False)
        comps = tmp["Company"].astype(str).tolist()

    # ensure unique + analyzed included
    seen = set()
    out = []
    for c in comps:
        if c not in seen:
            out.append(c)
            seen.add(c)
        if len(out) >= n:
            break
    if analyzed_company and analyzed_company not in seen:
        out.append(analyzed_company)
    return out


def _bain_colors():
    return {"red": "#E11C2A", "grey": "#B3B3B3"}

def _bain_peer_palette() -> list[str]:
    """Extended Bain-compatible palette for multi-company line charts.

    - Index 0 is reserved for the analyzed company (Bain Red).
    - Peers rotate through the remaining colors (15+ options).
    """
    return [
        "#E11C2A",  # Bain Red (reserved for analyzed company)
        "#1F4E79",  # Navy
        "#2F5597",  # Deep blue
        "#4F81BD",  # Blue
        "#00A6D6",  # Cyan
        "#2E7D32",  # Green
        "#7CB342",  # Light green
        "#76923C",  # Olive
        "#8064A2",  # Purple
        "#5B9BD5",  # Light blue
        "#C0504D",  # Brick
        "#ED7D31",  # Orange
        "#FFC000",  # Gold
        "#8C564B",  # Brown
        "#17A2B8",  # Teal
        "#6C6C6C",  # Dark grey
        "#9E9E9E",  # Mid grey
    ]



def _bar_chart(
    df_plot: pd.DataFrame,
    value_col: str,
    analyzed_company: str,
    title: str,
    value_format: str | None = None,
    yaxis_tickformat: str | None = None,
    yaxis_title: str | None = None,
):
    """
    Standard Bain-style vertical ranked bar chart.
    - Highlights analyzed company in red; peers in grey
    - Supports percent tick formatting via yaxis_tickformat (e.g., ".0%")
    - Supports y-axis title for unit clarity
    """
    colors = _bain_colors()
    x = df_plot["Company"].astype(str).tolist()
    y = df_plot[value_col].tolist()
    bar_colors = [colors["red"] if c == analyzed_company else colors["grey"] for c in x]

    fig = go.Figure(
        data=[go.Bar(x=x, y=y, marker_color=bar_colors)]
    )

    fig.update_layout(
        title={"text": title, "x": 0.0, "xanchor": "left","font": {"size": 24},},
        xaxis_title={
            "text": "Company",
            "font": {"size": 18, "family": "Arial", "color": "#6C6C6C"},
        },
        yaxis_title={"text": (yaxis_title or ""), "standoff": 10},
        margin=dict(l=30, r=30, t=60, b=80),
        height=520,
    )

    fig.update_xaxes(tickangle=30, automargin=True, tickfont=dict(size=15))

    # Ensure all category labels are shown (Plotly may auto-skip when there are many categories)
    n_cats = len(x)
    if n_cats > 20:
        fig.update_layout(margin=dict(l=30, r=30, t=60, b=140))
        fig.update_xaxes(tickangle=45, tickfont=dict(size=12))
    if n_cats > 40:
        fig.update_layout(margin=dict(l=30, r=30, t=60, b=180))
        fig.update_xaxes(tickangle=60, tickfont=dict(size=10))

    fig.update_xaxes(
        tickmode="array",
        tickvals=x,
        ticktext=x,
        categoryorder="array",
        categoryarray=x,
        showticklabels=True,
    )

    fig.update_yaxes(automargin=True)

    if yaxis_tickformat:
        fig.update_yaxes(tickformat=yaxis_tickformat)

    if value_format:
        fig.update_traces(hovertemplate=f"%{{x}}<br>%{{y:{value_format}}}<extra></extra>")
    else:
        fig.update_traces(hovertemplate="%{x}<br>%{y}<extra></extra>")

    st.plotly_chart(fig, use_container_width=True)


def _bar_chart_generic(
    df_plot: pd.DataFrame,
    x_col: str,
    value_col: str,
    analyzed_x: Optional[str],
    title: str,
    value_format: str | None = None,
    yaxis_tickformat: str | None = None,
    xaxis_title: str | None = None,
    yaxis_title: str | None = None,
):
    """Bain-style ranked vertical bar chart for an arbitrary x axis.

    - If `analyzed_x` is provided and present in x_col, that bar is highlighted.
    - Otherwise all bars are rendered in grey.
    """
    colors = _bain_colors()
    x = df_plot[x_col].astype(str).tolist()
    y = df_plot[value_col].tolist()
    bar_colors = [colors["red"] if (analyzed_x and v == analyzed_x) else colors["grey"] for v in x]

    fig = go.Figure(data=[go.Bar(x=x, y=y, marker_color=bar_colors)])
    fig.update_layout(
        title={"text": title, "x": 0.0, "xanchor": "left", "font": {"size": 24},},
        xaxis_title={
            "text": (xaxis_title or x_col),
            "font": {"size": 18, "family": "Arial", "color": "#6C6C6C"},
        },
        yaxis_title={"text": (yaxis_title or ""), "standoff": 10},
        margin=dict(l=30, r=30, t=60, b=80),
        height=520,
    )
    fig.update_xaxes(tickangle=30, automargin=True, tickfont=dict(size=15))

    # Ensure all category labels are shown (Plotly may auto-skip when there are many categories)
    n_cats = len(x)
    if n_cats > 20:
        fig.update_layout(margin=dict(l=30, r=30, t=60, b=140))
        fig.update_xaxes(tickangle=45, tickfont=dict(size=12))
    if n_cats > 40:
        fig.update_layout(margin=dict(l=30, r=30, t=60, b=180))
        fig.update_xaxes(tickangle=60, tickfont=dict(size=10))

    fig.update_xaxes(
        tickmode="array",
        tickvals=x,
        ticktext=x,
        categoryorder="array",
        categoryarray=x,
        showticklabels=True,
    )

    fig.update_yaxes(automargin=True)
    if yaxis_tickformat:
        fig.update_yaxes(tickformat=yaxis_tickformat)
    if value_format:
        fig.update_traces(hovertemplate=f"%{{x}}<br>%{{y:{value_format}}}<extra></extra>")
    else:
        fig.update_traces(hovertemplate="%{x}<br>%{y}<extra></extra>")
    st.plotly_chart(fig, use_container_width=True)



def _line_chart(
    df_plot: pd.DataFrame,
    analyzed_company: Optional[str],
    title: str,
    x_col: str = "Year",
    y_col: str = "Value",
    series_col: str = "Company",
    yaxis_tickformat: str | None = None,
    yaxis_title: str | None = None,
    value_format: str | None = None,
):
    """Bain-style time-series line chart.

    - X axis: Year (integer)
    - One line per company
    - Highlights analyzed company in red; peers use a multi-color palette for differentiation
    - Supports percent tick formatting via yaxis_tickformat (e.g., ".0%")
    """
    if df_plot is None or df_plot.empty:
        st.info("No data available to plot.")
        return

    palette = _bain_peer_palette()
    peer_palette = palette[1:]  # exclude Bain red reserved for analyzed company
    fig = go.Figure()

    # Ensure deterministic legend ordering (and deterministic color assignment)
    series = df_plot[series_col].dropna().astype(str).unique().tolist()

    peer_i = 0
    for s in series:
        d = df_plot[df_plot[series_col].astype(str) == str(s)].sort_values(x_col)
        is_analyzed = bool(analyzed_company) and str(s) == str(analyzed_company)
        if is_analyzed:
            line_color = palette[0]
            line_width = 3
        else:
            line_color = peer_palette[peer_i % len(peer_palette)]
            peer_i += 1
            line_width = 2
        fig.add_trace(
            go.Scatter(
                x=d[x_col],
                y=d[y_col],
                mode="lines",
                name=str(s),
                line=dict(color=line_color, width=line_width),
            )
        )

    fig.update_layout(
        title={"text": title, "x": 0.0, "xanchor": "left", "font": {"size": 24},},
        xaxis_title={"text": "Year", "font": {"size": 18, "family": "Arial", "color": "#6C6C6C"}},
        yaxis_title={"text": (yaxis_title or ""), "standoff": 10},
        margin=dict(l=30, r=30, t=60, b=80),
        height=520,
        legend=dict(orientation="v"),
    )
    fig.update_xaxes(automargin=True, tickfont=dict(size=15), dtick=1)
    fig.update_yaxes(automargin=True)
    if yaxis_tickformat:
        fig.update_yaxes(tickformat=yaxis_tickformat)

    if value_format:
        fig.update_traces(hovertemplate=f"%{{x}}<br>%{{y:{value_format}}}<extra></extra>")
    else:
        fig.update_traces(hovertemplate="%{x}<br>%{y}<extra></extra>")

    st.plotly_chart(fig, use_container_width=True)

def build_company_timeseries_direct(
    long_df: pd.DataFrame,
    years: List[int],
    companies: List[str],
    metric_name: str,
    country: Optional[str] = None,
) -> pd.DataFrame:
    """Build time-series directly from the raw long CIQ export (no _compute_metrics)."""
    if long_df is None or long_df.empty or not years or not companies:
        return pd.DataFrame(columns=["Year", "Company", "Ticker", "Country", "Value"])

    yrs = set(int(y) for y in years)
    comps = set(str(c) for c in companies)

    df = long_df.copy()
    df = df[df["Year"].astype(int).isin(yrs)]
    df = df[df["Metric"].astype(str).str.strip() == str(metric_name).strip()]
    df = df[df["Company"].astype(str).isin(comps)]

    if country and str(country) != "All":
        df = df[df["Country"].astype(str) == str(country)]

    df = df.copy()
    df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
    df = df.dropna(subset=["Value"])

    out = df[["Year", "Company", "Ticker", "Country", "Value"]].copy()
    out["Year"] = out["Year"].astype(int)
    return out.sort_values(["Company", "Year"])


def build_company_timeseries(
    long_df: pd.DataFrame,
    years: List[int],
    companies: List[str],
    value_col: str,
    country: Optional[str] = None,
) -> pd.DataFrame:
    """Build a tidy time-series dataset for the selected companies.

    Calculations are **identical** to the single-year bar-chart view:
      - For each year: pivot long->wide via `_wide_for_year`, then run `_compute_metrics`
      - Pull `value_col` for each company-year

    Returns a tidy table:
      Year | Company | Ticker | Country | Value
    """
    if long_df is None or long_df.empty or not years or not companies:
        return pd.DataFrame(columns=["Year", "Company", "Ticker", "Country", "Value"])

    years_sorted = sorted([int(y) for y in years])
    comps = [str(c) for c in companies]

    out_rows: list[dict] = []
    for y in years_sorted:
        wide_y = _wide_for_year(long_df, int(y))
        if wide_y is None or wide_y.empty:
            continue
        wide_y = _compute_metrics(wide_y)

        df = wide_y.copy()
        if country and str(country) != "All" and "Country" in df.columns:
            df = df[df["Country"].astype(str) == str(country)].copy()

        df = df[df["Company"].astype(str).isin(comps)].copy()
        if df.empty:
            continue

        if value_col not in df.columns:
            # If the column isn't in computed metrics for this year, skip silently
            continue

        df["Value"] = pd.to_numeric(df[value_col], errors="coerce")
        df = df.dropna(subset=["Value"]).copy()

        for _, r in df.iterrows():
            out_rows.append(
                {
                    "Year": int(y),
                    "Company": str(r.get("Company", "")),
                    "Ticker": str(r.get("Ticker", "")),
                    "Country": str(r.get("Country", "")),
                    "Value": float(r["Value"]) if pd.notna(r["Value"]) else np.nan,
                }
            )

    out = pd.DataFrame(out_rows)
    if out.empty:
        return pd.DataFrame(columns=["Year", "Company", "Ticker", "Country", "Value"])
    out["Year"] = pd.to_numeric(out["Year"], errors="coerce").astype(int)
    return out


def _table_and_download(df: pd.DataFrame, filename_prefix: str = "data"):
    st.dataframe(df, use_container_width=True)
    csv = df.to_csv(index=False).encode("utf-8")
    st.download_button(
        "Download data (CSV)",
        data=csv,
        file_name=f"{filename_prefix}.csv",
        mime="text/csv",
    )