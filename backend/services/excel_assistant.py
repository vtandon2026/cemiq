# excel_assistant.py
"""
Unified Excel + chart assistant used across multiple Streamlit apps.

This version hardens the OpenAI tool-schema compatibility further.

Problem observed
---------------
Across your environments, the OpenAI API validates tool schemas differently:
- Some require tools[*].name for function tools (and sometimes also for web_search).
- Some reject tools[*].name (expect nested function schema and unnamed web_search).

You saw errors like:
- Missing required parameter: 'tools[0].name'
- Unknown parameter: 'tools[0].name'
- Missing required parameter: 'tools[1].name'

Fix
---
We now try a small set of tool-schema variants (up to 4) and automatically fall back
based on the API error message, until one succeeds.

Everything else (logic/features) is preserved:
- run_query tool with structured QueryPlan
- dataset mode + web mode
- mekko-aware prompt
- SIC-safe rounding
- "Sources:" list for web mode when citations are available

Additional reliability fix
--------------------------
For dataset mode, if the user is asking a quantitative question and the model
answers without calling the Excel query tool, we retry once and force the
run_query function. Descriptive chart questions are not forced through Excel.
If a forced Excel query fails, we recover gracefully instead of exposing raw
tool errors directly to the user.

Web-mode refinement
-------------------
If web mode is on but the user is explicitly asking only about the chart/data/Excel,
we do NOT force a web search and we do NOT append web sources.

If the user is asking for explanation / reasons / drivers / trends / latest / news,
we treat that as an external question and allow web search even if the query mentions
chart/data/value/share.
"""

from __future__ import annotations

import difflib
import json
import os
import re
from typing import Any, Dict, List, Literal, Optional, Tuple, Union

import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator

# -------------------------------------------------------------------
# OpenAI client
# -------------------------------------------------------------------
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-5")

if not OPENAI_API_KEY:
    raise RuntimeError("OPENAI_API_KEY not found. Put it in .env as OPENAI_API_KEY=sk-...")

client = OpenAI(api_key=OPENAI_API_KEY)

# -------------------------------------------------------------------
# Query Plan Schema
# -------------------------------------------------------------------
FilterOp = Literal["==", "!=", ">", ">=", "<", "<=", "in", "contains"]
AggFn = Literal["sum", "mean", "min", "max", "count", "nunique"]
Operation = Literal["aggregate", "groupby_aggregate", "topn", "lookup"]


class FilterSpec(BaseModel):
    column: str
    op: FilterOp
    value: Any

    @field_validator("value")
    @classmethod
    def validate_value(cls, v: Any) -> Any:
        def _is_scalar(x: Any) -> bool:
            return isinstance(x, (str, int, float, bool)) and not isinstance(x, type(...))

        if isinstance(v, list):
            if not all(_is_scalar(x) for x in v):
                raise ValueError("Filter value lists may only contain str, int, float, or bool items")
            return v
        if _is_scalar(v):
            return v
        raise ValueError("Filter value must be a str, int, float, bool, or a list of those values")


class MetricSpec(BaseModel):
    column: str
    agg: AggFn
    alias: Optional[str] = None


class QueryPlan(BaseModel):
    operation: Operation
    sheet: str
    filters: List[FilterSpec] = Field(default_factory=list)

    # lookup
    select_columns: Optional[List[str]] = None
    limit_rows: int = 20

    # group ops
    groupby: Optional[List[str]] = None
    metrics: Optional[List[MetricSpec]] = None

    # topn
    order_by_metric_alias: Optional[str] = None
    n: Optional[int] = 5


# -------------------------------------------------------------------
# Data query engine
# -------------------------------------------------------------------
def _norm_series_text(s: pd.Series) -> pd.Series:
    return s.astype(str).str.strip().str.casefold()


def _norm_text(x: Any) -> str:
    return str(x).strip().casefold()


def suggest_values(df: pd.DataFrame, column: str, wanted: str, n: int = 6) -> List[str]:
    if column not in df.columns:
        return []
    uniques = df[column].dropna().astype(str).map(lambda x: x.strip()).unique().tolist()
    return difflib.get_close_matches(wanted.strip(), uniques, n=n, cutoff=0.35)


