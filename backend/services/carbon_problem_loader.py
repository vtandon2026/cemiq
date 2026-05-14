# services/carbon_problem_loader.py
"""
Loads and processes Global-Cement-and-Concrete-Tracker_July-2025.xlsx
for the ESG & Future Tech > The Carbon Problem page.

Reuses the cached DataFrame loaded by cement_capacity_loader.get_gem_df()
to avoid double-reading the Excel file.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import pandas as pd

from services.cement_capacity_loader import get_gem_df, _parse_owner

# ── Column constants ──────────────────────────────────────────────────────────
COL_PLANT_NAME      = "GEM Asset name (English)"
COL_COORDS          = "Coordinates"
COL_COUNTRY         = "Country/Area"
COL_CEMENT_CAP      = "Cement Capacity (millions metric tonnes per annum)"
COL_CLINKER_CAP     = "Clinker Capacity (millions metric tonnes per annum)"
COL_STATUS          = "Operating status"
COL_START_DATE      = "Start date"
COL_PARENT          = "Parent"
COL_OWNER           = "Owner name (English)"
COL_PLANT_TYPE      = "Plant type"
COL_PRODUCTION_TYPE = "Production type"
COL_CCS             = "CCS/CCUS"
COL_ALT_FUEL        = "Alternative Fuel"
COL_WIKI            = "GEM wiki page"
COL_MUNICIPALITY    = "Municipality"

# ── Production type buckets ───────────────────────────────────────────────────
# The Excel has: dry, wet, mixed, semidry, unknown, n/a
# We collapse semidry into "mixed" for the 3-way stack.
_PROD_KNOWN = {"dry", "wet", "mixed", "semidry"}
_PROD_UNKNOWN = {"unknown", "n/a", "na", "nan", ""}


def _normalize_prod_type(raw: Optional[str]) -> str:
    """Normalize production type to one of: dry, wet, mixed, unknown."""
    if raw is None:
        return "unknown"
    s = str(raw).strip().lower()
    if s == "semidry":
        return "mixed"
    if s in _PROD_KNOWN:
        return s
    return "unknown"


def _parse_coords(raw) -> tuple[Optional[float], Optional[float]]:
    """Parse 'lat, lon' string into (lat, lon) floats."""
    if pd.isna(raw):
        return None, None
    s = str(raw).strip()
    m = re.match(r"^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$", s)
    if not m:
        return None, None
    try:
        return float(m.group(1)), float(m.group(2))
    except (ValueError, TypeError):
        return None, None


def _parse_start_year(raw) -> Optional[int]:
    """Extract a 4-digit year from the Start date column. Returns None for 'unknown'."""
    if pd.isna(raw):
        return None
    s = str(raw).strip().lower()
    if s in _PROD_UNKNOWN:
        return None
    m = re.search(r"\b(19\d{2}|20\d{2})\b", s)
    if not m:
        return None
    try:
        return int(m.group(1))
    except (ValueError, TypeError):
        return None


def _yes_no_to_bool(raw) -> Optional[bool]:
    """Convert 'yes'/'no'/'unknown' to True/False/None."""
    if pd.isna(raw):
        return None
    s = str(raw).strip().lower()
    if s == "yes":
        return True
    if s == "no":
        return False
    return None


def _strip_pct(raw: str) -> str:
    """Strip ' [XX.X%]' annotations from a name."""
    if pd.isna(raw):
        return ""
    return re.sub(r"\s*\[\d+\.?\d*%?\]", "", str(raw)).strip()


# ── Enriched DataFrame builder ────────────────────────────────────────────────

def get_carbon_df() -> pd.DataFrame:
    """
    Returns the GEM DataFrame enriched with derived columns:
      _company       : cleaned Parent name (no [%] suffix)
      _plant_name    : GEM Asset name (or wiki-derived fallback)
      _lat, _lon     : parsed coordinates
      _start_year    : parsed start date year (None if unknown)
      _prod_norm     : normalized production type (dry/wet/mixed/unknown)
      _alt_fuel_bool : True/False/None
      _ccs_bool      : True/False/None
    Cached implicitly via the underlying get_gem_df() lru_cache.
    """
    base = get_gem_df()

    # We don't want to mutate the cached DF, so copy once per call.
    # The expensive parsing should ideally be cached too, but get_gem_df is
    # already cached and these row-wise ops are fast on ~3k rows.
    df = base.copy()

    # Plant name — prefer GEM Asset name, fall back to wiki URL slug
    if COL_PLANT_NAME in df.columns:
        df["_plant_name"] = df[COL_PLANT_NAME].astype(str).str.strip()
    else:
        df["_plant_name"] = ""

    # Wiki fallback for empty plant names
    def _wiki_to_name(url):
        if pd.isna(url):
            return ""
        m = re.search(r"/([^/]+)$", str(url))
        if not m:
            return ""
        return m.group(1).replace("_", " ").strip()

    if COL_WIKI in df.columns:
        empty_mask = df["_plant_name"].isin(["", "nan", "n/a", "unknown"])
        df.loc[empty_mask, "_plant_name"] = df.loc[empty_mask, COL_WIKI].apply(_wiki_to_name)

    # Company — from Parent column, strip percentages
    parent_col = COL_PARENT if COL_PARENT in df.columns else COL_OWNER
    df["_company"] = df[parent_col].apply(_strip_pct)
    df.loc[df["_company"].isin(["", "nan"]), "_company"] = "Unknown"

    # Coordinates
    coord_pairs = df[COL_COORDS].apply(_parse_coords) if COL_COORDS in df.columns else [(None, None)] * len(df)
    df["_lat"] = [p[0] for p in coord_pairs]
    df["_lon"] = [p[1] for p in coord_pairs]

    # Start year
    df["_start_year"] = df[COL_START_DATE].apply(_parse_start_year) if COL_START_DATE in df.columns else None

    # Production type
    df["_prod_norm"] = df[COL_PRODUCTION_TYPE].apply(_normalize_prod_type) if COL_PRODUCTION_TYPE in df.columns else "unknown"

    # Alt fuel / CCS
    df["_alt_fuel_bool"] = df[COL_ALT_FUEL].apply(_yes_no_to_bool) if COL_ALT_FUEL in df.columns else None
    df["_ccs_bool"]      = df[COL_CCS].apply(_yes_no_to_bool)      if COL_CCS in df.columns      else None

    # Numeric capacities (already coerced in get_gem_df, but be safe)
    df[COL_CEMENT_CAP]  = pd.to_numeric(df[COL_CEMENT_CAP],  errors="coerce")
    df[COL_CLINKER_CAP] = pd.to_numeric(df[COL_CLINKER_CAP], errors="coerce")

    return df


# ── Filtering helper ──────────────────────────────────────────────────────────

def _apply_filters(
    df: pd.DataFrame,
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,                 # legacy single-company
    companies: Optional[list[str]] = None,         # new multi-company; takes precedence
    plant_type: Optional[str] = None,
    statuses: Optional[list[str]] = None,
) -> pd.DataFrame:
    """Apply sidebar filters. None / empty list / 'All' means no filter on that dim."""
    out = df

    if countries:
        out = out[out[COL_COUNTRY].isin(countries)]

    # Multi-company takes precedence over single-company
    if companies and len(companies) > 0:
        out = out[out["_company"].isin(companies)]
    elif company and company.lower() not in ("all", "all companies", ""):
        out = out[out["_company"] == company]

    if plant_type and plant_type.lower() not in ("all", ""):
        out = out[out[COL_PLANT_TYPE].astype(str).str.lower() == plant_type.lower()]

    if statuses:
        s_lower = [s.lower() for s in statuses]
        out = out[out[COL_STATUS].isin(s_lower)]

    return out


# ── Public API ────────────────────────────────────────────────────────────────

def get_meta() -> dict:
    """Filter dropdown options."""
    df = get_carbon_df()
    countries = sorted(df[COL_COUNTRY].dropna().unique().tolist())

    # Companies sorted alphabetically; "Unknown" pushed to end
    companies = sorted([c for c in df["_company"].dropna().unique().tolist() if c and c != "Unknown"])
    if "Unknown" in df["_company"].unique():
        companies.append("Unknown")

    plant_types = sorted([
        p for p in df[COL_PLANT_TYPE].dropna().astype(str).str.strip().str.lower().unique().tolist()
        if p and p not in _PROD_UNKNOWN
    ])
    statuses = sorted(df[COL_STATUS].dropna().unique().tolist())

    return {
        "countries":   countries,
        "companies":   companies,
        "plant_types": plant_types,
        "statuses":    statuses,
    }


def get_kpis(
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,           # IGNORED — kept for signature compat
    plant_type: Optional[str] = None,        # IGNORED — kept for signature compat
    statuses: Optional[list[str]] = None,
) -> dict:
    """
    Top KPIs — Country-scoped only.

    Per spec, KPIs reflect the whole country (or selected countries) and do NOT
    change when company or plant-type filters are applied. The company/plant_type
    args are accepted but ignored to keep the request shape consistent.

    INCLUDES rows with unknown production type for capacity totals
    ('numbers should be overall even if production type has unknown').
    """
    df  = get_carbon_df()
    sub = _apply_filters(df, countries=countries, company=None, plant_type=None, statuses=statuses)

    total_cement_cap  = float(sub[COL_CEMENT_CAP].fillna(0).sum())
    total_clinker_cap = float(sub[COL_CLINKER_CAP].fillna(0).sum())

    # % Wet — denominator excludes unknown (you can't compute a % of "unknown" type)
    typed = sub[sub["_prod_norm"].isin(["dry", "wet", "mixed"])]
    typed_cap = float(typed[COL_CEMENT_CAP].fillna(0).sum())
    wet_cap   = float(typed[typed["_prod_norm"] == "wet"][COL_CEMENT_CAP].fillna(0).sum())
    pct_wet = (wet_cap / typed_cap * 100) if typed_cap > 0 else None

    # % Plants using Alt Fuel — denominator = all plants where Alt Fuel column has yes/no
    alt_known = sub[sub["_alt_fuel_bool"].notna()]
    pct_alt_fuel = (
        float(alt_known["_alt_fuel_bool"].sum()) / len(alt_known) * 100
        if len(alt_known) > 0 else None
    )

    return {
        "total_cement_capacity":  round(total_cement_cap, 2),
        "total_clinker_capacity": round(total_clinker_cap, 2),
        "pct_wet_capacity":       round(pct_wet, 1)      if pct_wet      is not None else None,
        "pct_alt_fuel":           round(pct_alt_fuel, 1) if pct_alt_fuel is not None else None,
        "plant_count":            int(len(sub)),
    }


def get_companies_for_countries(countries: Optional[list[str]] = None) -> list[str]:
    """
    Return the list of companies (Parent column) operating in the given countries.
    If countries is None or empty → all companies globally.
    Sorts alphabetically; pushes 'Unknown' to the end.
    """
    df = get_carbon_df()
    if countries:
        df = df[df[COL_COUNTRY].isin(countries)]

    raw = df["_company"].dropna().unique().tolist()
    real = sorted([c for c in raw if c and c != "Unknown"])
    if "Unknown" in raw:
        real.append("Unknown")
    return real


def get_hero_chart(
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,
    companies: Optional[list[str]] = None,
    plant_type: Optional[str] = None,
    statuses: Optional[list[str]] = None,
    top_n: int = 15,
    axis: Optional[str] = None,        # "company" | "plant" — explicit override; if None, infer from `company`
) -> dict:
    """
    Wet vs Dry capacity stacked bar.
    Excludes plants with unknown production type — chart stacks are limited to
    Dry / Mixed / Wet. Rows whose ONLY capacity is in the unknown bucket will
    naturally drop out (their total becomes 0 → filtered by `total > 0`).

    X-axis logic:
      - If `axis == "plant"`              → x-axis = plants (across whatever filter is in scope)
      - elif `axis == "company"`          → x-axis = companies (override even if a single company is filtered)
      - elif `company` is set             → x-axis = plants (drill mode, legacy behavior)
      - else                              → x-axis = companies
    """
    df = get_carbon_df()
    sub = _apply_filters(df, countries=countries, company=company,
                         companies=companies, plant_type=plant_type, statuses=statuses)

    # Exclude rows with unknown production type. This makes the chart show only
    # meaningful Dry/Mixed/Wet contributions; companies/plants that are entirely
    # unknown will drop out via the downstream `total > 0` filter.
    # Note: KPI percentages (% Wet) already exclude unknowns separately.
    sub = sub[sub["_prod_norm"].isin(["dry", "wet", "mixed"])]

    if sub.empty:
        return {"data": [], "x_axis_type": axis or "company", "unit": "Mtpa"}

    # Decide grouping
    if axis == "plant":
        is_drilled = True
    elif axis == "company":
        is_drilled = False
    else:
        is_drilled = bool(company and company.lower() not in ("all", "all companies", ""))

    if is_drilled:
        group_col = "_plant_name"
        x_axis_type = "plant"
    else:
        group_col = "_company"
        x_axis_type = "company"

    # Pivot: rows = group_col, columns = wet/dry/mixed/unknown, values = sum(cement cap)
    pivot = (
        sub.groupby([group_col, "_prod_norm"])[COL_CEMENT_CAP]
        .sum()
        .unstack(fill_value=0.0)
        .reset_index()
        .rename(columns={group_col: "label"})
    )
    for col in ("dry", "wet", "mixed", "unknown"):
        if col not in pivot.columns:
            pivot[col] = 0.0

    pivot["total"] = pivot["dry"] + pivot["wet"] + pivot["mixed"] + pivot["unknown"]
    pivot = pivot[pivot["total"] > 0].sort_values("total", ascending=False)

    rows = []
    if is_drilled:
        # Show all plants for that company
        for _, r in pivot.iterrows():
            rows.append({
                "label":   str(r["label"]),
                "dry":     round(float(r["dry"]),     3),
                "wet":     round(float(r["wet"]),     3),
                "mixed":   round(float(r["mixed"]),   3),
                "unknown": round(float(r["unknown"]), 3),
                "total":   round(float(r["total"]),   3),
            })
    else:
        # Top N + Other bucket
        head   = pivot.head(top_n)
        tail   = pivot.iloc[top_n:]
        for _, r in head.iterrows():
            rows.append({
                "label":   str(r["label"]),
                "dry":     round(float(r["dry"]),     3),
                "wet":     round(float(r["wet"]),     3),
                "mixed":   round(float(r["mixed"]),   3),
                "unknown": round(float(r["unknown"]), 3),
                "total":   round(float(r["total"]),   3),
            })
        if len(tail) > 0:
            rows.append({
                "label":   f"Other ({len(tail)} companies)",
                "dry":     round(float(tail["dry"].sum()),     3),
                "wet":     round(float(tail["wet"].sum()),     3),
                "mixed":   round(float(tail["mixed"].sum()),   3),
                "unknown": round(float(tail["unknown"].sum()), 3),
                "total":   round(float(tail["total"].sum()),   3),
                "is_other": True,
            })

    return {
        "data":         rows,
        "x_axis_type":  x_axis_type,
        "unit":         "Mtpa",
        "is_drilled":   is_drilled,
    }


def get_map_points(
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,
    companies: Optional[list[str]] = None,
    plant_type: Optional[str] = None,
    statuses: Optional[list[str]] = None,
) -> dict:
    """
    Carbon exposure map.
    Returns plants with valid coordinates and known production type.
    Bubble size = clinker capacity. Color = production type.
    """
    df = get_carbon_df()
    sub = _apply_filters(df, countries=countries, company=company,
                         companies=companies, plant_type=plant_type, statuses=statuses)

    # Need coords + clinker capacity > 0 + known production type
    sub = sub[
        sub["_lat"].notna() &
        sub["_lon"].notna() &
        sub["_prod_norm"].isin(["dry", "wet", "mixed"]) &
        sub[COL_CLINKER_CAP].notna() &
        (sub[COL_CLINKER_CAP] > 0)
    ]

    points = []
    for _, r in sub.iterrows():
        points.append({
            "plant_name":      str(r.get("_plant_name") or ""),
            "company":         str(r.get("_company") or "Unknown"),
            "country":         str(r.get(COL_COUNTRY) or ""),
            "lat":             float(r["_lat"]),
            "lon":             float(r["_lon"]),
            "cement_capacity": float(r[COL_CEMENT_CAP]) if pd.notna(r[COL_CEMENT_CAP]) else None,
            "clinker_capacity": float(r[COL_CLINKER_CAP]),
            "production_type": str(r["_prod_norm"]),
            "ccs":             bool(r["_ccs_bool"])      if pd.notna(r["_ccs_bool"])      else None,
            "alt_fuel":        bool(r["_alt_fuel_bool"]) if pd.notna(r["_alt_fuel_bool"]) else None,
            "plant_type":      str(r.get(COL_PLANT_TYPE) or ""),
        })

    return {"data": points, "count": len(points)}


def get_integrated_grinding(
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,
    companies: Optional[list[str]] = None,
    plant_type: Optional[str] = None,
    statuses: Optional[list[str]] = None,
) -> dict:
    """
    Integrated vs Grinding vs Clinker-only capacity breakdown.

    Includes all plants regardless of production type — this chart is about
    plant_type (integrated / grinding / clinker-only), not production type.

    Capacity reported per plant:
      - Integrated / Grinding → Cement Capacity (their final saleable product)
      - Clinker only          → Clinker Capacity (clinker IS their final product;
                                their Cement Capacity is typically 0 or null)
    """
    df = get_carbon_df()
    sub = _apply_filters(df, countries=countries, company=company,
                         companies=companies, plant_type=plant_type, statuses=statuses)

    if sub.empty:
        return {"data": [], "unit": "Mtpa"}

    # Effective output capacity per plant:
    #   - Integrated / Grinding plants → cement_capacity (their final product)
    #   - Clinker only plants          → clinker_capacity (they don't make cement,
    #                                    so their cement_capacity is 0/null)
    # Using the max of the two correctly handles all three categories.
    sub = sub.copy()
    sub["_chart_cap"] = sub[[COL_CEMENT_CAP, COL_CLINKER_CAP]].fillna(0).max(axis=1)

    # Group by plant_type column using the effective capacity
    grp = (
        sub.groupby(sub[COL_PLANT_TYPE].astype(str).str.strip().str.lower())["_chart_cap"]
        .sum()
        .reset_index()
        .rename(columns={COL_PLANT_TYPE: "plant_type", "_chart_cap": "capacity"})
    )
    grp = grp[grp["capacity"] > 0].sort_values("capacity", ascending=False)

    # Filter out only truly-unknown plant types (preserve "clinker only", "integrated", "grinding")
    grp = grp[~grp["plant_type"].isin(list(_PROD_UNKNOWN))]

    return {
        "data": [
            {"plant_type": r["plant_type"], "capacity": round(float(r["capacity"]), 2)}
            for _, r in grp.iterrows()
        ],
        "unit": "Mtpa",
    }


def get_plant_age(
    countries: Optional[list[str]] = None,
    company: Optional[str] = None,
    companies: Optional[list[str]] = None,
    plant_type: Optional[str] = None,
    statuses: Optional[list[str]] = None,
    reference_year: int = None,
) -> dict:
    """
    Plant age distribution.
    Excludes plants with unknown start year (we can't compute their age).
    Includes plants regardless of production type — age is independent of process.
    Buckets: <10y, 10-20y, 20-30y, 30-50y, 50+y.
    """
    df = get_carbon_df()
    sub = _apply_filters(df, countries=countries, company=company,
                         companies=companies, plant_type=plant_type, statuses=statuses)
    sub = sub[sub["_start_year"].notna()]

    ref_year = reference_year or datetime.now().year

    if sub.empty:
        return {"data": [], "reference_year": ref_year}

    sub = sub.copy()
    sub["_age"] = ref_year - sub["_start_year"].astype(int)
    sub = sub[sub["_age"] >= 0]  # filter out future start dates

    buckets = [
        ("<10 yrs",   0,  10),
        ("10–20 yrs", 10, 20),
        ("20–30 yrs", 20, 30),
        ("30–50 yrs", 30, 50),
        ("50+ yrs",   50, 9999),
    ]

    rows = []
    for label, lo, hi in buckets:
        mask = (sub["_age"] >= lo) & (sub["_age"] < hi)
        bucket_df = sub[mask]
        rows.append({
            "bucket":   label,
            "count":    int(len(bucket_df)),
            "capacity": round(float(bucket_df[COL_CEMENT_CAP].fillna(0).sum()), 2),
        })

    return {"data": rows, "reference_year": ref_year, "unit": "Mtpa"}