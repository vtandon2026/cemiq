"""
routers/transition_readiness.py
/transition-readiness/* endpoints
Uses the same ResponseCache + lru_cache pattern as green_future.py.
"""
from __future__ import annotations
import functools
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.cache_utils import ResponseCache

router = APIRouter()
_cache = ResponseCache(maxsize=128, ttl_seconds=1800)


def _get_df():
    from services.cement_capacity_loader import get_gem_df
    return get_gem_df()


# ── Meta ──────────────────────────────────────────────────────────────────────
@router.get("/meta")
@functools.lru_cache(maxsize=1)
def meta():
    from services.transition_readiness_loader import REGION_MAP
    df = _get_df()
    regions  = sorted(set(REGION_MAP.values()))
    statuses = sorted(df["Operating status"].dropna().unique().tolist())
    return {"regions": regions, "statuses": statuses}


# ── Common filter model ───────────────────────────────────────────────────────
class TransitionFilters(BaseModel):
    group_by:     str            = "company"
    statuses:     Optional[List[str]] = None
    regions:      Optional[List[str]] = None
    countries:    Optional[List[str]] = None
    min_capacity: float          = 1.0


# ── Individual endpoints (kept for backwards compat) ─────────────────────────
@router.post("/matrix")
def matrix(req: TransitionFilters):
    from services.transition_readiness_loader import compute_matrix
    def _compute():
        return {"data": compute_matrix(
            _get_df(), req.group_by, req.statuses,
            req.regions, req.countries, req.min_capacity
        )}
    key = ResponseCache.make_key("tr_matrix", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class HeatmapRequest(BaseModel):
    statuses: Optional[List[str]] = None


@router.post("/heatmap")
def heatmap(req: HeatmapRequest):
    from services.transition_readiness_loader import compute_heatmap
    def _compute():
        return compute_heatmap(_get_df(), req.statuses)
    key = ResponseCache.make_key("tr_heatmap", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class KpiRequest(BaseModel):
    statuses:  Optional[List[str]] = None
    regions:   Optional[List[str]] = None
    countries: Optional[List[str]] = None


@router.post("/kpis")
def kpis(req: KpiRequest):
    from services.transition_readiness_loader import compute_kpis
    def _compute():
        return compute_kpis(_get_df(), req.statuses, req.regions, req.countries)
    key = ResponseCache.make_key("tr_kpis", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── /all — single endpoint, shared _prep_df cache hit ─────────────────────────
@router.post("/all")
def all_data(req: TransitionFilters):
    """Returns matrix + heatmap + kpis in one call. All three share _prep_df cache."""
    from services.transition_readiness_loader import compute_matrix, compute_heatmap, compute_kpis
    def _compute():
        df = _get_df()
        return {
            "matrix":  compute_matrix(df, req.group_by, req.statuses, req.regions, req.countries, req.min_capacity),
            "heatmap": compute_heatmap(df, req.statuses),
            "kpis":    compute_kpis(df, req.statuses, req.regions, req.countries),
        }
    key = ResponseCache.make_key("tr_all", req.model_dump(mode="json"))
    try:
        return _cache.get_or_set(key, _compute)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))