def apply_filters(df: pd.DataFrame, filters: List[FilterSpec]) -> pd.DataFrame:
    out = df
    for f in filters:
        col = f.column
        if col not in out.columns:
            raise ValueError(f"Unknown filter column: '{col}'")
        v = f.value

        if f.op == "==":
            out = out[_norm_series_text(out[col]) == _norm_text(v)]
        elif f.op == "!=":
            out = out[_norm_series_text(out[col]) != _norm_text(v)]
        elif f.op in (">", ">=", "<", "<="):
            s = pd.to_numeric(out[col], errors="coerce")
            vv = float(v)  # type: ignore[arg-type]
            if f.op == ">":
                out = out[s > vv]
            elif f.op == ">=":
                out = out[s >= vv]
            elif f.op == "<":
                out = out[s < vv]
            else:
                out = out[s <= vv]
        elif f.op == "in":
            if not isinstance(v, list):
                raise ValueError("Filter op 'in' requires a list value")
            s = out[col].astype(str).str.strip()
            vv = [str(x).strip() for x in v]
            out = out[s.isin(vv)]
        elif f.op == "contains":
            out = out[out[col].astype(str).str.contains(str(v), case=False, na=False)]
        else:
            raise ValueError(f"Unsupported filter op: {f.op}")
    return out


def compute_metrics_scalar(df: pd.DataFrame, metrics: List[MetricSpec]) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    for m in metrics:
        if m.column not in df.columns:
            raise ValueError(f"Unknown metric column: '{m.column}'")

        alias = m.alias or f"{m.agg}({m.column})"
        ser = df[m.column]

        if m.agg in ("sum", "mean", "min", "max"):
            num = pd.to_numeric(ser, errors="coerce")
            if m.agg == "sum":
                result[alias] = float(num.sum(skipna=True))
            elif m.agg == "mean":
                result[alias] = float(num.mean(skipna=True))
            elif m.agg == "min":
                result[alias] = float(num.min(skipna=True))
            else:
                result[alias] = float(num.max(skipna=True))
        elif m.agg == "count":
            result[alias] = int(ser.notna().sum())
        elif m.agg == "nunique":
            result[alias] = int(ser.nunique(dropna=True))
        else:
            raise ValueError(f"Unsupported agg: {m.agg}")
    return result


def run_query_plan(sheets: Dict[str, pd.DataFrame], plan: QueryPlan) -> Dict[str, Any]:
    if plan.sheet not in sheets:
        raise ValueError(f"Unknown sheet: '{plan.sheet}'. Available: {list(sheets.keys())}")

    df0 = sheets[plan.sheet]
    before = int(df0.shape[0])
    df = apply_filters(df0, plan.filters)
    after = int(df.shape[0])

    meta = {
        "sheet": plan.sheet,
        "rows_before": before,
        "rows_after": after,
        "filters": [f.model_dump() for f in plan.filters],
    }

    if after == 0 and plan.filters:
        suggestions: Dict[str, List[str]] = {}
        for flt in plan.filters:
            if isinstance(flt.value, str):
                suggestions[flt.column] = suggest_values(df0, flt.column, flt.value)
        return {"type": "empty", "data_used": meta, "suggestions": suggestions}

    if plan.operation == "lookup":
        cols = plan.select_columns or list(df.columns)
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise ValueError(f"Unknown columns in select_columns: {missing}")
        view = df[cols].head(plan.limit_rows)
        return {"type": "table", "data_used": meta | {"select_columns": cols}, "result": view.to_dict(orient="records")}

    if plan.operation == "aggregate":
        if not plan.metrics:
            raise ValueError("metrics is required for operation='aggregate'")
        values = compute_metrics_scalar(df, plan.metrics)
        return {"type": "scalar", "data_used": meta | {"metrics": [m.model_dump() for m in plan.metrics]}, "result": values}

    if plan.operation in ("groupby_aggregate", "topn"):
        if not plan.metrics or not plan.groupby:
            raise ValueError("metrics and groupby are required for groupby_aggregate/topn")

        agg_named: Dict[str, Any] = {}
        metric_aliases: List[str] = []
        for m in plan.metrics:
            alias = m.alias or f"{m.agg}({m.column})"
            metric_aliases.append(alias)

            if m.agg in ("sum", "mean", "min", "max", "count"):
                agg_named[alias] = (m.column, m.agg)
            elif m.agg == "nunique":
                agg_named[alias] = (m.column, pd.Series.nunique)
            else:
                raise ValueError(f"Unsupported agg: {m.agg}")

        gdf = df.groupby(plan.groupby, dropna=False).agg(**agg_named).reset_index()

        if plan.operation == "groupby_aggregate":
            return {"type": "table", "data_used": meta | {"groupby": plan.groupby}, "result": gdf.to_dict(orient="records")}

        order_alias = plan.order_by_metric_alias or metric_aliases[0]
        if order_alias not in gdf.columns:
            raise ValueError(f"order_by_metric_alias '{order_alias}' not in aggregated output.")

        n = int(plan.n or 5)
        out = gdf.sort_values(by=order_alias, ascending=False).head(n)
        return {
            "type": "table",
            "data_used": meta | {"groupby": plan.groupby, "order_by_metric_alias": order_alias, "n": n},
            "result": out.to_dict(orient="records"),
        }

    raise ValueError(f"Unsupported operation: {plan.operation}")


