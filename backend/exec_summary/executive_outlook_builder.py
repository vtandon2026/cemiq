# exec_summary/executive_outlook_builder.py
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse
from exec_summary.ux_formatter import build_takeaway, format_quality_message

import pandas as pd
from dotenv import load_dotenv
load_dotenv()

from exec_summary.config import (
    FORECAST_START,
    FORECAST_END,
    CAGR_DELTA_STABLE_LOW_PP,
    CAGR_DELTA_STABLE_HIGH_PP,
    CAGR_DELTA_MODERATE_GROWTH_HIGH_PP,
    CAGR_DELTA_MODERATE_FALL_LOW_PP,
    LABEL_STABLE,
    LABEL_MODERATE_GROWTH,
    LABEL_STRONG_GROWTH,
    LABEL_MODERATE_UNDERPERFORMANCE,
    LABEL_MATERIAL_UNDERPERFORMANCE,
)

# IMPORTANT: these must match the Excel "Category" values
SECTION_CATEGORIES: List[str] = [
    "Construction overall",
    "Building Products Overall Sales",
    "Cement, Concrete, Lime Overall Sales",
]


@dataclass
class SectionOutlook:
    category: str
    country: str
    region: str

    country_cagr: Optional[float]
    region_cagr: Optional[float]
    delta_pp: Optional[float]

    band_label: str  # internal label

    headline: str
    transition: str   # retained for backwards-compat; not rendered in the new UI
    bullets: List[str]

    debug: Dict[str, object]

    # ── NEW: renderer-facing fields ──────────────────────────────────────────
    # List of source domains extracted from SourceRef URLs, e.g. ["destatis.de", "kfw.de"]
    source_domains: List[str] = field(default_factory=list)

    # Human-readable note about validation/regeneration, e.g. "All quality checks passed"
    # or "Demand line regenerated 1 time(s)"
    validation_notes: List[str] = field(default_factory=list)

    source_refs: List[Dict[str, str]] = field(default_factory=list)
    takeaway: str = ""
    quality_status: str = "checked"
    quality_message: str = "Quality checked"


def _safe_float(x) -> Optional[float]:
    try:
        if x is None:
            return None
        v = float(x)
        if pd.isna(v):
            return None
        return v
    except Exception:
        return None


def _serialize_sources(sources: list) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen = set()

    for s in sources:
        title = getattr(s, "title", None) or ""
        url = getattr(s, "url", None) or ""
        date = getattr(s, "date", None) or ""

        if not url or url in seen:
            continue
        seen.add(url)

        try:
            domain = _clean_domain(urlparse(url).netloc)
        except Exception:
            domain = ""

        out.append({
            "title": title.strip() or domain or url,
            "url": url,
            "date": date,
            "domain": domain,
        })

    return out[:4]
    
def _compute_cagr(start_val: Optional[float], end_val: Optional[float], years: int) -> Optional[float]:
    sv = _safe_float(start_val)
    ev = _safe_float(end_val)
    if sv is None or ev is None or sv <= 0 or years <= 0:
        return None
    return (ev / sv) ** (1.0 / years) - 1.0


def _sum_revenue_by_year(df: pd.DataFrame) -> Dict[int, float]:
    if df is None or df.empty:
        return {}
    out: Dict[int, float] = {}
    for y, g in df.groupby("Year"):
        try:
            out[int(y)] = float(pd.to_numeric(g["Revenue"], errors="coerce").sum(skipna=True))
        except Exception:
            out[int(y)] = float("nan")
    return out


def resolve_region_for_country(df: pd.DataFrame, country: str) -> Optional[str]:
    """Derive a country's region from the dataset (mode)."""
    if df is None or df.empty or "Region" not in df.columns or "Country" not in df.columns:
        return None
    sub = df[
        df["Country"].astype(str).str.strip().str.casefold()
        == str(country).strip().casefold()
    ]
    if sub.empty:
        return None
    vals = sub["Region"].dropna().astype(str).map(lambda x: x.strip()).tolist()
    if not vals:
        return None
    return pd.Series(vals).mode().iloc[0]


