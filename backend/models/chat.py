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
    page: Optional[str] = None      # e.g. "construction_overall"
    # Which Excel sheets to make available to the tool loop
    data_scope: Optional[str] = "flat_file"  # "flat_file" | "ciq" | "profit_pool" | "geomap" | "global_cement" | "stock_prices"


class ChatResponse(BaseModel):
    answer: str
    sources: Optional[List[Dict[str, str]]] = None