# -------------------------------------------------------------------
# Profile + system prompt (backward-compatible)
# -------------------------------------------------------------------
def build_scope_profile(df_full: pd.DataFrame, df_view: pd.DataFrame, max_cols: int = 40) -> Dict[str, Any]:
    cols_full = [str(c) for c in df_full.columns]
    cols_view = [str(c) for c in df_view.columns]

    return {
        "available_sheets": {
            "Data (full)": {"rows": int(df_full.shape[0]), "cols": int(df_full.shape[1])},
            "Data (current view)": {"rows": int(df_view.shape[0]), "cols": int(df_view.shape[1])},
        },
        "columns_sample": cols_full[:max_cols],
        "columns_total": int(df_full.shape[1]),
        "columns_sample_full": cols_full[:max_cols],
        "columns_total_full": int(df_full.shape[1]),
        "current_view_schema": {
            "columns": cols_view[:max_cols],
            "meaning": "Data (current view) is the exact table behind the chart in the UI (after filters).",
        },
    }


def _detect_chart_family(chart_context: Dict[str, Any]) -> str:
    blob = json.dumps(chart_context or {}, default=str).casefold()
    chart_type = str(chart_context.get("chart_type", "") or "").casefold()
    title = str(chart_context.get("chart_title", "") or "").casefold()

    if "mekko" in chart_type or "marimekko" in chart_type or "mekko" in blob or "marimekko" in blob:
        return "mekko"
    if "scatter" in chart_type or "scatter" in title:
        return "scatter"
    if "line" in chart_type or "line" in title:
        return "line"
    if "bar" in chart_type or "bar" in title:
        return "bar"
    return "generic"


def make_system_prompt(profile: Dict[str, Any], chart_context: Dict[str, Any], current_filters: Dict[str, Any]) -> str:
    family = _detect_chart_family(chart_context)
    assistant_label = "Profit Pool" if family == "mekko" else "Excel"

    if family == "mekko":
        current_view_desc = 'Sheet "Data (current view)" = EXACT aggregated table behind the chart (e.g., x_val, stack_val, value).'
        chart_hint = (
            'If the user references specific bars/segments/colors/labels ("pink", "this segment", "Other"), '
            "use chart_context first; then query Data (current view) for exact numbers."
        )
    else:
        current_view_desc = 'Sheet "Data (current view)" = EXACTLY the data currently behind the chart (UI filters applied).'
        chart_hint = (
            "If the user asks about chart meaning, colors, legend, or refers to elements in the current chart/view, "
            "use chart_context first; then query Data (current view) for exact numbers."
        )

    return f"""
You are a concise, data-grounded {assistant_label} + chart assistant.

AVAILABLE QUERY SCOPES (IMPORTANT):
- Sheet "Data (full)" = entire dataset (no UI filters).
- {current_view_desc}

SCOPE RULES:
1) Chart questions:
   - {chart_hint}
2) General data questions (not about the current chart/view/filters):
   - Call tool run_query on sheet="Data (full)".
3) If the user explicitly references current filters/view ("in this view", "with the current filters", "as selected"):
   - Use sheet="Data (current view)".

GROUNDING RULES:
- Never invent numbers.
- For any numeric/table answer about the dataset, you MUST call tool run_query.
- If a filter returns 0 rows and tool returns suggestions, propose the top suggestion(s).
- Do NOT dump raw rows unless the user asks for “show rows/show table”.

RESPONSE FORMATTING RULES:
- Use clean, readable markdown.
- Prefer short paragraphs and simple bullet points over dense blocks of text.
- Use bold sparingly for short labels or takeaway phrases only.
- Do not output raw html_std.
- Do not leave markdown markers unbalanced.
- Avoid deep nesting of bullets unless the structure is necessary.

WEB / CITATION RULES (only relevant in web-enabled mode):
- Only do web lookup when mode="web".
- If you use web sources, list them under "Sources:".
- Do NOT mix dataset numbers with web-derived claims in the same sentence.
- If both dataset + web are used, keep two sections: "From your dataset" and "From web sources".

SIC RULE:
- If SIC/SIC code(s) appear, show them EXACTLY; never round or alter them.

CURRENT FILTERS / UI STATE:
{json.dumps(current_filters or {}, indent=2)}

CHART CONTEXT:
{json.dumps(chart_context or {}, indent=2)}

DATA PROFILE:
{json.dumps(profile or {}, indent=2)}
""".strip()


