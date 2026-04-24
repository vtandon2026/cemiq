"""
models/data.py
Pydantic request / response models for data endpoints.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


# ── Query params as body models (for POST requests) ───────────────────────────

class MekkoRequest(BaseModel):
    category: str
    year: int
    top_n: int = 10
    show_other: bool = True
    kpi_filters: Optional[Dict[str, str]] = None


class GrowthRequest(BaseModel):
    category: str
    region: str
    country: str
    year_min: int = 2010
    year_max: int = 2029
    kpi_filters: Optional[Dict[str, str]] = None


class KpiRequest(BaseModel):
    kpi_key: str
    year: int
    companies: List[str]
    country: Optional[str] = "All"
    chart_mode: str = "point_in_time"  # "point_in_time" | "time_series" | "both"
    year_range_start: int = 2010


class ProfitPoolRequest(BaseModel):
    year: int
    selected_regions: Optional[List[str]] = None
    selected_countries: Optional[List[str]] = None


class GlobalCementRequest(BaseModel):
    kpi: str
    countries: List[str]
    view: str = "time_series"   # "time_series" | "point_in_time"
    year: Optional[int] = None


class StockPriceRequest(BaseModel):
    companies: List[str]
    end_year: int
    window_years: int = 1
    country: Optional[str] = None


class GeoMapRequest(BaseModel):
    companies: Optional[List[str]] = None
    cap_min: Optional[float] = None
    cap_max: Optional[float] = None
    status: Optional[List[str]] = None
    cement_type: Optional[List[str]] = None
    us_region: Optional[List[str]] = None
    top_n_state: int = 5
    state_share_cutoff: float = 0.0


# ── Generic response wrappers ─────────────────────────────────────────────────

class DataResponse(BaseModel):
    data: Any
    meta: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    detail: str