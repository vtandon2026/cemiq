"""
routers/transition_readiness.py
/transition-readiness/* endpoints
"""
from __future__ import annotations
from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)

def _get_df():
    from services.cement_capacity_loader import get_gem_df
    return get_gem_df()


@router.get("/meta")
def meta():
    from services.transition_readiness_loader import REGION_MAP
    df = _get_df()
    regions   = sorted(set(REGION_MAP.values()))
    statuses  = sorted(df["Operating status"].dropna().unique().tolist())
    return {"regions": regions, "statuses": statuses}


class MatrixRequest(BaseModel):
    group_by:     str = "company"
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


class AllRequest(BaseModel):
    group_by:     str = "company"
    statuses:     Optional[List[str]] = None
    regions:      Optional[List[str]] = None
    countries:    Optional[List[str]] = None
    min_capacity: float = 1.0


@router.post("/all")
def all_data(req: AllRequest):
    """Single endpoint that returns matrix + heatmap + kpis in one call."""
    from services.transition_readiness_loader import compute_matrix, compute_heatmap, compute_kpis
    df = _get_df()
    # All three share the same _prep_df cache hit after the first call
    matrix_data  = compute_matrix(df, req.group_by, req.statuses, req.regions, req.countries, req.min_capacity)
    heatmap_data = compute_heatmap(df, req.statuses)
    kpis_data    = compute_kpis(df, req.statuses, req.regions, req.countries)
    return {
        "matrix":  matrix_data,
        "heatmap": heatmap_data,
        "kpis":    kpis_data,
    }