# -------------------------------------------------------------------
# Question classification
# -------------------------------------------------------------------
def _latest_user_text(messages: List[Dict[str, Any]]) -> str:
    for m in reversed(messages):
        if m.get("role") == "user":
            return str(m.get("content") or "").strip().casefold()
    return ""


def _looks_like_quant_query(messages: List[Dict[str, Any]]) -> bool:
    user_text = _latest_user_text(messages)

    if not user_text:
        return False

    descriptive_triggers = [
        "tell me about the chart",
        "explain the chart",
        "what does this chart show",
        "what do you see",
        "summarize the chart",
        "describe the chart",
        "walk me through the chart",
        "can you tell me about the chart",
        "can you tell me about this chart",
    ]
    if any(x in user_text for x in descriptive_triggers):
        return False

    quant_triggers = [
        "how much", "how many", "quantify", "number", "numbers", "value", "values",
        "share", "shares", "market share", "top ", "top-", "topn",
        "rank", "ranking", "concentration", "residual", "remainder",
        "cagr", "growth rate", "yoy", "percent", "percentage",
        "total", "sum", "average", "mean", "max", "min",
        "nunique", "count", "split", "breakdown", "table", "rows",
        "compare", "comparison", "vs", "versus",
    ]

    return any(x in user_text for x in quant_triggers)


def _looks_like_chart_or_excel_only_query(messages: List[Dict[str, Any]]) -> bool:
    user_text = _latest_user_text(messages)
    if not user_text:
        return False

    explanatory_markers = [
        "why", "reason", "reasons", "because",
        "driver", "drivers", "driving",
        "cause", "causes", "caused",
        "explain", "explains", "explaining",
        "what is behind", "what's behind", "what led to",
        "why is", "why are",
    ]
    if any(x in user_text for x in explanatory_markers):
        return False

    chart_excel_markers = [
        "chart", "graph", "plot", "visual", "figure",
        "excel", "spreadsheet", "sheet", "workbook",
        "data", "dataset",
        "current view", "this view", "selected filters", "current filters",
        "current chart", "this chart", "shown here", "shown in the chart",
        "from the chart", "from this chart", "from the data", "from excel",
    ]
    external_markers = [
        "web", "internet", "online", "source", "sources", "citation", "citations",
        "reference", "references", "latest", "recent", "currently", "today", "news",
        "market trend", "industry trend", "trend", "trends", "macro",
        "competitor", "external", "validate", "verify", "confirm",
        "regulation", "policy", "announcement", "announced",
        "released", "launch", "public source",
    ]

    has_chart_excel = any(x in user_text for x in chart_excel_markers)
    has_external = any(x in user_text for x in external_markers)

    if has_chart_excel and not has_external:
        return True

    explicit_dataset_only = [
        "only from the chart",
        "only from chart",
        "only from the data",
        "only from data",
        "only from excel",
        "only from the spreadsheet",
        "based only on the chart",
        "based only on the data",
        "using only the chart",
        "using only the data",
        "using only excel",
    ]
    if any(x in user_text for x in explicit_dataset_only):
        return True

    return False


