# # routers/cement_specific.py
# """
# /cement-specific/* endpoints
# """
# from __future__ import annotations

# import functools
# from typing import List, Optional

# from fastapi import APIRouter
# from pydantic import BaseModel

# from services.cement_capacity_loader import (
#     get_gem_df,
#     get_statuses,
#     get_all_countries,
#     compute_concentration,
# )
# from services.cache_utils import ResponseCache

# router = APIRouter()
# _cache = ResponseCache(maxsize=128, ttl_seconds=1800)


# # ── Meta ──────────────────────────────────────────────────────────────────────
# @router.get("/capacity-concentration/meta")
# @functools.lru_cache(maxsize=1)
# def capacity_concentration_meta():
#     df = get_gem_df()
#     return {
#         "statuses":  get_statuses(df),
#         "countries": get_all_countries(df),
#     }


# # ── Chart ─────────────────────────────────────────────────────────────────────
# class ConcentrationRequest(BaseModel):
#     statuses:        Optional[List[str]] = None   # None = all
#     countries:       Optional[List[str]] = None   # None = top_n_countries
#     top_n_countries: int = 10


# @router.post("/capacity-concentration/chart")
# def capacity_concentration_chart(req: ConcentrationRequest):
#     def _compute():
#         df = get_gem_df()
#         data = compute_concentration(
#             df,
#             statuses=req.statuses,
#             countries=req.countries,
#             top_n_countries=req.top_n_countries,
#         )
#         return {"data": data}

#     key = ResponseCache.make_key("cap_conc", req.model_dump(mode="json"))
#     return _cache.get_or_set(key, _compute)












# routers/cement_specific.py
"""
/cement-specific/* endpoints
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from services.cement_capacity_loader import (
    get_gem_df,
    get_statuses,
    get_all_countries,
    compute_concentration,
)
from services.cache_utils import ResponseCache

router = APIRouter()
_cache = ResponseCache(maxsize=128, ttl_seconds=1800)


# ── Meta ──────────────────────────────────────────────────────────────────────
@router.get("/capacity-concentration/meta")
@functools.lru_cache(maxsize=1)
def capacity_concentration_meta():
    df = get_gem_df()
    return {
        "statuses":  get_statuses(df),
        "countries": get_all_countries(df),
    }


# ── Chart ─────────────────────────────────────────────────────────────────────
DEFAULT_COUNTRIES = [
    "Nigeria", "Australia", "Algeria", "Japan", "Thailand",
    "Indonesia", "Mexico", "Canada", "France", "United Kingdom",
    "Italy", "Poland", "Brazil", "Spain", "Germany",
    "Egypt", "India", "United States",
]

class ConcentrationRequest(BaseModel):
    statuses:        Optional[List[str]] = None
    countries:       Optional[List[str]] = DEFAULT_COUNTRIES
    top_n_countries: int = 10


@router.post("/capacity-concentration/chart")
def capacity_concentration_chart(req: ConcentrationRequest):
    def _compute():
        df = get_gem_df()
        data = compute_concentration(
            df,
            statuses=req.statuses,
            countries=req.countries,
            top_n_countries=req.top_n_countries,
        )
        return {"data": data}

    key = ResponseCache.make_key("cap_conc", req.model_dump(mode="json"))
    return _cache.get_or_set(key, _compute)