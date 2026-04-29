"""
routers/chat.py
POST /chat/  — routes the message to excel_assistant tool loop.
Hybrid approach: streaming-ready, better prompting, smarter context handling.
"""
from __future__ import annotations

import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from models.chat import ChatRequest, ChatResponse

logger = logging.getLogger("cemiq.chat")
router = APIRouter()


def _get_sheets(scope: str) -> dict:
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
    # default
    from services.flat_file_loader import get_flat_file_df
    df = get_flat_file_df()
    return {"Data (full)": df, "Data (current view)": df}


def _build_minimal_profile(df_full, df_current, scope: str) -> dict:
    """Minimal profile to keep system prompt small."""
    hints = {
        "construction_detail": "Columns: Region, Country, Segment, New/Ren, Source, 2019..2029 (year columns hold numeric values). To get segment breakdown for a country: filter by Country=='X' and group by Segment, sum the year column.",
        "flat_file":           "Columns: Category, Region, Country, year columns.",
        "global_cement":       "Columns: Country, KPI, Year, Value.",
        "ciq":                 "Columns: Company, KPI, Year, Value, Country.",
        "profit_pool":         "Columns: Category, Revenue, EBITDA, EBITDA_margin.",
        "stock_prices":        "Columns: Company, Date, Price.",
    }
    return {
        "available_sheets": {
            "Data (full)": {"rows": int(df_full.shape[0]), "cols": int(df_full.shape[1])},
        },
        "columns_sample": list(df_full.columns[:12]),
        "schema_hint": hints.get(scope, ""),
    }


def _trim_context(ctx: dict, max_chars: int = 1800) -> dict:
    """Trim chart context to stay within token limits."""
    ctx_str = json.dumps(ctx, default=str)
    if len(ctx_str) <= max_chars:
        return ctx

    trimmed = {k: v for k, v in ctx.items()
               if k not in ("top_15_countries", "top_15_by_value", "cagr_table", "all_countries")}

    for key in ("top_15_countries", "top_15_by_value"):
        if key in ctx:
            trimmed[key] = ctx[key][:8]

    if "cagr_table" in ctx:
        ct = ctx["cagr_table"]
        trimmed["cagr_table"] = {**ct, "rows": ct.get("rows", [])[:4]}

    if "all_countries" in ctx:
        entries = str(ctx["all_countries"]).split(", ")
        trimmed["all_countries"] = ", ".join(entries[:25])

    return trimmed


def _enrich_context(ctx: dict, scope: str, filters: dict) -> dict:
    """Add scope-specific instructions to context."""
    if scope == "construction_detail" and ctx.get("all_countries"):
        ctx["INSTRUCTIONS"] = (
            "1. For country market values/CAGR: read directly from all_countries field — values are pre-aggregated. "
            "2. For segment/source breakdowns: use run_query on Data (full) filtering by Country and year column. "
            "3. Report numeric values EXACTLY — do not round (e.g. $3891.9B not $4000B). "
            f"4. Current view is year={ctx.get('year', filters.get('year', 'unknown'))}. "
            "For other years, tell user to change the Year filter in the sidebar. "
            "5. Be conversational and insightful — don't just list numbers. Add brief context, comparisons, or observations to make answers useful."
        )
    return ctx


def _inject_exact_instruction(messages: list, scope: str) -> list:
    """Add exact-values instruction to last user message for scopes prone to rounding."""
    if scope not in ("construction_detail",):
        return messages
    try:
        for m in reversed(messages):
            if m.get("role") == "user":
                content = m.get("content", "")
                if "exact" not in content.lower() and "do not round" not in content.lower():
                    m["content"] = content + " [provide exact numeric values, do not round. Use markdown bullet points (- item) for lists, not indented plain text]"
                break
    except Exception:
        pass
    return messages


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
        scope  = (req.data_scope or "flat_file").lower()
        sheets = _get_sheets(scope)
        df_full    = list(sheets.values())[0]
        df_current = list(sheets.values())[-1]

        # Use minimal profile for large datasets to keep prompt small
        if scope in ("construction_detail", "ciq", "stock_prices"):
            profile = _build_minimal_profile(df_full, df_current, scope)
        else:
            profile = build_scope_profile(df_full, df_current)

        # Trim chart context
        ctx = _trim_context(req.chart_context or {})
        ctx = _enrich_context(ctx, scope, req.current_filters or {})

        # Trim currentFilters — remove verbose fields
        filters = req.current_filters or {}
        filters_trimmed = {k: v for k, v in filters.items()
                           if k not in ("data_description", "important_note", "available_metrics",
                                        "available_regions", "available_segments", "available_sources",
                                        "cagr_weights")}

        system_prompt = make_system_prompt(profile, ctx, filters_trimmed)
        system_prompt += (
            "\n\nTONE & STYLE: Be conversational and insightful like a knowledgeable analyst. "
            "Don't just list numbers — add brief observations, context, or comparisons where relevant. "
            "Use natural language. Keep responses concise but warm. "
            "When comparing countries or segments, highlight what's interesting or notable."
        )

        messages = [{"role": "system", "content": system_prompt}]
        messages += [{"role": m.role, "content": m.content} for m in req.messages]
        messages = _inject_exact_instruction(messages, scope)

        logger.info(f"Chat: scope={scope} msgs={len(req.messages)} "
                    f"prompt_len={len(system_prompt)} ctx_len={len(json.dumps(ctx, default=str))}")

        answer, _ = tool_loop_streamlit(messages, sheets=sheets, mode=req.mode)

        # Clean up overly precise decimals (e.g. $26.332263329...B → $26.3B)
        import re as _re
        def _clean_decimals(text: str) -> str:
            # Match numbers like 26.332263332914452 and round to 1-2 decimal places
            def repl(m: _re.Match) -> str:
                try:
                    num = float(m.group(0))
                    if abs(num) >= 100:
                        return f"{num:.1f}"
                    elif abs(num) >= 1:
                        return f"{num:.2f}"
                    return f"{num:.3f}"
                except Exception:
                    return m.group(0)
            return _re.sub(r'\d+\.\d{4,}', repl, text)

        answer = _clean_decimals(answer)
        return ChatResponse(answer=answer)

    except Exception as e:
        logger.error(f"Chat error: scope={scope if 'scope' in dir() else 'unknown'}, error={e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))