"""
routers/transition_readiness.py
/esg/transition-readiness/* endpoints
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

def _get_df():
    from services.cement_capacity_loader import get_gem_df
    return get_gem_df()

@router.get("/meta")
def meta():
    from services.transition_readiness_loader import REGION_MAP
    df = _get_df()
    regions   = sorted(set(REGION_MAP.values()))
    countries = sorted(df["Country/Area"].dropna().unique().tolist())
    statuses  = sorted(df["Operating status"].dropna().unique().tolist())
    companies = sorted(set(
        __import__("re").sub(r"\s*\[\d+\.?\d*%?\]", "", str(r).split(";")[0]).strip()
        for r in df["Owner name (English)"].dropna()
    ))
    return {"regions": regions, "countries": countries, "statuses": statuses, "companies": companies[:200]}

class MatrixRequest(BaseModel):
    group_by:     str = "company"   # company | region | country
    statuses:     Optional[List[str]] = None
    regions:      Optional[List[str]] = None
    countries:    Optional[List[str]] = None
    min_capacity: float = 1.0

@router.post("/matrix")
def matrix(req: MatrixRequest):
    from services.transition_readiness_loader import compute_matrix
    df   = _get_df()
    data = compute_matrix(df, req.group_by, req.statuses, req.regions, req.countries, req.min_capacity)
    return {"data": data}

class HeatmapRequest(BaseModel):
    statuses: Optional[List[str]] = None

@router.post("/heatmap")
def heatmap(req: HeatmapRequest):
    from services.transition_readiness_loader import compute_heatmap
    df   = _get_df()
    data = compute_heatmap(df, req.statuses)
    return {"data": data}

class KpiRequest(BaseModel):
    statuses:  Optional[List[str]] = None
    regions:   Optional[List[str]] = None
    countries: Optional[List[str]] = None

@router.post("/kpis")
def kpis(req: KpiRequest):
    from services.transition_readiness_loader import compute_kpis
    df   = _get_df()
    data = compute_kpis(df, req.statuses, req.regions, req.countries)
    return data