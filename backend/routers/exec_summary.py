"""
routers/exec_summary.py
GET /exec-summary/{country}  — builds the executive outlook for a country.
Wraps exec_summary/executive_outlook_builder.py unchanged.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from typing import Optional

router = APIRouter()


@router.get("/{country}")
def get_exec_summary(
    country: str,
    use_web_reasons: bool = Query(True),
    use_cache: bool = Query(True),
):
    """
    Returns executive summary sections for a country.
    Each section has: category, headline, bullets, band_label,
    country_cagr, region_cagr, delta_pp, source_refs, takeaway.
    """
    try:
        from exec_summary.excel_summary_data import load_exec_summary_long
        from exec_summary.executive_outlook_builder import build_country_exec_outlook
        from core.config import settings

        df_long = load_exec_summary_long(str(settings.flat_file_path))
        sections = build_country_exec_outlook(
            df_long=df_long,
            country=country,
            use_web_reasons=use_web_reasons,
            use_cache=use_cache,
        )

        result = []
        for s in sections:
            result.append({
                "category":    s.category,
                "country":     s.country,
                "region":      s.region,
                "headline":    s.headline,
                "bullets":     s.bullets,
                "band_label":  s.band_label,
                "country_cagr": s.country_cagr,
                "region_cagr":  s.region_cagr,
                "delta_pp":     s.delta_pp,
                "takeaway":     s.takeaway,
                "source_refs":  s.source_refs,
                "quality_status":  s.quality_status,
                "quality_message": s.quality_message,
            })
        return {"country": country, "sections": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/countries/list")
def list_countries():
    """Return countries available in the flat file."""
    try:
        from exec_summary.excel_summary_data import load_exec_summary_long
        from core.config import settings

        df = load_exec_summary_long(str(settings.flat_file_path))
        if "Country" not in df.columns:
            return {"countries": []}
        countries = sorted(df["Country"].dropna().astype(str).unique().tolist())
        return {"countries": countries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))