# -------------------------------------------------------------------
# Rounding policy (SIC-safe)
# -------------------------------------------------------------------
def _user_wants_exact_numbers(messages: List[Dict[str, Any]]) -> bool:
    exact_triggers = [
        "exact", "precise", "full precision",
        "unrounded", "no rounding", "no round", "don't round", "do not round",
        "show exact", "give me the exact", "exact amount",
    ]
    for m in reversed(messages):
        if m.get("role") == "user":
            t = (m.get("content") or "").casefold()
            return any(x in t for x in exact_triggers)
    return False


_SIC_CONTEXT_RE = re.compile(r"\b(sic|sic code|sic codes)\b", re.IGNORECASE)


def _is_probable_sic_code(span: Tuple[int, int], text: str) -> bool:
    a, b = span
    window = 24
    left = max(0, a - window)
    right = min(len(text), b + window)
    ctx = text[left:right]
    return bool(_SIC_CONTEXT_RE.search(ctx))


def _round_thousands_in_text_sic_safe(text: str) -> str:
    pattern = r"\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d{4,}(?:\.\d+)?\b"

    def repl(m: re.Match) -> str:
        raw = m.group(0)
        try:
            num = float(raw.replace(",", ""))

            if 1900 <= num <= 2100 and abs(num - round(num)) < 1e-9:
                return raw

            is_int = abs(num - round(num)) < 1e-9
            if is_int and 100 <= num <= 9999 and _is_probable_sic_code(m.span(), text):
                return raw

            if abs(num) < 1000:
                return raw

            rounded = round(num / 1000.0) * 1000.0
            return f"{int(round(rounded)):,}"
        except Exception:
            return raw

    return re.sub(pattern, repl, text)


# -------------------------------------------------------------------
# Tools variants + adaptive retry (4 combinations)
# -------------------------------------------------------------------
ToolSchema = Literal["nested", "flat"]
WebNameMode = Literal["none", "named"]


def query_plan_tool_schema() -> Dict[str, Any]:
    """Hand-written JSON schema to avoid Union/discriminator issues in some environments."""
    scalar_schema = {
        "anyOf": [
            {"type": "string"},
            {"type": "integer"},
            {"type": "number"},
            {"type": "boolean"},
        ]
    }

    filter_spec_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "column": {"type": "string"},
            "op": {
                "type": "string",
                "enum": ["==", "!=", ">", ">=", "<", "<=", "in", "contains"],
            },
            "value": {
                "anyOf": [
                    scalar_schema,
                    {
                        "type": "array",
                        "items": scalar_schema,
                    },
                ]
            },
        },
        "required": ["column", "op", "value"],
    }

    metric_spec_schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "column": {"type": "string"},
            "agg": {
                "type": "string",
                "enum": ["sum", "mean", "min", "max", "count", "nunique"],
            },
            "alias": {"type": "string"},
        },
        "required": ["column", "agg"],
    }

    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "operation": {
                "type": "string",
                "enum": ["aggregate", "groupby_aggregate", "topn", "lookup"],
            },
            "sheet": {
                "type": "string",
                "enum": ["Data (full)", "Data (current view)"],
            },
            "filters": {
                "type": "array",
                "items": filter_spec_schema,
            },
            "select_columns": {
                "type": "array",
                "items": {"type": "string"},
            },
            "limit_rows": {"type": "integer", "default": 20},
            "groupby": {
                "type": "array",
                "items": {"type": "string"},
            },
            "metrics": {
                "type": "array",
                "items": metric_spec_schema,
            },
            "order_by_metric_alias": {"type": "string"},
            "n": {"type": "integer", "default": 5},
        },
        "required": ["operation", "sheet"],
    }


def _tools_nested(mode: str, web_name: WebNameMode) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = [
        {
            "type": "function",
            "function": {
                "name": "run_query",
                "description": (
                    "Query a pandas DataFrame ('Data (full)' or 'Data (current view)') using a structured plan. "
                    "Use this for any numeric/table answers. Returns scalars or tables."
                ),
                "parameters": query_plan_tool_schema(),
            },
        }
    ]
    if mode == "web":
        web_tool: Dict[str, Any] = {"type": "web_search"}
        if web_name == "named":
            web_tool["name"] = "web_search"
        tools = [web_tool, *tools]
    return tools


