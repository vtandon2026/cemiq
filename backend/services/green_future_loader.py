# services/green_future_loader.py
"""
ESG & Future Tech > The Future of Green Cement.

Sibling to carbon_problem_loader.py. Reads the same GEM workbook but exposes
a forward-looking lens:
  • CCUS, Clay Calcination, Alternative Fuel adoption
  • Clinker dependency (clinker cap / cement cap)
  • Capacity tiers: Legacy / Transitioning / Future-Ready

Reuses get_carbon_df() so we benefit from its parsed-once, cached columns
(_plant_name, _company, _lat, _lon, _prod_norm, _alt_fuel_bool, _ccs_bool).
"""
from __future__ import annotations

from typing import Optional

import pandas as pd

from services.carbon_problem_loader import (
    get_carbon_df,
    _yes_no_to_bool,
    _PROD_UNKNOWN,
    COL_PLANT_NAME,
    COL_COUNTRY,
    COL_CEMENT_CAP,
    COL_CLINKER_CAP,
    COL_STATUS,
    COL_PLANT_TYPE,
    COL_PRODUCTION_TYPE,
    COL_CCS,
    COL_ALT_FUEL,
)

# ── Extra column constants ────────────────────────────────────────────────────
COL_CLAY = "Clay Calcination"

# ── Region mapping ────────────────────────────────────────────────────────────
# Five-bucket grouping requested by the spec.
# "APAC" excludes China by spec (China is its own column).
# Anything unmatched lands in "Other" rather than being dropped silently.
_REGION_MAP: dict[str, str] = {
    # Europe
    "Albania": "Europe", "Andorra": "Europe", "Armenia": "Europe", "Austria": "Europe",
    "Azerbaijan": "Europe", "Belarus": "Europe", "Belgium": "Europe",
    "Bosnia and Herzegovina": "Europe", "Bulgaria": "Europe", "Croatia": "Europe",
    "Cyprus": "Europe", "Czech Republic": "Europe", "Czechia": "Europe", "Denmark": "Europe",
    "Estonia": "Europe", "Finland": "Europe", "France": "Europe", "Georgia": "Europe",
    "Germany": "Europe", "Greece": "Europe", "Hungary": "Europe", "Iceland": "Europe",
    "Ireland": "Europe", "Italy": "Europe", "Kosovo": "Europe", "Latvia": "Europe",
    "Liechtenstein": "Europe", "Lithuania": "Europe", "Luxembourg": "Europe",
    "Malta": "Europe", "Moldova": "Europe", "Monaco": "Europe", "Montenegro": "Europe",
    "Netherlands": "Europe", "North Macedonia": "Europe", "Norway": "Europe",
    "Poland": "Europe", "Portugal": "Europe", "Romania": "Europe", "Russia": "Europe",
    "San Marino": "Europe", "Serbia": "Europe", "Slovakia": "Europe", "Slovenia": "Europe",
    "Spain": "Europe", "Sweden": "Europe", "Switzerland": "Europe", "Turkey": "Europe",
    "Türkiye": "Europe", "Ukraine": "Europe", "United Kingdom": "Europe", "UK": "Europe",
    "Vatican City": "Europe",

    # North America
    "Canada": "North America", "Mexico": "North America",
    "United States": "North America", "United States of America": "North America",
    "USA": "North America", "US": "North America",

    # China (its own bucket per spec)
    "China": "China", "Hong Kong": "China", "Macau": "China", "Macao": "China",
    "Taiwan": "China",

    # APAC (ex-China)
    "Afghanistan": "APAC", "Australia": "APAC", "Bangladesh": "APAC", "Bhutan": "APAC",
    "Brunei": "APAC", "Cambodia": "APAC", "Fiji": "APAC", "India": "APAC",
    "Indonesia": "APAC", "Japan": "APAC", "Kazakhstan": "APAC", "Kyrgyzstan": "APAC",
    "Laos": "APAC", "Malaysia": "APAC", "Maldives": "APAC", "Mongolia": "APAC",
    "Myanmar": "APAC", "Nepal": "APAC", "New Zealand": "APAC", "North Korea": "APAC",
    "Pakistan": "APAC", "Papua New Guinea": "APAC", "Philippines": "APAC",
    "Singapore": "APAC", "Solomon Islands": "APAC", "South Korea": "APAC",
    "Sri Lanka": "APAC", "Tajikistan": "APAC", "Thailand": "APAC",
    "Timor-Leste": "APAC", "Turkmenistan": "APAC", "Uzbekistan": "APAC",
    "Vanuatu": "APAC", "Vietnam": "APAC",

    # MEA (Middle East & Africa)
    "Algeria": "MEA", "Angola": "MEA", "Bahrain": "MEA", "Benin": "MEA",
    "Botswana": "MEA", "Burkina Faso": "MEA", "Burundi": "MEA", "Cameroon": "MEA",
    "Cape Verde": "MEA", "Central African Republic": "MEA", "Chad": "MEA",
    "Comoros": "MEA", "Congo": "MEA", "Democratic Republic of the Congo": "MEA",
    "DRC": "MEA", "Djibouti": "MEA", "Egypt": "MEA", "Equatorial Guinea": "MEA",
    "Eritrea": "MEA", "Eswatini": "MEA", "Ethiopia": "MEA", "Gabon": "MEA",
    "Gambia": "MEA", "Ghana": "MEA", "Guinea": "MEA", "Guinea-Bissau": "MEA",
    "Iran": "MEA", "Iraq": "MEA", "Israel": "MEA", "Ivory Coast": "MEA",
    "Côte d'Ivoire": "MEA", "Jordan": "MEA", "Kenya": "MEA", "Kuwait": "MEA",
    "Lebanon": "MEA", "Lesotho": "MEA", "Liberia": "MEA", "Libya": "MEA",
    "Madagascar": "MEA", "Malawi": "MEA", "Mali": "MEA", "Mauritania": "MEA",
    "Mauritius": "MEA", "Morocco": "MEA", "Mozambique": "MEA", "Namibia": "MEA",
    "Niger": "MEA", "Nigeria": "MEA", "Oman": "MEA", "Palestine": "MEA",
    "Qatar": "MEA", "Rwanda": "MEA", "Sao Tome and Principe": "MEA",
    "Saudi Arabia": "MEA", "Senegal": "MEA", "Seychelles": "MEA",
    "Sierra Leone": "MEA", "Somalia": "MEA", "South Africa": "MEA",
    "South Sudan": "MEA", "Sudan": "MEA", "Syria": "MEA", "Tanzania": "MEA",
    "Togo": "MEA", "Tunisia": "MEA", "Uganda": "MEA",
    "United Arab Emirates": "MEA", "UAE": "MEA", "Yemen": "MEA",
    "Zambia": "MEA", "Zimbabwe": "MEA",

    # South America / LATAM (kept distinct from MEA / North America)
    "Argentina": "South America", "Bolivia": "South America", "Brazil": "South America",
    "Chile": "South America", "Colombia": "South America", "Costa Rica": "South America",
    "Cuba": "South America", "Dominican Republic": "South America",
    "Ecuador": "South America", "El Salvador": "South America",
    "Guatemala": "South America", "Guyana": "South America", "Haiti": "South America",
    "Honduras": "South America", "Jamaica": "South America", "Nicaragua": "South America",
    "Panama": "South America", "Paraguay": "South America", "Peru": "South America",
    "Suriname": "South America", "Trinidad and Tobago": "South America",
    "Uruguay": "South America", "Venezuela": "South America",
}

