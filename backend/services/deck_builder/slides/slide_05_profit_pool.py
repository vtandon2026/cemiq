# slide_05_profit_pool.py

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import List, Optional, Tuple

import pandas as pd
import requests


# ── Configuration ─────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parents[1]

TC_SERVER_URL     = os.getenv("THINKCELL_SERVER_URL",      "http://127.0.0.1:8080/")
TC_TEMPLATE       = os.getenv("THINKCELL_TEMPLATE_CATEGORY", str(PROJECT_ROOT / "THINKCELL_TEMPLATE_CATEGORY.pptx"))
TC_ELEM_CHART     = os.getenv("THINKCELL_ELEM_CATEGORY_CHART", "CategoryChart")
TC_ELEM_TITLE     = os.getenv("THINKCELL_ELEM_TITLE",          "ChartTitle")

# ── Column names ──────────────────────────────────────────────────────────────
COL_REGION    = "Geographic Region"
COL_COUNTRY   = "Headquarters - Country/Region"
COL_FINAL_TAG = "Final tagging"
COL_SIC       = "SIC Codes"

# ── Category renames (matches Streamlit profit-pool page) ─────────────────────
CATEGORY_RENAMES = {
    "Materials & Components": "Building Materials (Except Cement)",
    "Epc & Design":           "EPC & Design",
}
CEMENT_PARENT = "Building Materials (Except Cement)"


# ── Column name helpers ───────────────────────────────────────────────────────

def _revenue_col(year: int) -> str:
    return f"Total Revenue [FY {year}] ($USDmm, Historical rate)"


def _ebitda_col(year: int) -> str:
    return f"EBITDA [FY {year}] ($USDmm, Historical rate)"


# ── Pandas helpers ────────────────────────────────────────────────────────────

def _normalize_category_series(s: pd.Series) -> pd.Series:
    return (
        s.fillna("").astype(str)
        .str.replace("\u00A0", " ", regex=False)
        .str.strip()
        .str.replace(r"\s+", " ", regex=True)
        .str.title()
    )


def _clean_str(s: pd.Series) -> pd.Series:
    return s.fillna("").astype(str).str.strip()


# ── think-cell cell constructors ──────────────────────────────────────────────

def _tc_string(x) -> dict:
    return {"string": str(x)}


def _tc_number(x) -> Optional[dict]:
    try:
        return {"number": float(x)}
    except (TypeError, ValueError):
        return None


# ── think-cell HTTP helpers ───────────────────────────────────────────────────

def _normalize_url(url: str) -> str:
    u = (url or "").strip() or "http://127.0.0.1:8080/"
    return u if u.endswith("/") else u + "/"


def _to_file_url(template_ref: str) -> str:
    """Convert a local path to a file:/// URL; pass through http(s)/file URLs unchanged."""
    ref = (template_ref or "").strip()
    if not ref:
        return ref
    if ref.lower().startswith(("http://", "https://", "file:///")):
        return ref
    p = Path(ref)
    return (p if p.is_absolute() else (PROJECT_ROOT / p).resolve()).as_uri()


def _build_payload(template_ref: str, data_items: List[dict]) -> str:
    return json.dumps(
        [{"template": _to_file_url(template_ref), "data": data_items}],
        ensure_ascii=False,
    )


