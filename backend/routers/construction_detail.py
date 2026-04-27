"""
routers/construction_detail.py
Endpoints for the Construction Detail page.
  GET  /construction-detail/meta
  POST /construction-detail/mekko
  POST /construction-detail/growth
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.construction_detail_loader import (
    get_construction_detail_df,
    get_regions,
    get_countries,
    get_segments,
    get_new_ren_values,
    get_sources,
    get_year_columns,
    get_mekko_data,
    get_growth_data,
)

router = APIRouter()

# ── Models ────────────────────────────────────────────────────────────────────

class MekkoRequest(BaseModel):
    year:       int
    top_n:      int              = 10
    show_other: bool             = True
    segment:    Optional[str]   = None
    new_ren:    Optional[str]   = None
    source:     Optional[str]   = None


class GrowthRequest(BaseModel):
    region:   str
    country:  str              = "All Countries"
    year_min: int              = 2010
    year_max: int              = 2029
    segment:  Optional[str]  = None
    new_ren:  Optional[str]  = None
    source:   Optional[str]  = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/meta")
@functools.lru_cache(maxsize=1)
def construction_detail_meta():
    """Regions, countries, segments, new/ren values, sources and years."""
    try:
        df = get_construction_detail_df()
        return {
            "regions":   get_regions(df),
            "segments":  get_segments(df),
            "new_ren":   get_new_ren_values(df),
            "sources":   get_sources(df),
            "years":     get_year_columns(df),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/countries")
def construction_detail_countries(
    region:  Optional[str] = None,
    segment: Optional[str] = None,
    new_ren: Optional[str] = None,
):
    try:
        df = get_construction_detail_df()
        return {"countries": get_countries(df, region=region, segment=segment, new_ren=new_ren)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mekko")
def construction_detail_mekko(req: MekkoRequest):
    """Mekko chart data — aggregated by Region × Country for a given year."""
    try:
        df   = get_construction_detail_df()
        data = get_mekko_data(
            df, year=req.year, top_n=req.top_n, show_other=req.show_other,
            segment=req.segment, new_ren=req.new_ren, source=req.source,
        )
        return {"data": data, "year": req.year}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/growth")
def construction_detail_growth(req: GrowthRequest):
    """Growth chart data — YoY + CAGR for a region / country."""
    try:
        df = get_construction_detail_df()
        return get_growth_data(
            df,
            region=req.region, country=req.country,
            year_min=req.year_min, year_max=req.year_max,
            segment=req.segment, new_ren=req.new_ren, source=req.source,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))