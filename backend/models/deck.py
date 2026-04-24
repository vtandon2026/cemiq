"""
models/deck.py
Pydantic models for the deck builder endpoint.
"""
from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel


class KpiSelectionModel(BaseModel):
    kpi_key: str
    chart_mode: str = "both"   # "point_in_time" | "time_series" | "both"


class ComparisonRequestModel(BaseModel):
    base_company: str
    peer_companies: List[str]
    kpi_selections: List[KpiSelectionModel]
    year: int
    country: Optional[str] = None
    year_range_start: int = 2010


class DeckBuildRequest(BaseModel):
    country: Optional[str] = None
    company: Optional[str] = None
    year: Optional[int] = None
    comparison_request: Optional[ComparisonRequestModel] = None


class DeckBuildResponse(BaseModel):
    filename: str
    slide_count: int
    # PPTX bytes returned as download, not in this model