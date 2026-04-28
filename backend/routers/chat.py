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
    if scope == "construction_detail":
        from services.construction_detail_loader import get_construction_detail_df
        df = get_construction_detail_df()
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

        # Trim chart_context to avoid token limit (max ~2000 chars)
        import json as _json
        ctx = req.chart_context or {}
        ctx_str = _json.dumps(ctx, default=str)
        if len(ctx_str) > 2000:
            # Keep key fields, truncate large lists
            ctx_trimmed = {k: v for k, v in ctx.items() if k not in ("top_15_countries", "top_15_by_value", "cagr_table")}
            # Add truncated versions
            for key in ("top_15_countries", "top_15_by_value"):
                if key in ctx:
                    ctx_trimmed[key] = ctx[key][:10]
            if "cagr_table" in ctx:
                ct = ctx["cagr_table"]
                ctx_trimmed["cagr_table"] = {**ct, "rows": ct.get("rows", [])[:5]}
            ctx = ctx_trimmed

        system_prompt = make_system_prompt(profile, ctx, req.current_filters)

        messages = [{"role": "system", "content": system_prompt}]
        messages += [{"role": m.role, "content": m.content} for m in req.messages]

        answer, _ = tool_loop_streamlit(messages, sheets=sheets, mode=req.mode)
        return ChatResponse(answer=answer)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))