# Heatmap column order — fixed per spec.
HEATMAP_REGIONS = ["Europe", "North America", "China", "APAC", "MEA"]

# ── Tunable thresholds ────────────────────────────────────────────────────────
# A plant is "low-clinker" if clinker/cement <= this ratio.
# 0.85 is intentionally looser than the textbook 0.75 because GEM clinker
# capacities are reported inconsistently (some plants record clinker capacity
# only, some record both, some report ratios > 1). 0.85 cuts noise while still
# being meaningful as a "blended cement" signal.
LOW_CLINKER_RATIO = 0.85


# ── Truthiness helpers ────────────────────────────────────────────────────────
# Pandas comparisons produce numpy.bool_ values, and `numpy.True_ is True`
# evaluates to False — so `is True` checks silently misbehave. These helpers
# accept numpy.bool_, Python bool, None, and NaN and return a proper Python bool.
def _truthy(v) -> bool:
    """True only when v is unambiguously True (Python bool or numpy.bool_)."""
    if v is True:
        return True
    if v is False or v is None:
        return False
    try:
        # numpy.bool_ → bool conversion; NaN raises in bool() so we catch it
        if pd.isna(v):
            return False
        return bool(v)
    except (TypeError, ValueError):
        return False


def _truthy_one(v) -> int:
    return 1 if _truthy(v) else 0