def compute_country_and_region_cagr(
    df_long: pd.DataFrame,
    category: str,
    country: str,
    region: str,
    start_year: int = FORECAST_START,
    end_year: int = FORECAST_END,
) -> Tuple[Optional[float], Optional[float], Optional[float], Dict[str, object]]:
    debug: Dict[str, object] = {
        "category": category,
        "country": country,
        "region": region,
        "start_year": start_year,
        "end_year": end_year,
    }

    # Filter to category first (robust to case differences)
    df_cat = df_long[
        df_long["Category"].astype(str).str.strip().str.casefold()
        == str(category).strip().casefold()
    ].copy()
    debug["rows_in_category"] = int(len(df_cat))

    # Country slice
    df_country = df_cat[
        df_cat["Country"].astype(str).str.strip().str.casefold()
        == str(country).strip().casefold()
    ].copy()

    # Region slice (all countries in region)
    df_region = df_cat[
        df_cat["Region"].astype(str).str.strip().str.casefold()
        == str(region).strip().casefold()
    ].copy()

    country_by_year = _sum_revenue_by_year(df_country)
    region_by_year = _sum_revenue_by_year(df_region)

    debug["country_rev_start"] = country_by_year.get(start_year)
    debug["country_rev_end"] = country_by_year.get(end_year)
    debug["region_rev_start"] = region_by_year.get(start_year)
    debug["region_rev_end"] = region_by_year.get(end_year)

    years = end_year - start_year
    country_cagr = _compute_cagr(country_by_year.get(start_year), country_by_year.get(end_year), years)
    region_cagr = _compute_cagr(region_by_year.get(start_year), region_by_year.get(end_year), years)

    delta_pp = None
    if country_cagr is not None and region_cagr is not None:
        delta_pp = (country_cagr - region_cagr) * 100.0

    debug["country_cagr"] = country_cagr
    debug["region_cagr"] = region_cagr
    debug["delta_pp"] = delta_pp

    return country_cagr, region_cagr, delta_pp, debug


def classify_band(delta_pp: Optional[float]) -> str:
    if delta_pp is None:
        return LABEL_STABLE

    if CAGR_DELTA_STABLE_LOW_PP <= delta_pp <= CAGR_DELTA_STABLE_HIGH_PP:
        return LABEL_STABLE

    if delta_pp > CAGR_DELTA_STABLE_HIGH_PP:
        if delta_pp <= CAGR_DELTA_MODERATE_GROWTH_HIGH_PP:
            return LABEL_MODERATE_GROWTH
        return LABEL_STRONG_GROWTH

    # delta_pp < stable low
    if delta_pp >= CAGR_DELTA_MODERATE_FALL_LOW_PP:
        return LABEL_MODERATE_UNDERPERFORMANCE

    return LABEL_MATERIAL_UNDERPERFORMANCE


def comparator_phrase(band_label: str) -> str:
    if band_label == LABEL_STABLE:
        return "broadly in line with"
    if band_label == LABEL_MODERATE_GROWTH:
        return "moderately outperforming"
    if band_label == LABEL_STRONG_GROWTH:
        return "significantly outperforming"
    if band_label == LABEL_MODERATE_UNDERPERFORMANCE:
        return "underperforming"
    return "materially underperforming"


def build_headline(
    category: str,
    country: str,
    region: str,
    country_cagr: Optional[float],
    region_cagr: Optional[float],
    band_label: str,
    start_year: int = FORECAST_START,
    end_year: int = FORECAST_END,
) -> str:
    c = "N/A" if country_cagr is None else f"{country_cagr*100:.1f}%"
    r = "N/A" if region_cagr is None else f"{region_cagr*100:.1f}%"

    phrase = comparator_phrase(band_label)

    cat_lower = category.strip().casefold()
    if "construction overall" in cat_lower or "construction" in cat_lower:
        subject = f"{country}'s construction market"
    elif "building products" in cat_lower or "building" in cat_lower:
        subject = f"{country}'s building products market"
    else:
        subject = f"{country}'s cement, concrete and lime market"

    # If underperforming, do NOT show regional comparison (per requirement)
    if band_label in (LABEL_MODERATE_UNDERPERFORMANCE, LABEL_MATERIAL_UNDERPERFORMANCE):
        return (
            f"{subject} is expected to grow at ~{c} CAGR over {start_year}–{end_year}."
        )

    # Otherwise, show regional comparison
    return (
        f"{subject} is expected to grow at ~{c} CAGR over {start_year}–{end_year}, "
        f"{phrase} the {region} average of ~{r}."
    )


def build_transition(category: str, band_label: str) -> str:
    # Short bridge into bullets; no longer rendered in the new UI but kept for
    # backwards-compat in case any downstream caller reads it.
    if band_label == LABEL_STABLE:
        return "This relative positioning reflects a balance of supportive and offsetting forces across demand, policy, and costs."
    if band_label in (LABEL_MODERATE_GROWTH, LABEL_STRONG_GROWTH):
        return "The outperformance is underpinned by identifiable demand tailwinds and policy or funding support, alongside manageable delivery constraints."
    return "The underperformance reflects weaker underlying demand and/or constraints that are more binding than in peer markets."

def _clean_domain(netloc: str) -> str:
    netloc = (netloc or "").strip().lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    return netloc.lstrip(".")