def _tools_flat(mode: str, web_name: WebNameMode) -> List[Dict[str, Any]]:
    tools: List[Dict[str, Any]] = [
        {
            "type": "function",
            "name": "run_query",
            "description": (
                "Query a pandas DataFrame ('Data (full)' or 'Data (current view)') using a structured plan. "
                "Use this for any numeric/table answers. Returns scalars or tables."
            ),
            "parameters": query_plan_tool_schema(),
        }
    ]
    if mode == "web":
        web_tool: Dict[str, Any] = {"type": "web_search"}
        if web_name == "named":
            web_tool["name"] = "web_search"
        tools = [web_tool, *tools]
    return tools


def _build_tools(mode: str, schema: ToolSchema, web_name: WebNameMode) -> List[Dict[str, Any]]:
    if schema == "nested":
        return _tools_nested(mode, web_name)
    return _tools_flat(mode, web_name)


_TOOLS_NAME_ERR_RE = re.compile(r"tools\[\d+\]\.name")


def _is_missing_tools_name_error(msg: str) -> bool:
    return bool(_TOOLS_NAME_ERR_RE.search(msg)) and "Missing required parameter" in msg


def _is_unknown_tools_name_error(msg: str) -> bool:
    return bool(_TOOLS_NAME_ERR_RE.search(msg)) and "Unknown parameter" in msg


def _build_input_from_messages(messages: List[Dict[str, Any]]) -> Tuple[str, List[Dict[str, Any]]]:
    instructions = ""
    input_list: List[Dict[str, Any]] = messages
    if messages and messages[0].get("role") == "system":
        instructions = messages[0].get("content", "") or ""
        input_list = messages[1:]
    return instructions, input_list


def _responses_create(
    input_list: List[Dict[str, Any]],
    instructions: str,
    mode: str,
    tools: List[Dict[str, Any]],
    force_web_search: bool,
    tool_choice_override: Optional[Union[str, Dict[str, Any]]] = None,
) -> Any:
    tool_choice: Union[str, Dict[str, Any]] = "auto"

    if tool_choice_override is not None:
        tool_choice = tool_choice_override
    elif mode == "web" and force_web_search:
        tool_choice = {"type": "web_search"}

    try:
        return client.responses.create(
            model=OPENAI_MODEL,
            instructions=instructions,
            input=input_list,
            tools=tools,
            tool_choice=tool_choice,
        )
    except Exception as e:
        msg = str(e)
        web_mode_tool_error = (
            mode == "web"
            and (
                "discriminator" in msg
                or "typing.Union" in msg
                or "web_search" in msg
                or "tools" in msg
            )
        )

        if not web_mode_tool_error:
            raise

        fallback_tools = [
            t for t in tools
            if not (isinstance(t, dict) and t.get("type") == "web_search")
        ]

        fallback_tool_choice: Union[str, Dict[str, Any]] = tool_choice
        if isinstance(fallback_tool_choice, dict) and fallback_tool_choice.get("type") == "web_search":
            fallback_tool_choice = "auto"

        return client.responses.create(
            model=OPENAI_MODEL,
            instructions=instructions,
            input=input_list,
            tools=fallback_tools,
            tool_choice=fallback_tool_choice,
        )


def call_model_responses_adaptive(
    input_list: List[Dict[str, Any]],
    instructions: str,
    mode: str,
    *,
    force_web_search: bool = False,
    tool_choice_override: Optional[Union[str, Dict[str, Any]]] = None,
) -> Tuple[Any, ToolSchema, WebNameMode]:
    candidates: List[Tuple[ToolSchema, WebNameMode]] = [
        ("nested", "none"),
        ("flat", "none"),
        ("flat", "named"),
        ("nested", "named"),
    ]

    last_err: Optional[Exception] = None
    for schema, web_name in candidates:
        tools = _build_tools(mode, schema, web_name)
        try:
            resp = _responses_create(
                input_list,
                instructions,
                mode,
                tools,
                force_web_search,
                tool_choice_override=tool_choice_override,
            )
            return resp, schema, web_name
        except Exception as e:
            last_err = e
            msg = str(e)

            if _is_missing_tools_name_error(msg) or _is_unknown_tools_name_error(msg):
                continue

            if "tools" in msg or "web_search" in msg or "function" in msg:
                continue

            break

    raise last_err if last_err else RuntimeError("Unknown error calling OpenAI Responses API.")