# ── Enriched DataFrame ────────────────────────────────────────────────────────
def get_green_df() -> pd.DataFrame:
    """
    Returns the carbon df with three extra columns:
      _clay_bool        : Clay Calcination yes/no -> True/False/None
      _clinker_ratio    : clinker_cap / cement_cap (NaN if either missing or cement_cap = 0)
      _low_clinker_bool : True if _clinker_ratio is known and <= LOW_CLINKER_RATIO
      _adoption_score   : (ccus + clay + alt_fuel) / 3 — counts None as 0
                          (a missing flag is treated as "no" for scoring; this
                          is the standard interpretation since GEM only fills
                          this column when there's a known signal)
      _region           : Europe / North America / China / APAC / MEA / South America / Other
    """
    base = get_carbon_df()
    df = base.copy()

    # Clay calcination
    if COL_CLAY in df.columns:
        df["_clay_bool"] = df[COL_CLAY].apply(_yes_no_to_bool)
    else:
        df["_clay_bool"] = None

    # Clinker dependency ratio.
    # Theoretical max is ~1.0 (clinker can't exceed total cement capacity);
    # values just above 1.0 are normal (clinker capacity used in OPC vs blended
    # cement mix). Anything > 1.5 is bad GEM data — typically a clinker-only
    # plant with a tiny stub cement_cap entry, or a unit-of-measure error.
    # Treat those as missing so they don't distort the scatter or KPI %.
    cap   = pd.to_numeric(df[COL_CEMENT_CAP],  errors="coerce")
    clink = pd.to_numeric(df[COL_CLINKER_CAP], errors="coerce")
    ratio = clink / cap.replace(0, pd.NA)
    ratio = pd.to_numeric(ratio, errors="coerce")
    ratio = ratio.where(ratio <= 1.5)   # drop implausible outliers → NaN
    df["_clinker_ratio"] = ratio
    df["_low_clinker_bool"] = (df["_clinker_ratio"].notna() &
                               (df["_clinker_ratio"] <= LOW_CLINKER_RATIO))

    # Adoption score — missing flags treated as False (count = 0).
    # NOTE: use `_truthy_one` not `is True` because pandas comparison results
    # are numpy.bool_, and `numpy.True_ is True` evaluates to False.
    ccus_int = df["_ccs_bool"].apply(_truthy_one)
    clay_int = df["_clay_bool"].apply(_truthy_one)
    alt_int  = df["_alt_fuel_bool"].apply(_truthy_one)
    df["_adoption_score"] = (ccus_int + clay_int + alt_int) / 3.0

    # Region
    df["_region"] = df[COL_COUNTRY].map(_REGION_MAP).fillna("Other")

    return df


# ── Filtering ─────────────────────────────────────────────────────────────────
# Tech type filter values — used by the page filter strip.
TECH_VALUES = {"ccus", "clay", "alt_fuel", "low_clinker"}


