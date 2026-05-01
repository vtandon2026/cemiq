"""
routers/chat.py
POST /chat/  — routes the message to excel_assistant tool loop.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from models.chat import ChatRequest, ChatResponse, ChartBlock, TableBlock, DerivationBlock

logger = logging.getLogger("cemiq.chat")
router = APIRouter()


# ── Scope → DataFrames ────────────────────────────────────────────────────────

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
    if scope == "cement_specific":
        from services.cement_capacity_loader import get_gem_df
        df = get_gem_df()
        return {"Data (full)": df, "Data (current view)": df}
    if scope == "ma_deals":
        from services.dealogic_loader import get_dealogic_df
        df = get_dealogic_df()
        return {"Data (full)": df, "Data (current view)": df}
    # default
    from services.flat_file_loader import get_flat_file_df
    df = get_flat_file_df()
    return {"Data (full)": df, "Data (current view)": df}


# ── Scope hints ───────────────────────────────────────────────────────────────

_SCOPE_HINTS: Dict[str, str] = {
    "construction_detail": (
        "Columns: Region, Country, Segment, New/Ren, Source, plus year columns (2019–2029) "
        "holding numeric revenue values. Group by Segment or Country to get breakdowns."
    ),
    "flat_file": "Columns: Category, Region, Country, plus year columns.",
    "global_cement": "Columns: Country, KPI, Year, Value.",
    "ciq": "Columns: Company, KPI, Year, Value, Country.",
    "profit_pool": "Columns: Category, Revenue, EBITDA, EBITDA_margin.",
    "stock_prices": "Columns: Company, Date, Price.",
    "cement_specific": (
        "GEM Cement Tracker. Key columns: Country/Area, Cement Capacity (millions metric tonnes per annum), "
        "Operating status, Owner name (English), Parent. "
        "Use groupby_aggregate on Country/Area + Owner name to compute top-3 share per country. "
        "Filter on 'Operating status' == 'operating' by default unless asked otherwise."
    ),
    "ma_deals": (
        "Dealogic M&A dataset. Key columns: GIB Deal #, Deal Value USD (m), Pricing/Completion Date, "
        "Deal Region, Target Region (Primary), Deal Status, Deal Technique, Acquiror, Divestor, "
        "Target Business Description (Primary), Acquired Stake %, Financial Sponsor Deal (Y/N). "
        "Use Pricing/Completion Date for year-based queries (parse year from date). "
        "Deal Value USD (m) is in millions — divide by 1000 for $B totals. "
        "Count deals using nunique on GIB Deal #."
    ),
}


def _build_minimal_profile(df_full, scope: str) -> dict:
    return {
        "available_sheets": {
            "Data (full)": {"rows": int(df_full.shape[0]), "cols": int(df_full.shape[1])},
        },
        "columns_sample": list(df_full.columns[:20]),
        "schema_hint": _SCOPE_HINTS.get(scope, ""),
    }


# ── Context helpers ───────────────────────────────────────────────────────────

def _trim_context(ctx: dict, max_chars: int = 3000) -> dict:
    ctx_str = json.dumps(ctx, default=str)
    if len(ctx_str) <= max_chars:
        return ctx
    # Never trim these critical fields
    protected = {"all_years_data", "CRITICAL_FACTS", "highest_value_year",
                 "highest_count_year", "data_summary", "INSTRUCTIONS"}
    trimmed = {k: v for k, v in ctx.items()
               if k in protected or k not in ("top_15_countries", "top_15_by_value",
                                               "cagr_table", "all_countries", "countries_shown")}
    for key in ("top_15_countries", "top_15_by_value"):
        if key in ctx:
            trimmed[key] = ctx[key][:8]
    if "cagr_table" in ctx:
        ct = ctx["cagr_table"]
        trimmed["cagr_table"] = {**ct, "rows": ct.get("rows", [])[:4]}
    if "all_countries" in ctx:
        entries = str(ctx["all_countries"]).split(", ")
        trimmed["all_countries"] = ", ".join(entries[:25])
    if "countries_shown" in ctx:
        trimmed["countries_shown"] = ctx["countries_shown"][:25]
    return trimmed


def _enrich_context(ctx: dict, scope: str, filters: dict) -> dict:
    if scope == "construction_detail" and ctx.get("all_countries"):
        ctx["INSTRUCTIONS"] = (
            "1. For country market values/CAGR: read directly from all_countries field. "
            "2. For segment/source breakdowns: use run_query on Data (full). "
            f"3. Current view year={ctx.get('year', filters.get('year', 'unknown'))}. "
            "4. Report numeric values EXACTLY — do not round."
        )
    if scope == "cement_specific":
        ctx["INSTRUCTIONS"] = (
            "This is the GEM Cement & Concrete Tracker. "
            "Bar width in the chart = total capacity (Mt). Bar height = Top 3 share (%). "
            "Red = Top 3 producers, Grey = Other producers. "
            "Use run_query to compute capacity shares, top producers, country rankings. "
            "Always filter by Operating status == 'operating' unless user specifies otherwise. "
            "CHART GENERATION: When the user asks for a chart, bar chart, pie chart, or any visualization, "
            "you MUST include a ```json __chart__ block using data from the dataset or chart context. "
            "Use the data_summary from context for quick charts without querying."
        )
    if scope == "ma_deals":
        # Pre-compute highest year directly from context data
        all_years = ctx.get("all_years_data", [])
        if all_years:
            highest_val = max(all_years, key=lambda x: x.get("deal_value_b") or 0)
            highest_cnt = max(all_years, key=lambda x: x.get("deal_count") or 0)
            ctx["highest_value_year"] = highest_val
            ctx["highest_count_year"] = highest_cnt
            ctx["CRITICAL_FACTS"] = (
                f"HIGHEST DEAL VALUE YEAR: {highest_val.get('year')} with ${highest_val.get('deal_value_b')}B. "
                f"HIGHEST DEAL COUNT YEAR: {highest_cnt.get('year')} with {highest_cnt.get('deal_count')} deals. "
                f"These are FACTS from the actual dataset. Do NOT override with training knowledge."
            )
        ctx["INSTRUCTIONS"] = (
            "This is a Dealogic M&A dataset for the cement industry. "
            "ALWAYS use 'CRITICAL_FACTS' and 'all_years_data' from this context for year-level answers. "
            "NEVER use your training knowledge to answer questions about specific years, values or counts — "
            "the dataset may differ from what you know. "
            "Only use run_query for deal-level details (specific companies, acquirors, targets, etc.). "
            "Deal Value USD (m) / 1000 = $B. Count unique deals using nunique on GIB Deal #. "
            "CHART GENERATION: When the user asks for a chart, you MUST include a ```json __chart__ block "
            "using all_years_data from context. Use type='bar_line' for value+count, 'bar' for value only."
        )
    return ctx


def _inject_exact_instruction(messages: list, scope: str) -> list:
    if scope not in ("construction_detail",):
        return messages
    try:
        for m in reversed(messages):
            if m.get("role") == "user":
                content = m.get("content", "")
                if "exact" not in content.lower():
                    m["content"] = content + " [provide exact numeric values, do not round]"
                break
    except Exception:
        pass
    return messages


# ── Structured block extraction ───────────────────────────────────────────────

def _extract_structured_blocks(answer: str) -> tuple[str, Optional[ChartBlock], Optional[TableBlock], Optional[DerivationBlock]]:
    """
    Parse special JSON blocks from the answer text:
      ```json __chart__ {...} ```
      ```json __table__ {...} ```
      ```json __derivation__ {...} ```
    Returns cleaned text + extracted blocks.
    """
    chart_block: Optional[ChartBlock] = None
    table_block: Optional[TableBlock] = None
    deriv_block: Optional[DerivationBlock] = None

    # Match fenced JSON blocks with __type__ prefix
    pattern = re.compile(
        r'```json\s*__(chart|table|derivation)__\s*(\{[\s\S]*?\})\s*```',
        re.IGNORECASE
    )

    def _replace(m: re.Match) -> str:
        nonlocal chart_block, table_block, deriv_block
        block_type = m.group(1).lower()
        json_str = m.group(2)
        try:
            data = json.loads(json_str)
            if block_type == "chart" and chart_block is None:
                chart_block = ChartBlock(**data)
            elif block_type == "table" and table_block is None:
                table_block = TableBlock(**data)
            elif block_type == "derivation" and deriv_block is None:
                deriv_block = DerivationBlock(**data)
        except Exception as e:
            logger.warning(f"Failed to parse {block_type} block: {e}")
        return ""  # Remove block from text

    cleaned = pattern.sub(_replace, answer).strip()

    # Also try to auto-detect markdown tables and convert them
    if table_block is None:
        table_block = _try_extract_markdown_table(cleaned)
        if table_block:
            # Remove the markdown table from cleaned text to avoid duplication
            cleaned = re.sub(r'\|.+\|[\s\S]*?(?=\n\n|\Z)', '', cleaned, count=1).strip()

    return cleaned, chart_block, table_block, deriv_block


def _try_extract_markdown_table(text: str) -> Optional[TableBlock]:
    """Extract first markdown table from text if present."""
    lines = text.split('\n')
    table_lines = []
    in_table = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith('|') and stripped.endswith('|'):
            in_table = True
            table_lines.append(stripped)
        elif in_table:
            break

    if len(table_lines) < 3:  # Need header + separator + at least one row
        return None

    try:
        # Parse header
        headers = [h.strip() for h in table_lines[0].split('|') if h.strip()]
        # Skip separator row (index 1)
        rows = []
        for row_line in table_lines[2:]:
            cells = [c.strip() for c in row_line.split('|') if c.strip() != '']
            if cells:
                rows.append(cells)

        if headers and rows:
            return TableBlock(headers=headers, rows=rows)
    except Exception:
        pass
    return None


# ── System prompt augmentation for structured output ─────────────────────────

_STRUCTURED_OUTPUT_INSTRUCTIONS = """
STRUCTURED OUTPUT RULES:
When your answer contains data better shown visually, embed structured blocks AFTER your text.

