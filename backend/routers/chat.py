"""
routers/chat.py
POST /chat/  — routes the message to excel_assistant tool loop.
Selects the right DataFrames based on data_scope.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from models.chat import ChatRequest, ChatResponse

router = APIRouter()


def _get_sheets(data_scope: str) -> dict:
    scope = (data_scope or "flat_file").lower()

    if scope == "flat_file":
        from services.flat_file_loader import get_flat_file_df
        df = get_flat_file_df()
        return {"Data (full)": df, "Data (current view)": df}
    if scope == "ciq":
        from services.ciq_loader import get_ciq_long_df
        df = get_ciq_long_df()
        return {"Data (full)": df, "Data (current view)": df}
    if scope == "profit_pool":
        from services.profit_pool_loader import get_profit_pool_df
        df = get_profit_pool_df()
        return {"Data (full)": df, "Data (current view)": df}
    if scope == "geomap":
        from services.geomap_loader import get_geomap_df
        df = get_geomap_df()
        return {"Data (full)": df, "Data (filtered)": df, "Data (current view)": df}
    if scope == "global_cement":
        from services.global_cement_loader import get_global_cement_df
        df = get_global_cement_df()
        return {"Data (full)": df, "Data (current view)": df}
    if scope == "stock_prices":
        from services.stock_price_loader import get_stock_prices_df
        df = get_stock_prices_df()
        return {"Data (full)": df, "Data (current view)": df}

    from services.flat_file_loader import get_flat_file_df
    df = get_flat_file_df()
    return {"Data (full)": df, "Data (current view)": df}


@router.post("/", response_model=ChatResponse)
def chat(req: ChatRequest):
    try:
        from services.excel_assistant import (
            build_scope_profile,
            make_system_prompt,
            tool_loop_streamlit,
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=f"excel_assistant not available: {e}")

    try:
        sheets     = _get_sheets(req.data_scope or "flat_file")
        df_full    = list(sheets.values())[0]
        df_current = list(sheets.values())[-1]

        profile       = build_scope_profile(df_full, df_current)
        system_prompt = make_system_prompt(profile, req.chart_context, req.current_filters)

        messages = [{"role": "system", "content": system_prompt}]
        messages += [{"role": m.role, "content": m.content} for m in req.messages]

        answer, _ = tool_loop_streamlit(messages, sheets=sheets, mode=req.mode)
        return ChatResponse(answer=answer)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))