def _apply_filters(
    df: pd.DataFrame,
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
) -> pd.DataFrame:
    """
    Apply sidebar filters. None / empty list means no filter on that dim.
    `tech_types` is an OR filter: a plant matches if it has ANY of the
    specified techs.
    """
    out = df

    if regions:
        out = out[out["_region"].isin(regions)]
    if countries:
        out = out[out[COL_COUNTRY].isin(countries)]
    if companies:
        out = out[out["_company"].isin(companies)]
    if statuses:
        s_lower = [s.lower() for s in statuses]
        out = out[out[COL_STATUS].astype(str).str.lower().isin(s_lower)]

    if tech_types:
        wanted = {t.lower() for t in tech_types}
        masks = []
        if "ccus" in wanted:
            masks.append(out["_ccs_bool"] == True)        # noqa: E712
        if "clay" in wanted:
            masks.append(out["_clay_bool"] == True)       # noqa: E712
        if "alt_fuel" in wanted:
            masks.append(out["_alt_fuel_bool"] == True)   # noqa: E712
        if "low_clinker" in wanted:
            masks.append(out["_low_clinker_bool"] == True)  # noqa: E712
        if masks:
            combined = masks[0]
            for m in masks[1:]:
                combined = combined | m
            out = out[combined]

    return out


# ── Tier classification ───────────────────────────────────────────────────────
def _classify_tier(row) -> str:
    """
    Future-Ready > Transitioning > Legacy (highest tier wins).
      • Future-Ready  : any of CCUS, Clay Calcination, or low-clinker dependency
      • Transitioning : dry/semidry production OR alternative fuel use
      • Legacy        : everything else (wet/mixed/unknown w/ no advanced tech)
    Uses _truthy() to safely handle numpy.bool_, Python bool, None, and NaN.
    """
    if (_truthy(row["_ccs_bool"])
            or _truthy(row["_clay_bool"])
            or _truthy(row["_low_clinker_bool"])):
        return "future_ready"

    prod = str(row["_prod_norm"]).lower()
    if prod == "dry" or _truthy(row["_alt_fuel_bool"]):
        return "transitioning"

    return "legacy"


# ── Public API ────────────────────────────────────────────────────────────────
def get_meta() -> dict:
    """Filter dropdown options. Regions are fixed; countries/companies/statuses come from data."""
    df = get_green_df()
    countries = sorted(df[COL_COUNTRY].dropna().unique().tolist())

    # country -> region map, so the frontend can filter Country dropdown options
    # based on the user's Region selection without an extra round trip.
    country_to_region = (
        df[[COL_COUNTRY, "_region"]]
        .dropna()
        .drop_duplicates()
        .set_index(COL_COUNTRY)["_region"]
        .to_dict()
    )

    companies = sorted([
        c for c in df["_company"].dropna().unique().tolist()
        if c and c != "Unknown"
    ])
    if "Unknown" in df["_company"].unique():
        companies.append("Unknown")

    statuses = sorted(df[COL_STATUS].dropna().unique().tolist())

    # Regions: fixed set in display order (matches HEATMAP_REGIONS + extras).
    regions = HEATMAP_REGIONS + ["South America", "Other"]
    # Drop any region that has zero plants (don't show a useless option)
    present = set(df["_region"].dropna().unique().tolist())
    regions = [r for r in regions if r in present]

    tech_types = [
        {"value": "ccus",        "label": "CCUS"},
        {"value": "clay",        "label": "Clay Calcination"},
        {"value": "alt_fuel",    "label": "Alternative Fuel"},
        {"value": "low_clinker", "label": "Low Clinker Dependency"},
    ]

    return {
        "regions":           regions,
        "countries":         countries,
        "companies":         companies,
        "statuses":          statuses,
        "tech_types":        tech_types,
        "country_to_region": country_to_region,
    }


def get_companies_for_scope(
    regions:   Optional[list[str]] = None,
    countries: Optional[list[str]] = None,
) -> list[str]:
    """Companies active in the given region/country scope. Scope-aware."""
    df = get_green_df()
    if regions:
        df = df[df["_region"].isin(regions)]
    if countries:
        df = df[df[COL_COUNTRY].isin(countries)]

    raw  = df["_company"].dropna().unique().tolist()
    real = sorted([c for c in raw if c and c != "Unknown"])
    if "Unknown" in raw:
        real.append("Unknown")
    return real