SUPPORTED CHART TYPES: bar, line, bar_line, pie
DO NOT use bubble, scatter, or any other type — they are not supported.

1. TABLE: For tabular data (rankings, comparisons, deal lists):
```json __table__
{"headers": ["Col1", "Col2"], "rows": [["val1", "val2"]], "source": "Dataset name", "caption": "Optional"}
```

2. CHART — bar example:
```json __chart__
{"type": "bar", "title": "Chart title", "x_key": "country", "series": [{"name": "Capacity (Mt)", "data_key": "capacity", "type": "bar", "color": "#1A1A1A"}], "data": [{"country": "China", "capacity": 2000}]}
```

CHART — pie example:
```json __chart__
{"type": "pie", "title": "Capacity Share", "x_key": "country", "series": [{"name": "Capacity", "data_key": "value", "type": "pie"}], "data": [{"country": "China", "value": 2000}, {"country": "India", "value": 500}]}
```

CHART — bar_line example (dual axis):
```json __chart__
{"type": "bar_line", "title": "M&A Activity", "x_key": "year", "series": [{"name": "Deal Value ($B)", "data_key": "value", "type": "bar", "color": "#1A1A1A"}, {"name": "Deal Count", "data_key": "count", "type": "line", "color": "#E11C2A"}], "data": [{"year": 2010, "value": 5.2, "count": 12}]}
```

