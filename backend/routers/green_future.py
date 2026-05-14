# routers/green_future.py
"""
/green-future/* endpoints

ESG & Future Tech > The Future of Green Cement page.
Backed by Global-Cement-and-Concrete-Tracker_July-2025.xlsx
via services/green_future_loader.py.
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.green_future_loader import (
    get_meta,
    get_companies_for_scope,
    get_kpis,
    get_map_points,
    get_clinker_vs_adoption,
    get_capacity_mix,
    get_tech_heatmap,
)
from services.cache_utils import ResponseCache

router = APIRouter()
_cache = ResponseCache(maxsize=128, ttl_seconds=1800)


# ── Common filter model ───────────────────────────────────────────────────────
class GreenFilters(BaseModel):
    regions:             Optional[List[str]] = None
    countries:           Optional[List[str]] = None
    companies:           Optional[List[str]] = None
    statuses:            Optional[List[str]] = None
    tech_types:          Optional[List[str]] = None
    group_by:            Optional[str]       = None   # "company" | "region"
    top_n:               int                 = 9999   # no cap by default
    # Highlight params: rows whose label matches will be marked `highlighted: true`
    # in the response. The functions do NOT filter by these — they're used for
    # peer-comparison views where the user wants to see the selected entity
    # in context of its siblings.
    highlight_countries: Optional[List[str]] = None
    highlight_companies: Optional[List[str]] = None


# ── Meta ──────────────────────────────────────────────────────────────────────
@router.get("/meta")
@functools.lru_cache(maxsize=1)
def green_future_meta():
    """Filter dropdown options."""
    try:
        return get_meta()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load green-future meta: {e}")


# ── Companies scoped to region + country ──────────────────────────────────────
@router.get("/companies")
def green_future_companies(
    regions:   Optional[str] = Query(default=None),
    countries: Optional[str] = Query(default=None),
):
    """
    Companies operating within the selected region/country scope.
    Accepts comma-joined strings: ?regions=Europe,APAC&countries=India,Spain
    """
    try:
        region_list  = [c.strip() for c in regions.split(",")   if c.strip()] if regions   else None
        country_list = [c.strip() for c in countries.split(",") if c.strip()] if countries else None
        return {"companies": get_companies_for_scope(region_list, country_list)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── KPIs ──────────────────────────────────────────────────────────────────────
@router.post("/kpis")
def green_future_kpis(req: GreenFilters):
    def _compute():
        return get_kpis(
            regions=req.regions, countries=req.countries,
            companies=req.companies, statuses=req.statuses,
            tech_types=req.tech_types,
        )
    key = ResponseCache.make_key("green_kpis", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Hero: Green Technology Adoption Map ───────────────────────────────────────
@router.post("/map")
def green_future_map(req: GreenFilters):
    def _compute():
        return get_map_points(
            regions=req.regions, countries=req.countries,
            companies=req.companies, statuses=req.statuses,
            tech_types=req.tech_types,
            highlight_companies=req.highlight_companies,
        )
    key = ResponseCache.make_key("green_map", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Scatter: Clinker Dependency vs Future Tech Adoption ───────────────────────
@router.post("/scatter")
def green_future_scatter(req: GreenFilters):
    def _compute():
        return get_clinker_vs_adoption(
            regions=req.regions, countries=req.countries,
            companies=req.companies, statuses=req.statuses,
            tech_types=req.tech_types,
            group_by=(req.group_by or "company"),
            highlight_countries=req.highlight_countries,
            highlight_companies=req.highlight_companies,
        )
    key = ResponseCache.make_key("green_scatter", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Stacked Bar: Future Capacity Mix ──────────────────────────────────────────
@router.post("/capacity-mix")
def green_future_capacity_mix(req: GreenFilters):
    def _compute():
        return get_capacity_mix(
            regions=req.regions, countries=req.countries,
            companies=req.companies, statuses=req.statuses,
            tech_types=req.tech_types,
            group_by=(req.group_by or "region"),
            top_n=req.top_n,
            highlight_countries=req.highlight_countries,
            highlight_companies=req.highlight_companies,
        )
    key = ResponseCache.make_key("green_mix", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Heatmap: Future Tech Adoption by Region ───────────────────────────────────
@router.post("/heatmap")
def green_future_heatmap(req: GreenFilters):
    def _compute():
        return get_tech_heatmap(
            regions=req.regions, countries=req.countries,
            companies=req.companies, statuses=req.statuses,
            tech_types=req.tech_types,
            highlight_countries=req.highlight_countries,
        )
    key = ResponseCache.make_key("green_heatmap", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))