def get_kpis(
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
) -> dict:
    """
    KPI strip:
      • CCUS-Enabled Capacity %     = ccus_cap / total_cap
      • Clay Calcination Capacity % = clay_cap / total_cap
      • Low-Clinker Capacity %      = low_clinker_cap / total_cap
      • Future-Ready Capacity (abs) = sum of cement capacity tagged Future-Ready
    """
    df  = get_green_df()
    sub = _apply_filters(df, regions=regions, countries=countries,
                         companies=companies, statuses=statuses,
                         tech_types=tech_types)

    total_cap = float(sub[COL_CEMENT_CAP].fillna(0).sum())

    def _flag_cap(col: str) -> float:
        m = sub[col] == True   # noqa: E712
        return float(sub.loc[m, COL_CEMENT_CAP].fillna(0).sum())

    ccus_cap = _flag_cap("_ccs_bool")
    clay_cap = _flag_cap("_clay_bool")
    low_clinker_cap = _flag_cap("_low_clinker_bool")

    # Future-Ready = any of the three (capacity, deduped at plant level)
    fr_mask = (
        (sub["_ccs_bool"]         == True) |   # noqa: E712
        (sub["_clay_bool"]        == True) |   # noqa: E712
        (sub["_low_clinker_bool"] == True)     # noqa: E712
    )
    future_ready_cap = float(sub.loc[fr_mask, COL_CEMENT_CAP].fillna(0).sum())

    def _pct(num: float) -> Optional[float]:
        if total_cap <= 0:
            return None
        return round(num / total_cap * 100.0, 1)

    return {
        "pct_ccus":         _pct(ccus_cap),
        "pct_clay":         _pct(clay_cap),
        "pct_low_clinker":  _pct(low_clinker_cap),
        "future_ready_cap": round(future_ready_cap, 2),
        "total_cap":        round(total_cap, 2),
        "plant_count":      int(len(sub)),
    }


def get_map_points(
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
) -> dict:
    """
    Green Technology Adoption Map.
      • One bubble per plant that has lat/lon + at least one green tech flag
      • Size = cement capacity (fallback to clinker if cement is null)
      • Color = primary tech (priority: CCUS > Clay > Alt Fuel)
    Plants with no green tech are excluded — this is the *adoption* map.
    """
    df  = get_green_df()
    sub = _apply_filters(df, regions=regions, countries=countries,
                         companies=companies, statuses=statuses,
                         tech_types=tech_types)

    # Need coords
    sub = sub[sub["_lat"].notna() & sub["_lon"].notna()]

    # Need at least one green tech flag (we're showing innovation, not legacy)
    sub = sub[
        (sub["_ccs_bool"]      == True) |   # noqa: E712
        (sub["_clay_bool"]     == True) |   # noqa: E712
        (sub["_alt_fuel_bool"] == True)     # noqa: E712
    ]

    points = []
    for _, r in sub.iterrows():
        cement_cap = (float(r[COL_CEMENT_CAP])
                      if pd.notna(r[COL_CEMENT_CAP]) else None)
        clinker_cap = (float(r[COL_CLINKER_CAP])
                       if pd.notna(r[COL_CLINKER_CAP]) else None)
        size_cap = cement_cap if (cement_cap is not None and cement_cap > 0) else (clinker_cap or 0.0)
        if size_cap <= 0:
            # Nothing to size a bubble with, but it has a tech flag — skip.
            continue

        # Priority for color tag — use _truthy() to handle both Python bool
        # and numpy.bool_ (which can creep in after DataFrame copies/joins).
        ccus  = _truthy(r["_ccs_bool"])
        clay  = _truthy(r["_clay_bool"])
        alt   = _truthy(r["_alt_fuel_bool"])
        if ccus:
            tech_tag = "ccus"
        elif clay:
            tech_tag = "clay"
        elif alt:
            tech_tag = "alt_fuel"
        else:
            continue  # defensive — filter above should have caught this

        points.append({
            "plant_name":      str(r.get("_plant_name") or ""),
            "company":         str(r.get("_company") or "Unknown"),
            "country":         str(r.get(COL_COUNTRY) or ""),
            "lat":             float(r["_lat"]),
            "lon":             float(r["_lon"]),
            "cement_capacity": round(cement_cap, 3) if cement_cap is not None else None,
            "clinker_capacity": round(clinker_cap, 3) if clinker_cap is not None else None,
            "size_cap":        round(float(size_cap), 3),
            "tech_tag":        tech_tag,
            "ccus":            bool(ccus),
            "clay":            bool(clay),
            "alt_fuel":        bool(alt),
        })

    return {"data": points, "count": len(points)}