3. DERIVATION: For calculations:
```json __derivation__
{"title": "How was this calculated?", "steps": ["Step 1: ...", "Step 2: ...", "Result: ..."]}
```

4. Always end dataset answers with: **Source:** [Dataset name]

RULES:
- x_key in data objects must match x_key field exactly
- data_key in series must match keys in data objects exactly
- For pie charts: use x_key for labels, data_key for values
- Embed blocks AFTER text, never before
- Only ONE chart block per response
"""


# ── Decimal cleanup ───────────────────────────────────────────────────────────

def _clean_decimals(text: str) -> str:
    def repl(m: re.Match) -> str:
        try:
            num = float(m.group(0))
            if abs(num) >= 100:
                return f"{num:.1f}"
            elif abs(num) >= 1:
                return f"{num:.2f}"
            return f"{num:.3f}"
        except Exception:
            return m.group(0)
    return re.sub(r'\d+\.\d{4,}', repl, text)


# ── Main endpoint ─────────────────────────────────────────────────────────────

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

        # Use minimal profile for large datasets
        if scope in ("construction_detail", "ciq", "stock_prices", "cement_specific", "ma_deals"):
            profile = _build_minimal_profile(df_full, scope)
        else:
            profile = build_scope_profile(df_full, df_current)

        # Trim and enrich context
        ctx = _trim_context(req.chart_context or {})
        ctx = _enrich_context(ctx, scope, req.current_filters or {})

        # Trim filters
        filters = req.current_filters or {}
        filters_trimmed = {k: v for k, v in filters.items()
                           if k not in ("data_description", "important_note", "available_metrics",
                                        "available_regions", "available_segments", "available_sources",
                                        "cagr_weights")}

        system_prompt = make_system_prompt(profile, ctx, filters_trimmed)

        if req.mode == "dataset":
            system_prompt += (
                "\n\n⚠ STRICT DATASET MODE (Web is OFF):\n"
                "- Answer ONLY from the provided dataset and chart context.\n"
                "- Do NOT use any training knowledge, general knowledge, or external information.\n"
                "- Do NOT mention industry trends, historical events, or facts not present in the data.\n"
                "- If the answer cannot be found in the dataset or chart context, say: "
                "'I can only answer from the current dataset. This information is not available in the data.'\n"
                "- Never guess, estimate, or supplement with knowledge from outside the dataset."
            )
        else:
            system_prompt += (
                "\n\nTONE & STYLE: Be conversational and insightful like a knowledgeable analyst. "
                "Don't just list numbers — add brief observations, context, or comparisons. "
                "Use natural language. Keep responses concise but warm."
            )
        system_prompt += "\n\n" + _STRUCTURED_OUTPUT_INSTRUCTIONS

        messages = [{"role": "system", "content": system_prompt}]
        messages += [{"role": m.role, "content": m.content} for m in req.messages]
        messages = _inject_exact_instruction(messages, scope)

        logger.info(f"Chat: scope={scope} msgs={len(req.messages)} prompt_len={len(system_prompt)} "
                    f"all_years_data_count={len(ctx.get('all_years_data', []))}")

        # If user is asking for a chart, inject a reminder to generate the block
        last_user = next((m.content for m in reversed(req.messages) if m.role == "user"), "")
        chart_request_words = ["chart", "graph", "plot", "visualize", "bar chart", "line chart", "pie chart", "show chart"]
        if any(w in last_user.lower() for w in chart_request_words):
            system_prompt += (
                "\n\nCRITICAL: The user is asking for a chart. You MUST include a ```json __chart__ block "
                "in your response. Use the data already available in CHART CONTEXT (all_years_data or data_summary). "
                "Do NOT skip the chart block. Format it exactly as shown in STRUCTURED OUTPUT RULES."
            )

        # Force web search for web mode requests
        force_web = (req.mode == "web")
        answer, _ = tool_loop_streamlit(
            messages, sheets=sheets, mode=req.mode,
            force_web_search=force_web,
        )
        answer = _clean_decimals(answer)

        # Extract structured blocks
        cleaned_answer, chart_block, table_block, deriv_block = _extract_structured_blocks(answer)

        return ChatResponse(
            answer=cleaned_answer,
            chart=chart_block,
            table=table_block,
            derivation=deriv_block,
        )

    except Exception as e:
        logger.error(f"Chat error: scope={scope if 'scope' in dir() else 'unknown'}, error={e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))