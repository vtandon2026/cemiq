"""
routers/company_capacity.py
/cement-specific/company-capacity/* endpoints
"""
from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


def _get_df():
    from services.cement_capacity_loader import get_gem_df
    return get_gem_df()


# ── Meta ──────────────────────────────────────────────────────────────────────
@router.get("/meta")
def company_capacity_meta():
    from services.cement_capacity_loader import get_statuses, get_all_countries
    from services.company_capacity_loader import get_companies
    df = _get_df()
    return {
        "statuses":  get_statuses(df),
        "countries": get_all_countries(df),
        "companies": get_companies(df),
    }


# ── Chart ─────────────────────────────────────────────────────────────────────
class CompanyCapRequest(BaseModel):
    statuses:     Optional[List[str]] = None
    countries:    Optional[List[str]] = None
    top_n:        int = 20
    min_capacity: float = 0.0


@router.post("/chart")
def company_capacity_chart(req: CompanyCapRequest):
    from services.company_capacity_loader import compute_company_capacity
    df = _get_df()
    data = compute_company_capacity(
        df,
        statuses=req.statuses,
        countries=req.countries,
        top_n=req.top_n,
        min_capacity=req.min_capacity,
    )
    return {"data": data}


# ── Company detail (country breakdown) ────────────────────────────────────────
class CompanyDetailRequest(BaseModel):
    company:  str
    statuses: Optional[List[str]] = None


@router.post("/detail")
def company_capacity_detail(req: CompanyDetailRequest):
    from services.company_capacity_loader import compute_company_country_breakdown
    df = _get_df()
    data = compute_company_country_breakdown(df, req.company, req.statuses)
    return {"data": data}