def get_clinker_vs_adoption(
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
    group_by:   str = "company",   # "company" | "region"
) -> dict:
    """
    Supporting Chart 1 — Bubble scatter.
      X: clinker dependency (cap-weighted mean clinker/cement ratio per group)
      Y: future-tech adoption score (cap-weighted mean of (ccus+clay+alt)/3)
      Size: total cement capacity
      Color: region (categorical)
    Only groups with non-NaN clinker ratio and >0 capacity are returned.
    """
    df  = get_green_df()
    sub = _apply_filters(df, regions=regions, countries=countries,
                         companies=companies, statuses=statuses,
                         tech_types=tech_types)

    if sub.empty:
        return {"data": [], "group_by": group_by}

    # We need plants with a defined clinker ratio AND a positive cement capacity
    # for capacity-weighted averaging.
    sub = sub.copy()
    sub["_cap"] = pd.to_numeric(sub[COL_CEMENT_CAP], errors="coerce").fillna(0)
    sub = sub[sub["_cap"] > 0]

    group_col = "_company" if group_by == "company" else "_region"
    if group_col not in sub.columns:
        group_col = "_company"

    rows = []
    for grp, g in sub.groupby(group_col):
        cap_sum = float(g["_cap"].sum())
        if cap_sum <= 0:
            continue

        # Cap-weighted clinker ratio (only over rows where it's known)
        known = g[g["_clinker_ratio"].notna()]
        if known["_cap"].sum() > 0:
            cd = float((known["_clinker_ratio"] * known["_cap"]).sum() /
                       known["_cap"].sum())
        else:
            continue   # can't place this group on the X-axis without a ratio

        # Cap-weighted adoption score (all rows — None tech flags already => 0)
        ad = float((g["_adoption_score"] * g["_cap"]).sum() / cap_sum)

        # Dominant region for the dot's color (mode across plants)
        region_mode = g["_region"].mode()
        region_label = region_mode.iloc[0] if len(region_mode) else "Other"

        rows.append({
            "label":             str(grp),
            "clinker_dependency": round(cd, 3),
            "adoption_score":    round(ad, 3),
            "capacity":          round(cap_sum, 3),
            "region":            str(region_label),
            "plant_count":       int(len(g)),
        })

    rows.sort(key=lambda r: r["capacity"], reverse=True)
    return {"data": rows, "group_by": group_by}