def _post_to_tc(url: str, ppttc_json: str, timeout: int = 120) -> bytes:
    """POST ppttc JSON to think-cell Server and return PPTX bytes."""
    r = requests.post(
        _normalize_url(url),
        data=ppttc_json.encode("utf-8"),
        headers={
            "Content-Type": "application/vnd.think-cell.ppttc+json",
            "Accept":       "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
        timeout=timeout,
    )
    if not r.ok:
        raise RuntimeError(
            f"think-cell Server HTTP {r.status_code}\n"
            f"URL: {_normalize_url(url)}\n"
            f"Response: {(r.text or '').strip() or '(empty)'}"
        )
    return r.content


# ── Data aggregation ──────────────────────────────────────────────────────────

def build_profit_pool_view(
    df: pd.DataFrame,
    year: int,
    selected_regions: Optional[List[str]] = None,
    selected_countries: Optional[List[str]] = None,
) -> pd.DataFrame:
    """
    Aggregate revenue and EBITDA by category for the given year and filters.

    Cement is carved out of "Building Materials (Except Cement)" via SIC code
    and reported as its own category. Returns a DataFrame with columns:
    Category, Revenue, EBITDA, EBITDA margin, width (revenue share).
    """
    rev_col = _revenue_col(year)
    ebt_col = _ebitda_col(year)

    required = [COL_FINAL_TAG, COL_SIC, rev_col, ebt_col, COL_REGION, COL_COUNTRY]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    d = df.copy()

    if selected_regions:
        d = d[_clean_str(d[COL_REGION]).isin(selected_regions)]
    if selected_countries:
        d = d[_clean_str(d[COL_COUNTRY]).isin(selected_countries)]

    d = d.copy()
    d[COL_FINAL_TAG] = _normalize_category_series(d[COL_FINAL_TAG])
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
        mask = (
            (d[COL_FINAL_TAG].str.lower() == CEMENT_PARENT.lower()) & ~cement_mask
            if cat.strip().lower() == CEMENT_PARENT.lower()
            else d[COL_FINAL_TAG] == cat
        )
        rev = float(d.loc[mask, rev_col].sum())
        ebt = float(d.loc[mask, ebt_col].sum())
        rows.append({"Category": cat, "Revenue": rev, "EBITDA": ebt,
                     "EBITDA margin": (ebt / rev) if rev else 0.0})

    rows.append({"Category": "Cement", "Revenue": cement_rev, "EBITDA": cement_ebt,
                 "EBITDA margin": (cement_ebt / cement_rev) if cement_rev else 0.0})

    df_view = (
        pd.DataFrame(rows)
        .pipe(lambda d: d[d["Category"].str.strip() != ""])
        .assign(Category=lambda d: d["Category"].replace(CATEGORY_RENAMES))
        .sort_values("EBITDA margin", ascending=False)
        .reset_index(drop=True)
    )

    total_rev = float(df_view["Revenue"].sum())
    if total_rev <= 0:
        raise ValueError("Total revenue is 0 after filtering; cannot compute bar widths.")

    df_view["width"] = df_view["Revenue"].clip(lower=0.0) / total_rev
    return df_view[["Category", "Revenue", "EBITDA", "EBITDA margin", "width"]].copy()


# ── think-cell table builder ──────────────────────────────────────────────────

def _build_tc_table(df_view: pd.DataFrame) -> List[List[dict]]:
    """
    Build the ppttc table for a Mekko chart:
      Row 0 – category labels (x-axis)
      Row 1 – EBITDA margin  (bar height)
      Row 2 – Revenue        (bar width; think-cell uses relative proportions)
    """
    cats    = df_view["Category"].astype(str).tolist()
    margins = df_view["EBITDA margin"].astype(float).tolist()
    widths  = df_view["Revenue"].astype(float).tolist()
    return [
        [_tc_string("")]            + [_tc_string(c) for c in cats],
        [_tc_string("EBITDA margin")] + [_tc_number(v) for v in margins],
        [_tc_string("Revenue")]     + [_tc_number(v) for v in widths],
    ]


# ── Public API ────────────────────────────────────────────────────────────────

def build_slide_05_profit_pool_pptx(
    df_full: pd.DataFrame,
    year: int,
    selected_regions: Optional[List[str]] = None,
    selected_countries: Optional[List[str]] = None,
    tc_server_url: str = TC_SERVER_URL,
    template_path: str = TC_TEMPLATE,
    title_text: Optional[str] = None,
) -> Tuple[bytes, pd.DataFrame]:
    """
    Generate Slide 5 (Profit Pool Mekko) via think-cell Server.

    Returns (pptx_bytes, df_view) where df_view is the aggregated data used
    to populate the chart (useful for display in Streamlit).
    """
    df_view = build_profit_pool_view(df_full, year, selected_regions, selected_countries)

    if title_text is None:
        parts = []
        if selected_regions:
            parts.append(f"Region: {', '.join(selected_regions)}")
        if selected_countries:
            parts.append(f"Country: {', '.join(selected_countries)}")
        suffix     = f" ({' | '.join(parts)})" if parts else ""
        title_text = f"EBITDA margin by category – FY {year}{suffix}"

    payload = _build_payload(
        template_path,
        [
            {"name": TC_ELEM_CHART, "table": _build_tc_table(df_view)},
            {"name": TC_ELEM_TITLE, "table": [[_tc_string(title_text)]]},
        ],
    )

    return _post_to_tc(tc_server_url, payload), df_view