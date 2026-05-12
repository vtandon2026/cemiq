# routers/carbon_problem.py
"""
/carbon-problem/* endpoints

ESG & Future Tech > The Carbon Problem page.
Backed by Global-Cement-and-Concrete-Tracker_July-2025.xlsx
via services/carbon_problem_loader.py.
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.carbon_problem_loader import (
    get_meta,
    get_kpis,
    get_hero_chart,
    get_map_points,
    get_integrated_grinding,
    get_plant_age,
    get_companies_for_countries,
)
from services.cache_utils import ResponseCache

router = APIRouter()
_cache = ResponseCache(maxsize=128, ttl_seconds=1800)


# ── Common filter model ───────────────────────────────────────────────────────
class CarbonFilters(BaseModel):
    countries:   Optional[List[str]] = None
    company:     Optional[str]       = None
    companies:   Optional[List[str]] = None
    plant_type:  Optional[str]       = None
    statuses:    Optional[List[str]] = None
    top_n:       int                 = 15
    axis:        Optional[str]       = None     # "company" | "plant" (only used by /hero)


# ── Meta ──────────────────────────────────────────────────────────────────────
@router.get("/meta")
@functools.lru_cache(maxsize=1)
def carbon_problem_meta():
    """Filter dropdown options for Country, Company, Plant Type, Status."""
    try:
        return get_meta()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load carbon-problem meta: {e}")


# ── Companies for selected countries ──────────────────────────────────────────
@router.get("/companies")
def carbon_problem_companies(
    # Accept BOTH formats so it works with any axios serializer:
    #   ?countries=A,B,C        (single comma-joined string — preferred)
    #   ?countries=A&countries=B (repeated key — also supported)
    countries:  Optional[str]       = Query(default=None),
    countries_: Optional[List[str]] = Query(default=None, alias="countries[]"),
):
    """
    Returns companies operating in the selected countries.
    If `countries` is omitted or empty → all companies globally.
    """
    try:
        # Parse whichever format we got
        country_list: Optional[List[str]] = None
        if countries:
            # Comma-joined string — the format the frontend now sends
            country_list = [c.strip() for c in countries.split(",") if c.strip()]
        elif countries_:
            country_list = countries_
        return {"companies": get_companies_for_countries(country_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── KPIs ──────────────────────────────────────────────────────────────────────
@router.post("/kpis")
def carbon_problem_kpis(req: CarbonFilters):
    def _compute():
        return get_kpis(
            countries=req.countries,
            company=req.company,
            plant_type=req.plant_type,
            statuses=req.statuses,
        )
    # KPIs only depend on countries + statuses (per spec); cache key strips the rest
    cache_payload = {
        "countries": sorted(req.countries) if req.countries else None,
        "statuses":  sorted(req.statuses)  if req.statuses  else None,
    }
    key = ResponseCache.make_key("carbon_kpis", cache_payload)
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Hero Chart (Wet vs Dry) ───────────────────────────────────────────────────
@router.post("/hero")
def carbon_problem_hero(req: CarbonFilters):
    def _compute():
        return get_hero_chart(
            countries=req.countries,
            company=req.company,
            companies=req.companies,
            plant_type=req.plant_type,
            statuses=req.statuses,
            top_n=req.top_n,
            axis=req.axis,
        )
    key = ResponseCache.make_key("carbon_hero", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Carbon Exposure Map ───────────────────────────────────────────────────────
@router.post("/map")
def carbon_problem_map(req: CarbonFilters):
    def _compute():
        return get_map_points(
            countries=req.countries,
            company=req.company,
            companies=req.companies,
            plant_type=req.plant_type,
            statuses=req.statuses,
        )
    key = ResponseCache.make_key("carbon_map", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Integrated vs Grinding ────────────────────────────────────────────────────
@router.post("/integrated-grinding")
def carbon_problem_integrated_grinding(req: CarbonFilters):
    def _compute():
        return get_integrated_grinding(
            countries=req.countries,
            company=req.company,
            companies=req.companies,
            plant_type=req.plant_type,
            statuses=req.statuses,
        )
    key = ResponseCache.make_key("carbon_intgr", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Plant Age Distribution ────────────────────────────────────────────────────
class PlantAgeFilters(CarbonFilters):
    reference_year: Optional[int] = None


@router.post("/plant-age")
def carbon_problem_plant_age(req: PlantAgeFilters):
    def _compute():
        return get_plant_age(
            countries=req.countries,
            company=req.company,
            companies=req.companies,
            plant_type=req.plant_type,
            statuses=req.statuses,
            reference_year=req.reference_year,
        )
    key = ResponseCache.make_key("carbon_age", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))