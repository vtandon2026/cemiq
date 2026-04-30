# routers/ma_deals.py
"""
/cement-specific/ma-deals/* endpoints
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.dealogic_loader import (
    get_dealogic_df,
    get_year_range,
    get_deal_regions,
    get_target_regions,
    get_deal_statuses,
    get_deal_techniques,
    get_value_range,
    compute_chart_data,
    get_deals_table,
)
from services.cache_utils import ResponseCache

router = APIRouter()
_cache = ResponseCache(maxsize=256, ttl_seconds=1800)


@router.get("/ma-deals/meta")
@functools.lru_cache(maxsize=1)
def ma_deals_meta():
    df = get_dealogic_df()
    yr_min, yr_max = get_year_range(df)
    val_min, val_max = get_value_range(df)
    return {
        "year_min":       yr_min,
        "year_max":       yr_max,
        "deal_regions":   get_deal_regions(df),
        "target_regions": get_target_regions(df),
        "deal_statuses":  get_deal_statuses(df),
        "deal_techniques": get_deal_techniques(df),
        "value_min":      round(val_min, 1),
        "value_max":      round(val_max, 1),
    }


class MaDealsRequest(BaseModel):
    year_min:        int
    year_max:        int
    deal_regions:    Optional[List[str]] = None
    target_regions:  Optional[List[str]] = None
    deal_statuses:   Optional[List[str]] = None
    deal_techniques: Optional[List[str]] = None
    min_deal_value:  Optional[float] = None


@router.post("/ma-deals/chart")
def ma_deals_chart(req: MaDealsRequest):
    def _compute():
        df = get_dealogic_df()
        data = compute_chart_data(
            df,
            year_min=req.year_min,
            year_max=req.year_max,
            deal_regions=req.deal_regions,
            target_regions=req.target_regions,
            deal_statuses=req.deal_statuses,
            deal_techniques=req.deal_techniques,
            min_deal_value=req.min_deal_value,
        )
        return {"data": data}

    key = ResponseCache.make_key("ma_deals_chart", req.model_dump(mode="json"))
    return _cache.get_or_set(key, _compute)


@router.post("/ma-deals/table")
def ma_deals_table(req: MaDealsRequest):
    def _compute():
        df = get_dealogic_df()
        rows = get_deals_table(
            df,
            year_min=req.year_min,
            year_max=req.year_max,
            deal_regions=req.deal_regions,
            target_regions=req.target_regions,
            deal_statuses=req.deal_statuses,
            deal_techniques=req.deal_techniques,
            min_deal_value=req.min_deal_value,
        )
        return {"data": rows}

    key = ResponseCache.make_key("ma_deals_table", req.model_dump(mode="json"))
    return _cache.get_or_set(key, _compute)