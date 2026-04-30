# """
# models/chat.py
# Pydantic models for the chat endpoint.
# """
# from __future__ import annotations

# from typing import Any, Dict, List, Optional
# from pydantic import BaseModel


# class ChatMessage(BaseModel):
#     role: str       # "user" | "assistant" | "system"
#     content: str


# class ChatRequest(BaseModel):
#     messages: List[ChatMessage]
#     current_filters: Dict[str, Any] = {}
#     chart_context: Dict[str, Any] = {}
#     mode: str = "dataset"           # "dataset" | "web"
#     page: Optional[str] = None      # e.g. "construction_overall"
#     # Which Excel sheets to make available to the tool loop
#     data_scope: Optional[str] = "flat_file"  # "flat_file" | "ciq" | "profit_pool" | "geomap" | "global_cement" | "stock_prices"


# class ChatResponse(BaseModel):
#     answer: str
#     sources: Optional[List[Dict[str, str]]] = None





"""
models/chat.py
Pydantic models for the chat endpoint.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: str       # "user" | "assistant" | "system"
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    current_filters: Dict[str, Any] = {}
    chart_context: Dict[str, Any] = {}
    mode: str = "dataset"           # "dataset" | "web"
    page: Optional[str] = None
    data_scope: Optional[str] = "flat_file"


# ── Structured blocks returned alongside text ─────────────────────────────────

class ChartBlock(BaseModel):
    type: str                        # "bar" | "line" | "bar_line" | "pie"
    title: Optional[str] = None
    x_key: str
    series: List[Dict[str, Any]]     # [{name, data_key, type?, color?}]
    data: List[Dict[str, Any]]       # [{x_key: val, series1: val, ...}]
    x_label: Optional[str] = None
    y_label: Optional[str] = None
    y2_label: Optional[str] = None


class TableBlock(BaseModel):
    headers: List[str]
    rows: List[List[Any]]
    source: Optional[str] = None
    caption: Optional[str] = None


class DerivationBlock(BaseModel):
    title: str = "How was this calculated?"
    steps: List[str]


class ChatResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, str]]] = None
    chart: Optional[ChartBlock] = None
    table: Optional[TableBlock] = None
    derivation: Optional[DerivationBlock] = None