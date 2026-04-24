"""
services/deck_builder/data_adapters.py
Port of Streamlit data_adapters.py for FastAPI.
Calls the exec_summary service directly (no HTTP round-trip).
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

DEFAULT_YEAR_MIN    = 2010
DEFAULT_YEAR_MAX    = 2029
DEFAULT_CUTOFF_YEAR = 2024

SECTION_MAPPING = [
    ("Construction market",       "Construction overall"),
    ("Building materials market", "Building Products Overall Sales"),
    ("Cement market",             "Cement, Concrete, Lime Overall Sales"),
]


# ── Data models ───────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class SlideBlock:
    title:    str
    headline: str
    bullets:  List[str]


@dataclass(frozen=True)
class ExecSummaryContent:
    country: str
    company: Optional[str]
    blocks:  List[SlideBlock]


@dataclass(frozen=True)
class GrowthSlideContent:
    title:       str
    headline:    str
    country:     str
    region:      str
    years:       List[int]
    yoy:         List[Optional[float]]
    revenue:     List[Optional[float]]
    cutoff_year: int                       = DEFAULT_CUTOFF_YEAR
    debug:       Optional[Dict[str, Any]] = None


# ── Exec summary ──────────────────────────────────────────────────────────────

def _fallback_blocks() -> List[SlideBlock]:
    bullets = [
        "Demand: Data not available.",
        "Policy & funding: Data not available.",
        "Supply & costs: Data not available.",
    ]
    return [
        SlideBlock(title="Construction market",       headline="Data not available.", bullets=bullets),
        SlideBlock(title="Building materials market", headline="Data not available.", bullets=bullets),
        SlideBlock(title="Cement market",             headline="Data not available.", bullets=bullets),
    ]


def get_exec_summary_content(
    *,
    country: str,
    company: Optional[str] = None,
    slide_polish: bool = True,
    use_web_reasons: bool = True,
    use_cache: bool = True,
) -> ExecSummaryContent:
    """
    Build exec summary content by calling the same service used by the
    exec-summary API endpoint directly (no HTTP round-trip).
    """
    try:
        from exec_summary.excel_summary_data import load_exec_summary_long
        from exec_summary.executive_outlook_builder import build_country_exec_outlook
        from core.config import settings

        df_long  = load_exec_summary_long(str(settings.flat_file_path))
        sections = build_country_exec_outlook(
            df_long=df_long,
            country=country,
            use_web_reasons=use_web_reasons,
            use_cache=use_cache,
        )

        blocks: List[SlideBlock] = []
        for slide_title, cat in SECTION_MAPPING:
            sec = next(
                (s for s in sections
                 if (s.category or "").strip().casefold() == cat.casefold()),
                None,
            )
            if sec:
                bullets = [
                    b.replace("**", "").strip()
                    for b in (sec.bullets or [])
                    if str(b).strip()
                ][:3]
                # Pad to 3 bullets
                while len(bullets) < 3:
                    bullets.append("Data not available.")
                blocks.append(SlideBlock(
                    title=slide_title,
                    headline=(sec.headline or "").strip(),
                    bullets=bullets,
                ))
            else:
                blocks.append(SlideBlock(
                    title=slide_title,
                    headline="Data not available for this segment.",
                    bullets=[
                        "Demand: Data not available.",
                        "Policy & funding: Data not available.",
                        "Supply & costs: Data not available.",
                    ],
                ))

        print(f"[DATA_ADAPTERS] Exec summary built for {country}: {len(blocks)} blocks", flush=True)
        return ExecSummaryContent(country=country, company=company, blocks=blocks)

    except Exception as e:
        print(f"[DATA_ADAPTERS] Exec summary failed for {country}: {e}", flush=True)
        return ExecSummaryContent(
            country=country,
            company=company,
            blocks=_fallback_blocks(),
        )


# ── Growth helpers ─────────────────────────────────────────────────────────────

def _resolve_region_for_country(df: pd.DataFrame, country: str) -> str:
    if df is None or df.empty or not {"Region", "Country"}.issubset(df.columns):
        return "Region"
    sub  = df[df["Country"].astype(str).str.strip().str.casefold() == country.strip().casefold()]
    vals = sub["Region"].dropna().astype(str).str.strip().tolist()
    return pd.Series(vals).mode().iloc[0] if vals else "Region"


def _extract_year_columns(df: pd.DataFrame, year_min: int, year_max: int) -> List[int]:
    years: List[int] = []
    for col in df.columns:
        try:
            y = int(str(col))
            if year_min <= y <= year_max:
                years.append(y)
        except (ValueError, TypeError):
            pass
    return sorted(set(years))


def _compute_revenue_by_year(df: pd.DataFrame, years: List[int]) -> Dict[int, Optional[float]]:
    result: Dict[int, Optional[float]] = {}
    for y in years:
        s = pd.to_numeric(df[str(y)], errors="coerce")
        result[y] = float(s.sum(skipna=True)) if not s.dropna().empty else None
    return result


def _compute_yoy(
    years: List[int],
    rev: Dict[int, Optional[float]],
) -> Dict[int, Optional[float]]:
    yoy: Dict[int, Optional[float]] = {years[0]: None}
    for prev_y, cur_y in zip(years, years[1:]):
        p, c = rev.get(prev_y), rev.get(cur_y)
        yoy[cur_y] = ((c / p) - 1.0) if (p and c is not None) else None
    return yoy


def _growth_headline(
    country: str,
    years: List[int],
    yoy_by_year: Dict[int, Optional[float]],
) -> str:
    latest     = years[-1]
    latest_yoy = yoy_by_year.get(latest)
    if latest_yoy is None:
        return f"{country}: YoY growth is mixed; some years are missing or incomplete."
    return f"{country}: YoY revenue growth in {latest} is {latest_yoy * 100:+.1f}% (annual totals)."


def _empty_growth(
    category: str,
    country: str,
    headline: str,
    cutoff_year: int,
    **kwargs,
) -> GrowthSlideContent:
    return GrowthSlideContent(
        title=f"{category} — Growth view",
        headline=headline,
        country=country,
        region=kwargs.get("region", "Region"),
        years=kwargs.get("years", []),
        yoy=kwargs.get("yoy", []),
        revenue=kwargs.get("revenue", []),
        cutoff_year=cutoff_year,
        debug=kwargs.get("debug"),
    )


def compute_growth_view_series(
    df_flat: pd.DataFrame,
    *,
    category: str,
    country: str,
    year_min:    int = DEFAULT_YEAR_MIN,
    year_max:    int = DEFAULT_YEAR_MAX,
    cutoff_year: int = DEFAULT_CUTOFF_YEAR,
) -> GrowthSlideContent:
    if df_flat is None or df_flat.empty:
        return _empty_growth(category, country, "No data available.", cutoff_year)

    missing = [c for c in ("Category", "Country", "Region") if c not in df_flat.columns]
    if missing:
        return _empty_growth(category, country, f"Missing columns: {missing}", cutoff_year)

    base = df_flat[
        df_flat["Category"].astype(str).str.strip().str.casefold() == category.strip().casefold()
    ].copy()

    if base.empty:
        return _empty_growth(category, country, "No rows for this category.", cutoff_year)

    region   = _resolve_region_for_country(base, country)
    slice_rc = base[
        (base["Region"].astype(str).str.strip().str.casefold()  == region.lower())
        & (base["Country"].astype(str).str.strip().str.casefold() == country.strip().casefold())
    ].copy()

    years = _extract_year_columns(slice_rc, year_min, year_max)

    if slice_rc.empty or len(years) < 2:
        return _empty_growth(
            category, country,
            "Not enough data points to compute YoY growth.",
            cutoff_year,
            region=region, years=years,
            yoy=[None] * len(years),
            revenue=[None] * len(years),
            debug={"rows": len(slice_rc), "years_found": years},
        )

    revenue_by_year = _compute_revenue_by_year(slice_rc, years)
    yoy_by_year     = _compute_yoy(years, revenue_by_year)

    return GrowthSlideContent(
        title=f"{category} — Growth view",
        headline=_growth_headline(country, years, yoy_by_year),
        country=country,
        region=region,
        years=years,
        yoy=[yoy_by_year.get(y) for y in years],
        revenue=[revenue_by_year.get(y) for y in years],
        cutoff_year=cutoff_year,
        debug={"rows": len(slice_rc), "region": region},
    )