def get_capacity_mix(
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
    group_by:   str = "region",   # "region" | "company"
    top_n:      int = 9999,       # default: return all; frontend handles zoom
) -> dict:
    """
    Supporting Chart 2 — 100% stacked bar.
    Buckets per group: legacy / transitioning / future_ready (capacity, Mtpa).
    Each row also carries pct_* fields summing to ~100.
    """
    df  = get_green_df()
    sub = _apply_filters(df, regions=regions, countries=countries,
                         companies=companies, statuses=statuses,
                         tech_types=tech_types)

    if sub.empty:
        return {"data": [], "group_by": group_by, "unit": "Mtpa"}

    sub = sub.copy()
    sub["_cap"]  = pd.to_numeric(sub[COL_CEMENT_CAP], errors="coerce").fillna(0)
    sub = sub[sub["_cap"] > 0]
    sub["_tier"] = sub.apply(_classify_tier, axis=1)

    group_col = "_company" if group_by == "company" else "_region"

    pivot = (
        sub.groupby([group_col, "_tier"])["_cap"]
        .sum()
        .unstack(fill_value=0.0)
        .reset_index()
        .rename(columns={group_col: "label"})
    )
    for col in ("legacy", "transitioning", "future_ready"):
        if col not in pivot.columns:
            pivot[col] = 0.0

    pivot["total"] = pivot["legacy"] + pivot["transitioning"] + pivot["future_ready"]
    pivot = pivot[pivot["total"] > 0]

    # For company view, top-N + "Other" bucket; for region view show all.
    if group_by == "company" and len(pivot) > top_n:
        pivot = pivot.sort_values("total", ascending=False)
        head = pivot.head(top_n).copy()
        tail = pivot.iloc[top_n:]
        other_row = pd.DataFrame([{
            "label": f"Other ({len(tail)} companies)",
            "legacy":         float(tail["legacy"].sum()),
            "transitioning":  float(tail["transitioning"].sum()),
            "future_ready":   float(tail["future_ready"].sum()),
            "total":          float(tail["total"].sum()),
        }])
        pivot = pd.concat([head, other_row], ignore_index=True)
    else:
        # Region view: keep spec ordering when present
        if group_by == "region":
            ordered = HEATMAP_REGIONS + ["South America", "Other"]
            pivot["_ord"] = pivot["label"].apply(
                lambda x: ordered.index(x) if x in ordered else 999
            )
            pivot = pivot.sort_values("_ord").drop(columns="_ord")
        else:
            pivot = pivot.sort_values("total", ascending=False)

    rows = []
    for _, r in pivot.iterrows():
        total = float(r["total"]) or 1.0
        rows.append({
            "label":             str(r["label"]),
            "legacy":            round(float(r["legacy"]),         3),
            "transitioning":     round(float(r["transitioning"]),  3),
            "future_ready":      round(float(r["future_ready"]),   3),
            "total":             round(float(r["total"]),          3),
            "pct_legacy":        round(float(r["legacy"]) / total * 100,        1),
            "pct_transitioning": round(float(r["transitioning"]) / total * 100, 1),
            "pct_future_ready":  round(float(r["future_ready"]) / total * 100,  1),
        })

    return {"data": rows, "group_by": group_by, "unit": "Mtpa"}


def get_tech_heatmap(
    regions:    Optional[list[str]] = None,
    countries:  Optional[list[str]] = None,
    companies:  Optional[list[str]] = None,
    statuses:   Optional[list[str]] = None,
    tech_types: Optional[list[str]] = None,
) -> dict:
    """
    Supporting Chart 3 — Heatmap.
    Rows = technologies (CCUS, Clay Calcination, Alt Fuel).
    Cols = regions (fixed: Europe / North America / China / APAC / MEA).
    Cell = % of regional capacity enabled with that tech.
    """
    df  = get_green_df()
    sub = _apply_filters(df, regions=regions, countries=countries,
                         companies=companies, statuses=statuses,
                         tech_types=tech_types)

    sub = sub.copy()
    sub["_cap"] = pd.to_numeric(sub[COL_CEMENT_CAP], errors="coerce").fillna(0)

    cells = []
    region_totals = {}
    for region in HEATMAP_REGIONS:
        region_totals[region] = float(sub.loc[sub["_region"] == region, "_cap"].sum())

    tech_specs = [
        ("ccus",     "CCUS",             "_ccs_bool"),
        ("clay",     "Clay Calcination", "_clay_bool"),
        ("alt_fuel", "Alternative Fuel", "_alt_fuel_bool"),
    ]

    for tech_key, tech_label, flag_col in tech_specs:
        for region in HEATMAP_REGIONS:
            total = region_totals[region]
            if total <= 0:
                cells.append({
                    "tech":   tech_key,
                    "tech_label": tech_label,
                    "region": region,
                    "value":  None,
                    "cap":    0.0,
                })
                continue
            enabled_cap = float(
                sub.loc[(sub["_region"] == region) & (sub[flag_col] == True), "_cap"].sum()  # noqa: E712
            )
            cells.append({
                "tech":       tech_key,
                "tech_label": tech_label,
                "region":     region,
                "value":      round(enabled_cap / total * 100, 1),
                "cap":        round(enabled_cap, 2),
            })

    return {
        "data":    cells,
        "regions": HEATMAP_REGIONS,
        "techs":   [{"value": t[0], "label": t[1]} for t in tech_specs],
        "unit":    "% of regional capacity",
    }