def _extract_source_domains(sources: list) -> List[str]:
    """Deduplicated list of eTLD+1 domains from a list of SourceRef objects."""
    seen: dict[str, None] = {}
    for s in sources:
        url = getattr(s, "url", None) or ""
        if not url:
            continue
        try:
            domain = _clean_domain(urlparse(url).netloc)
            if domain:
                seen[domain] = None
        except Exception:
            pass
    return list(seen.keys())[:4]


def _build_validation_notes(rdebug: Dict[str, object]) -> List[str]:
    """
    Summarise regeneration activity into a single human-readable note.

    reason_web_engine.py sets boolean flags under keys like:
        regen_demand, regen_risk, regen_risk_downside,
        regen_policy, regen_global, regen_cagr
    """
    regen_flags = {
        k: v for k, v in rdebug.items()
        if k.startswith("regen_") and isinstance(v, bool) and v
    }

    if not regen_flags:
        return ["All quality checks passed"]

    # Map internal flag names to readable descriptions
    label_map = {
        "regen_demand":        "Demand line (figures removed)",
        "regen_risk":          "Risk line (evidence anchor added)",
        "regen_risk_downside": "Risk line (downside framing enforced)",
        "regen_policy":        "Policy line (country-specific)",
        "regen_global":        "Global quality pass",
        "regen_cagr":          "CAGR consistency pass",
    }

    parts = [label_map.get(k, k) for k in regen_flags]
    count = len(parts)
    label_str = "; ".join(parts)
    plural = "regeneration" if count == 1 else "regenerations"
    return [f"{count} {plural}: {label_str}"]


def build_country_exec_outlook(
    df_long: pd.DataFrame,
    country: str,
    *,
    start_year: int = FORECAST_START,
    end_year: int = FORECAST_END,
    model: Optional[str] = None,
    use_web_reasons: bool = True,
    use_cache: bool = True,
) -> List[SectionOutlook]:
    """Build the 1-page Executive Outlook sections for a single country."""
    if df_long is None or df_long.empty:
        return []

    region = resolve_region_for_country(df_long, country) or "Region"

    # local import to avoid circular deps
    from exec_summary.reason_web_engine import generate_exec_outlook_bullets

    sections: List[SectionOutlook] = []

    for category in SECTION_CATEGORIES:
        country_cagr, region_cagr, delta_pp, debug = compute_country_and_region_cagr(
            df_long=df_long,
            category=category,
            country=country,
            region=region,
            start_year=start_year,
            end_year=end_year,
        )

        band = classify_band(delta_pp)
        headline = build_headline(
            category=category,
            country=country,
            region=region,
            country_cagr=country_cagr,
            region_cagr=region_cagr,
            band_label=band,
            start_year=start_year,
            end_year=end_year,
        )
        transition = build_transition(category, band)

        bullets: List[str] = []
        sources = []
        src_debug: Dict[str, object] = {}

        if use_web_reasons:
            kwargs = dict(
                country=country,
                region=region,
                category=category,
                start_year=start_year,
                end_year=end_year,
                country_cagr=country_cagr,
                region_cagr=region_cagr,
                delta_pp=delta_pp,
                band_label=band,
                use_cache=use_cache,
            )
            # Only pass model if explicitly provided; do NOT pass empty string
            if model:
                kwargs["model"] = model

            bullets, sources, rdebug = generate_exec_outlook_bullets(**kwargs)

            print("==== EXEC OUTLOOK DEBUG ====")
            print("Country:", country)
            print("Category:", category)
            print("Bullets returned:", bullets)
            print("Reason debug:", rdebug)
            print("============================")

            src_debug = {
                "reason_sources": [s.__dict__ for s in sources],
                "reason_debug": rdebug,
            }
        else:
            rdebug = {}

        # ── Derive renderer-facing fields ────────────────────────────────────
        source_domains = _extract_source_domains(sources)
        validation_notes = _build_validation_notes(rdebug)

        merged_debug = {**debug, **src_debug}

        source_refs = _serialize_sources(sources)
        quality_status, quality_message = format_quality_message(validation_notes)
        takeaway = build_takeaway(headline, bullets, band)

        sections.append(
            SectionOutlook(
                category=category,
                country=country,
                region=region,
                country_cagr=country_cagr,
                region_cagr=region_cagr,
                delta_pp=delta_pp,
                band_label=band,
                headline=headline,
                transition=transition,
                bullets=bullets,
                debug=merged_debug,
                source_domains=source_domains,
                validation_notes=validation_notes,
                source_refs=source_refs,
                takeaway=takeaway,
                quality_status=quality_status,
                quality_message=quality_message,
            )
        )

    return sections