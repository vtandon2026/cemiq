"""
routers/export.py
POST /export/pptx  — proxy to think-cell Server for individual chart PPTX exports.
Used by all chart pages (Mekko, Growth, Profit Pool, Stock, KPI).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests as _requests

from core.config import settings

router = APIRouter()


# ── Request models ────────────────────────────────────────────────────────────

class TcCell(BaseModel):
    string: Optional[str] = None
    number: Optional[float] = None
    percentage: Optional[float] = None
    date: Optional[str] = None


class TcDataItem(BaseModel):
    name: str
    table: List[List[Optional[Dict[str, Any]]]]


class TcExportRequest(BaseModel):
    template: str          # key name e.g. "growth", "mekko", "bar", "category"
    data: List[TcDataItem]
    filename: Optional[str] = "chart.pptx"


# ── Template key → path resolver ──────────────────────────────────────────────

TEMPLATE_MAP: Dict[str, Path] = {
    "mekko":       settings.THINKCELL_TEMPLATE_MEKKO,
    "growth":      settings.THINKCELL_TEMPLATE_GROWTH,
    "growth_old":  settings.THINKCELL_TEMPLATE_GROWTH_OLD,
    "bar":         settings.THINKCELL_TEMPLATE_BAR,
    "bubble":      settings.THINKCELL_TEMPLATE_BUBBLE,
    "category":    settings.THINKCELL_TEMPLATE_CATEGORY,
    "construction": settings.THINKCELL_TEMPLATE_GROWTH_S2,
    "building":    settings.THINKCELL_TEMPLATE_GROWTH_S3,
    "cement":      settings.THINKCELL_TEMPLATE_GROWTH_S4,
    "stock_price":  settings.THINKCELL_TEMPLATE_BAR,   # fallback to bar template
    # "mekko_rms":    settings.THINKCELL_TEMPLATE_MEKKO,  # capacity concentration
    "mekko_rms": settings.THINKCELL_TEMPLATE_MEKKO_RMS,
    "ma":        settings.THINKCELL_TEMPLATE_MA,
}


def _resolve_template(key: str) -> str:
    """Resolve template key to absolute file:/// URL for think-cell Server."""
    path = TEMPLATE_MAP.get(key.lower())
    if path is None:
        raise ValueError(f"Unknown template key: '{key}'. Available: {list(TEMPLATE_MAP.keys())}")
    if not path.exists():
        raise FileNotFoundError(f"Template file not found: {path}")
    return path.resolve().as_uri()


def _post_to_tc(ppttc_json: str, timeout: int = 120) -> bytes:
    url = str(settings.THINKCELL_SERVER_URL).rstrip("/") + "/"
    headers = {
        "Content-Type": "application/vnd.think-cell.ppttc+json",
        "Accept": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    r = _requests.post(url, data=ppttc_json.encode("utf-8"), headers=headers, timeout=timeout)
    if not r.ok:
        detail = (r.text or "").strip() or "(empty response body)"
        raise RuntimeError(f"think-cell Server HTTP {r.status_code}: {detail}")
    return r.content


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.post("/pptx")
def export_pptx(req: TcExportRequest):
    """
    Proxy a chart data payload to think-cell Server and return the PPTX.

    The frontend sends:
      {
        "template": "growth",          // key into TEMPLATE_MAP
        "data": [{ "name": "GrowthChart", "table": [[...], ...] }],
        "filename": "construction_growth.pptx"
      }

    This endpoint resolves the template path, wraps it in the ppttc envelope,
    POSTs to think-cell Server, and streams the PPTX back.
    """
    try:
        template_url = _resolve_template(req.template)
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Build ppttc payload
    data_items = [
        {"name": item.name, "table": item.table}
        for item in req.data
    ]
    ppttc = json.dumps(
        [{"template": template_url, "data": data_items}],
        ensure_ascii=False,
        default=lambda x: x if x is not None else None,
    )

    try:
        pptx_bytes = _post_to_tc(ppttc)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"think-cell Server error: {e}")

    filename = (req.filename or "chart.pptx").replace(" ", "_")

    import io
    return StreamingResponse(
        io.BytesIO(pptx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/templates")
def list_templates():
    """List available template keys and whether the files exist on disk."""
    return {
        key: {"exists": path.exists(), "path": str(path)}
        for key, path in TEMPLATE_MAP.items()
    }