def _tool_run_query(args_json: str, sheets: Dict[str, pd.DataFrame]) -> str:
    try:
        plan = QueryPlan.model_validate_json(args_json)
        result = run_query_plan(sheets, plan)
        return json.dumps(result, default=str)
    except (ValidationError, Exception) as e:
        return json.dumps({"error": str(e)})


def _extract_url_citations(resp: Any) -> List[Dict[str, str]]:
    cites: List[Dict[str, str]] = []
    output = getattr(resp, "output", None) or []

    for o in output:
        otype = getattr(o, "type", None) or (o.get("type") if isinstance(o, dict) else None)

        if otype == "web_search_call":
            results = getattr(o, "results", None) or (o.get("results") if isinstance(o, dict) else None) or []
            for r in results:
                url = getattr(r, "url", None) if not isinstance(r, dict) else r.get("url")
                title = getattr(r, "title", None) if not isinstance(r, dict) else r.get("title")
                if url:
                    cites.append({"title": str(title or url), "url": str(url)})

        if otype == "message":
            content = getattr(o, "content", None) or (o.get("content") if isinstance(o, dict) else None) or []
            for c in content:
                ctype = getattr(c, "type", None) if not isinstance(c, dict) else c.get("type")
                if ctype == "output_text":
                    ann = getattr(c, "annotations", None) if not isinstance(c, dict) else c.get("annotations")
                    if ann:
                        for a in ann:
                            url = getattr(a, "url", None) if not isinstance(a, dict) else a.get("url")
                            title = getattr(a, "title", None) if not isinstance(a, dict) else a.get("title")
                            if url:
                                cites.append({"title": str(title or url), "url": str(url)})

    seen = set()
    deduped: List[Dict[str, str]] = []
    for c in cites:
        if c["url"] in seen:
            continue
        seen.add(c["url"])
        deduped.append(c)
    return deduped


# -------------------------------------------------------------------
# Main tool loop (for Streamlit)
# -------------------------------------------------------------------
def tool_loop_streamlit(
    messages: List[Dict[str, Any]],
    sheets: Dict[str, pd.DataFrame],
    mode: str = "dataset",
    *,
    force_web_search: bool = False,
) -> Tuple[str, List[Dict[str, Any]]]:
    if mode not in ("dataset", "web"):
        raise ValueError("mode must be 'dataset' or 'web'")

    instructions, base_input = _build_input_from_messages(messages)
    input_list: List[Dict[str, Any]] = list(base_input)

    used_web = False
    forced_first_web = False
    forced_dataset_query_retry = False
    query_failure_recovery_attempted = False
    chart_excel_only_query = _looks_like_chart_or_excel_only_query(messages)

    while True:
        should_force = False
        if mode == "web":
            if not chart_excel_only_query:
                if force_web_search:
                    should_force = True
                else:
                    should_force = (not used_web) and (not forced_first_web)

        resp, _, _ = call_model_responses_adaptive(
            input_list=input_list,
            instructions=instructions,
            mode=mode,
            force_web_search=should_force,
        )

        if mode == "web" and should_force and (not used_web) and (not forced_first_web):
            forced_first_web = True

        output = getattr(resp, "output", []) or []

        if any(
            (getattr(o, "type", None) == "web_search_call") or
            (isinstance(o, dict) and o.get("type") == "web_search_call")
            for o in output
        ):
            used_web = True

        function_calls = []
        for o in output:
            otype = getattr(o, "type", None) or (o.get("type") if isinstance(o, dict) else None)
            if otype == "function_call":
                function_calls.append(o)

        should_force_dataset_query = (
            mode == "dataset"
            and not function_calls
            and not forced_dataset_query_retry
            and _looks_like_quant_query(messages)
        )

        if should_force_dataset_query:
            forced_dataset_query_retry = True
            retry_input = list(input_list) + [
                {
                    "role": "system",
                    "content": (
                        "You must use the run_query tool for this response. "
                        "Do not answer from chart context alone when the user is asking for numbers, "
                        "business metrics, shares, top-N, concentration, residual market, "
                        "or quantified outputs."
                    ),
                }
            ]

            resp, _, _ = call_model_responses_adaptive(
                input_list=retry_input,
                instructions=instructions,
                mode=mode,
                force_web_search=False,
                tool_choice_override={"type": "function", "name": "run_query"},
            )
            output = getattr(resp, "output", []) or []

            function_calls = []
            for o in output:
                otype = getattr(o, "type", None) or (o.get("type") if isinstance(o, dict) else None)
                if otype == "function_call":
                    function_calls.append(o)

        for item in output:
            try:
                input_list.append(item.model_dump())
            except Exception:
                input_list.append(getattr(item, "__dict__", item))

        if function_calls:
            had_tool_error = False

            for fc in function_calls:
                name = getattr(fc, "name", None) if not isinstance(fc, dict) else fc.get("name")
                call_id = getattr(fc, "call_id", None) if not isinstance(fc, dict) else fc.get("call_id")
                if not call_id:
                    call_id = getattr(fc, "id", None) if not isinstance(fc, dict) else fc.get("id")

                if name != "run_query":
                    input_list.append(
                        {
                            "type": "function_call_output",
                            "call_id": call_id or "",
                            "output": json.dumps({"error": "Unknown function tool"}, default=str),
                        }
                    )
                    continue

                args = getattr(fc, "arguments", None) if not isinstance(fc, dict) else fc.get("arguments")
                tool_output = _tool_run_query(args or "{}", sheets)

                parsed_tool_output: Dict[str, Any] = {}
                try:
                    maybe_parsed = json.loads(tool_output)
                    if isinstance(maybe_parsed, dict):
                        parsed_tool_output = maybe_parsed
                except Exception:
                    parsed_tool_output = {}

                if parsed_tool_output.get("error"):
                    had_tool_error = True

                    if (
                        mode == "dataset"
                        and _looks_like_quant_query(messages)
                        and not query_failure_recovery_attempted
                    ):
                        query_failure_recovery_attempted = True
                        input_list.append(
                            {
                                "role": "system",
                                "content": (
                                    "The Excel query failed. Do not expose raw query errors to the user. "
                                    "If the user asked for quantitative output, try again with a simpler valid query plan. "
                                    "Use operation='aggregate' for totals, "
                                    "operation='groupby_aggregate' only when groupby and metrics are both supplied, "
                                    "operation='topn' only when groupby and metrics are both supplied, "
                                    "and operation='lookup' for row retrieval. "
                                    "If you still cannot compute the exact number, apologize briefly and answer using only chart context."
                                ),
                            }
                        )
                        break

                    input_list.append(
                        {
                            "type": "function_call_output",
                            "call_id": call_id or "",
                            "output": tool_output,
                        }
                    )
                    continue

                input_list.append(
                    {
                        "type": "function_call_output",
                        "call_id": call_id or "",
                        "output": tool_output,
                    }
                )

            if had_tool_error and query_failure_recovery_attempted:
                continue

            continue

        final_text = getattr(resp, "output_text", "") or ""

        citations: List[Dict[str, str]] = []
        if mode == "web" and used_web and not chart_excel_only_query:
            citations = _extract_url_citations(resp)

        if citations:
            used_web = True

        if not _user_wants_exact_numbers(messages):
            final_text = _round_thousands_in_text_sic_safe(final_text)

        if mode == "web" and not chart_excel_only_query and should_force and not used_web:
            final_text = (
                "I couldn't run a web search in this environment, so I can't provide citable sources. "
                "If web_search is disabled for your OpenAI project, enable it or use dataset mode."
            )
        elif mode == "web" and used_web and not citations:
            pass
        elif citations:
            lines = [final_text.strip(), "", "Sources:"]
            for i, c in enumerate(citations, start=1):
                title = c.get("title") or c["url"]
                lines.append(f"[{i}] {title}\n{c['url']}")
            final_text = "\n".join(lines).strip()

        updated_messages: List[Dict[str, Any]] = []
        if instructions:
            updated_messages.append({"role": "system", "content": instructions})

        for itm in input_list:
            if isinstance(itm, dict) and itm.get("role") in {"user", "assistant"} and "content" in itm:
                updated_messages.append({"role": itm["role"], "content": itm["content"]})

        if not updated_messages or updated_messages[-1].get("role") != "assistant":
            updated_messages.append({"role": "assistant", "content": final_text})

        return final_text, updated_messages