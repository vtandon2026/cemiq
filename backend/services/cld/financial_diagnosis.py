# cld/financial_diagnosis.py
from __future__ import annotations

from pathlib import Path
import base64
from io import BytesIO
import html as html_std
import html as html_escape
import json
import os
import re
from typing import List

import requests
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd

from cld import ciq_helpers as ch

from excel_assistant import (
    build_scope_profile,
    make_system_prompt,
    tool_loop_streamlit,
)


# ----------------------------
# Optional web-search fallback (OpenAI Responses API)
# - Used when user explicitly asks to "search the web / latest / news" etc.
# - Keeps the existing chat UI + dataset tooling intact.
# ----------------------------
def _run_openai_web_search(messages: list[dict], model: str | None = None) -> tuple[str, list[dict]]:
    """
    Execute a web-enabled answer using OpenAI's Responses API web_search tool.

    Returns:
      (answer_text, updated_messages) where updated_messages mirrors the structure
      used elsewhere in this app: [system, ...conversation...] (system is preserved).
    """
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Set it to enable web search.")

    # Lazy import so the page can still load without OpenAI installed.
    try:
        from openai import OpenAI  # type: ignore
    except Exception as e:
        raise RuntimeError(f"OpenAI python package is not available: {e}")

    client = OpenAI(api_key=api_key)

    # Prefer a reasoning-capable model for better agentic search; allow override.
    model_to_use = (model or os.getenv("OPENAI_WEB_MODEL") or "gpt-5").strip()

    # The Responses API accepts either a plain string or an item/message list.
    # We pass the same message list we already constructed for tool_loop_streamlit.
    resp = client.responses.create(
        model=model_to_use,
        tools=[{"type": "web_search"}],
        include=["web_search_call.action.sources"],
        input=messages,
    )

    answer_text = (getattr(resp, "output_text", "") or "").strip()
    if not answer_text:
        answer_text = "Sorry — I couldn’t generate an answer from web search."

    # Best-effort: append a compact sources list (URLs) so users can verify.
    sources = []
    try:
        for item in getattr(resp, "output", []) or []:
            if getattr(item, "type", None) == "web_search_call":
                action = getattr(item, "action", None)
                if action and isinstance(action, dict):
                    sources = action.get("sources") or []
                else:
                    # Some SDK versions expose action as an object
                    sources = getattr(action, "sources", []) if action else []
    except Exception:
        sources = []

    # Render sources as plain text (chat bubbles escape HTML).
    if sources:
        # Keep it short: show up to 8 sources to avoid flooding the bubble.
        shown = sources[:8]
        sources_block = "<br>".join([f"• {s}" for s in shown])
        answer_text += f"\n\n**Sources**<br>{sources_block}"

    updated_messages = list(messages) + [{"role": "assistant", "content": answer_text}]
    return answer_text, updated_messages

# ----------------------------
# think-cell Server config (kept consistent with other pages)
# ----------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_DIR = SCRIPT_DIR if (SCRIPT_DIR / "Construction_Cement_FlatFile.xlsx").exists() else SCRIPT_DIR.parent

TC_SERVER_URL_DEFAULT = os.getenv("THINKCELL_SERVER_URL", "http://127.0.0.1:8080/")

THINKCELL_TEMPLATE_BAR = os.getenv(
    "THINKCELL_TEMPLATE_BAR",
    str(PROJECT_DIR / "thinkcell_template_bar.pptx"),
)

THINKCELL_ELEM_BAR = "BarChart"
THINKCELL_ELEM_TITLE = "ChartTitle"

THINKCELL_TEMPLATE_LINE = os.getenv(
    "THINKCELL_TEMPLATE_LINE",
    str(PROJECT_DIR / "thinkcell_template_growth.pptx"),
)

THINKCELL_ELEM_LINE = "GrowthChart"

PAGE_SOURCE = "CapIQ"
WEB_SEARCH_ENABLED_KEY = "cld_web_search_enabled"
def tc_string(x):
    return {"string": str(x)}


def tc_number(x):
    if x is None:
        return None
    try:
        return {"number": float(x)}
    except Exception:
        return None


def template_to_absolute_url(template_ref: str) -> str:
    ref = (template_ref or "").strip()
    if not ref:
        return ref

    lower = ref.lower()
    if lower.startswith("http://") or lower.startswith("https://") or lower.startswith("file:///"):
        return ref

    p = Path(ref)
    if not p.is_absolute():
        p = (SCRIPT_DIR / p).resolve()
    return p.as_uri()


def build_ppttc_payload(template_ref: str, data_items: list[dict]) -> str:
    return json.dumps(
        [{"template": template_to_absolute_url(template_ref), "data": data_items}],
        ensure_ascii=False,
    )

def build_tc_bar_ppttc(title: str, labels: list[str], values: list[float], template_ref: str | None = None) -> str:
    header_row = [tc_string("")] + [tc_string(lbl) for lbl in labels]
    value_row = [tc_string(title)] + [tc_number(v) for v in values]
    table = [header_row, value_row]

    payload_items = [
        {"name": THINKCELL_ELEM_BAR, "table": table},
        {"name": THINKCELL_ELEM_TITLE, "table": [[tc_string(title)]]},
    ]
    return build_ppttc_payload(template_ref or THINKCELL_TEMPLATE_BAR, payload_items)


def build_tc_line_ppttc(title: str, years: list[int], series_map: dict[str, list[float | None]], template_ref: str | None = None) -> str:
    table = []
    table.append([None] + [tc_string(str(y)) for y in years])

    for series_name, vals in series_map.items():
        row = [tc_string(series_name)] + [tc_number(v) for v in vals]
        table.append(row)

    payload_items = [
        {"name": THINKCELL_ELEM_LINE, "table": table},
        {"name": THINKCELL_ELEM_TITLE, "table": [[tc_string(title)]]},
    ]
    return build_ppttc_payload(template_ref or THINKCELL_TEMPLATE_LINE, payload_items)

def normalize_tc_url(url: str) -> str:
    u = (url or "").strip()
    if not u:
        return "http://127.0.0.1:8080/"
    if not u.endswith("/"):
        u += "/"
    return u


def post_to_tcserver(tcserver_url: str, ppttc_json: str, timeout_sec: int = 120) -> bytes:
    url = normalize_tc_url(tcserver_url)
    headers = {
        "Content-Type": "application/vnd.think-cell.ppttc+json",
        "Accept": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }
    r = requests.post(url, data=ppttc_json.encode("utf-8"), headers=headers, timeout=timeout_sec)
    if not r.ok:
        detail = (r.text or "").strip()
        raise RuntimeError(
            f"think-cell Server HTTP {r.status_code}\n\n"
            f"URL: {url}\n\n"
            f"Server response: {detail if detail else '(empty response body)'}"
        )
    return r.content


def trigger_pptx_download(pptx_bytes: bytes, file_name: str) -> None:
    if not pptx_bytes:
        return

    mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    safe_name = html_std.escape(file_name, quote=True)

    b64 = base64.b64encode(pptx_bytes).decode("utf-8")

    components.html(
        f"""
        <script>
        (function() {{
        try {{
            const b64 = "{b64}";
            const byteChars = atob(b64);
            const byteNumbers = new Array(byteChars.length);
            for (let i = 0; i < byteChars.length; i++) {{
              byteNumbers[i] = byteChars.charCodeAt(i);
            }}
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], {{ type: "{mime}" }});
            const url = URL.createObjectURL(blob);

            const doc = window.parent && window.parent.document ? window.parent.document : document;
            const a = doc.createElement('a');
            a.href = url;
            a.download = "{safe_name}";
            a.style.display = 'none';
            doc.body.appendChild(a);
            a.click();

            setTimeout(() => {{
              URL.revokeObjectURL(url);
              a.remove();
            }}, 1000);
        }} catch (e) {{
          // ignore
        }}
        }})();
        </script>
        """,
        height=0,
    )


# ----------------------------
# KPI registry (flat list)
# ----------------------------

KPI_REGISTRY: list[dict] = [
    # CATEGORY 1: Investor Value & Financial Concentration
    {
        "key": "market_cap",
        "label": "Market Capitalization",
        "formula": "Market Cap",
        "level": "company",
        "value_col": "Market capitalization ($ mn)",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": True,
        "source_metric": "Market Capitalisation",
    },
    {
        "key": "enterprise_value",
        "label": "Enterprise Value (EV)",
        # "formula": "EV = Market Cap + Total Debt – Cash (or Market Cap + Net Debt)",
        "level": "company",
        "value_col": "Enterprise value ($ mn)",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": True,
        "source_metric": "Enterprise Value (Total)",
    },
    # {
    #     "key": "total_market_cap_country",
    #     "label": "Total Market Capitalization by Country (Listed Companies)",
    #     # "formula": "Σ(Market Cap) by Country",
    #     "level": "country",
    #     "agg": "sum",
    #     "base_col": "Market capitalization ($ mn)",
    #     "yaxis_title": "$ mn",
    #     "tickformat": ",.0f",
    #     "sort": "desc",
    #     "point_in_time": True,
    #     "source_metric": "Market Capitalisation",
    # },
    # {
    #     "key": "total_ev_country",
    #     "label": "Total Enterprise Value by Country (Listed Companies)",
    #     # "formula": "Σ(EV) by Country",
    #     "level": "country",
    #     "agg": "sum",
    #     "base_col": "Enterprise value ($ mn)",
    #     "yaxis_title": "$ mn",
    #     "tickformat": ",.0f",
    #     "sort": "desc",
    #     "point_in_time": True,
    #     "source_metric": "Enterprise Value (Total)",
    # },
    # {
    #     "key": "listed_count_country",
    #     "label": "Number of Listed Cement Companies by Country",
    #     # "formula": "Count(Listed Companies) by Country",
    #     "level": "country",
    #     "agg": "count_listed",
    #     "base_col": "CIQ_ID",
    #     "yaxis_title": "Count",
    #     "tickformat": ",.0f",
    #     "sort": "desc",
    #     "point_in_time": False,
    #     "source_metric": None,
    # },

    # CATEGORY 2: Earnings Strength & Stability
    {
        "key": "revenue",
        "label": "Revenue",
        "formula": "Revenue",
        "level": "company",
        "value_col": "_Revenue",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Revenue ($ mn)",
    },
    {
        "key": "ebitda",
        "label": "EBITDA",
        "formula": "EBITDA",
        "level": "company",
        "value_col": "_EBITDA",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "EBITDA ($ mn)",
    },
    {
        "key": "ebitda_margin",
        "label": "EBITDA Margin",
        # "formula": "EBITDA / Revenue",
        "level": "company",
        "value_col": "EBITDA margin",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "EBITDA Margin ( %)",
    },
    {
        "key": "operating_margin",
        "label": "Operating Profit Margin",
        # "formula": "EBIT / Revenue",
        "level": "company",
        "value_col": "Operating profit margin",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "EBIT ($ mn)",
    },
    {
        "key": "yoy_ebitda",
        "label": "Year-over-Year EBITDA Growth",
        # "formula": "(EBITDA_t – EBITDA_(t-1)) / EBITDA_(t-1)",
        "level": "company_long",
        "long_metric": "EBITDA ($ mn)",
        "value_col": "YoY Growth",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
    },
    

    # CATEGORY 3: Capital Efficiency & Asset Utilization
    {
        "key": "roic",
        "label": "Return on Invested Capital (ROIC)",
        "level": "company",
        "value_col": "ROIC (%)",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Return on Invested Capital ( %)",
    },
    {
        "key": "roce",
        "label": "Return on Capital Employed (ROCE)",
        
        "level": "company",
        "value_col": "ROCE (%)",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Return on Capital Employed ( %)",
    },
    {
        "key": "roa",
        "label": "Return on Assets (ROA)",
        
        "level": "company",
        "value_col": "ROA (%)",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Return on Assets ( %)",
    },
    {
        "key": "asset_turnover",
        "label": "Asset Turnover Ratio",
        # "formula": "Revenue / Total Assets",
        "level": "company",
        "value_col": "Asset turnover",
        "yaxis_title": "x",
        "tickformat": ".2f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Assets Turnover Ratio",
    },
    # {
    #     "key": "net_ppe",
    #     "label": "Net Property, Plant & Equipment (Net PP&E)",
    #     "formula": "Net PP&E",
    #     "level": "company",
    #     "value_col": "Net PP&E ($ mn)",
    #     "yaxis_title": "$ mn",
    #     "tickformat": ",.0f",
    #     "sort": "desc",
    #     "point_in_time": False,
    #     "source_metric": "Net property , Plant and Equipment",
    # },

    # CATEGORY 4: Balance Sheet Strength & Financial Risk
    {
        "key": "net_debt",
        "label": "Net Debt",
        # "formula": "Total Debt – Cash",
        "level": "company",
        "value_col": "Net debt ($ mn)",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "asc",
        "point_in_time": False,
        "source_metric": "Net debt ($ mn)",
    },
    {
        "key": "net_debt_ebitda",
        "label": "Net Leverage",
        # "formula": "Net Debt / EBITDA",
        "level": "company",
        "value_col": "Net debt / EBITDA",
        "yaxis_title": "x",
        "tickformat": ".2f",
        "sort": "asc",
        "point_in_time": False,
        "source_metric": "Net Debt to Earnings Before Interest, Taxes, Depreciation, and Amortization Ratio",
    },
    {
        "key": "debt_to_equity",
        "label": "Debt-to-Equity Ratio",
        # "formula": "Total Debt / Equity",
        "level": "company",
        "value_col": "Debt-to-equity",
        "yaxis_title": "%",
        "tickformat": ".2f",
        "sort": "asc",
        "point_in_time": False,
        "source_metric": "Total Debt/Equity %",
    },
    
    {
        "key": "pct_short_term_debt",
        "label": "Percentage of Short-Term Debt",
        # "formula": "Debt_ST / Total Debt",
        "level": "company",
        "value_col": "% short-term debt",
        "yaxis_title": "%",
        "tickformat": ".0%",
        "sort": "asc",
        "point_in_time": False,
        "source_metric": "Short term Borrowings",
    },

    # CATEGORY 5: Cash Generation & Market Valuation
    {
        "key": "opcf",
        "label": "Operating Cash Flow",
        "formula": "Operating Cash Flow",
        "level": "company",
        "value_col": "Operating cash flow ($ mn)",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Operating cashflow ($ mn)",
    },
    {
        "key": "fcf",
        "label": "Free Cash Flow (FCF)",
        # "formula": "Operating Cash Flow – CAPEX",
        "level": "company",
        "value_col": "Free cash flow ($ mn)",
        "yaxis_title": "$ mn",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
        "source_metric": "Free Cash Flow (Unlevered)",
    },
    {
        "key": "fcf_ebitda",
        "label": "Cash Conversion",
        # "formula": "Free Cash Flow / EBITDA",
        "level": "company",
        "value_col": "FCF / EBITDA",
        "yaxis_title": "%",
        "tickformat": ".0%",
        "sort": "desc",
        "point_in_time": False,
    },
    {
        "key": "ev_ebitda",
        "label": "Valuation Multiple",
        # "formula": "Enterprise Value / EBITDA",
        "level": "company",
        "value_col": "EV / EBITDA",
        "yaxis_title": "x",
        "tickformat": ".2f",
        "sort": "asc",
        "point_in_time": True,
        "source_metric": "Enterprise Value to Earnings Before Interest, Taxes, Depreciation, and Amortization Multiple",
    },
    {
        "key": "pe",
        "label": "Price-to-Earnings",
        # "formula": "Market Cap / Net Income",
        "level": "company",
        "value_col": "P/E",
        "yaxis_title": "x",
        "tickformat": ".2f",
        "sort": "asc",
        "point_in_time": True,
        "source_metric": "Price to Earning Ratio",
    },

    # CATEGORY 6: Workforce Productivity & Efficiency (FTE-based KPIs)

    {
    "key": "fte",
    "label": "Number of Full-Time Employees",
    # "formula": "Full-time employees",
    "level": "company",
    "value_col": "Full-time employees",   # ← EXACT Excel match
    "yaxis_title": "Employees",
    "tickformat": ",.0f",
    "sort": "desc",
    "point_in_time": False,
    "source_metric": "Full-time employees",
    },
    {
        "key": "ebitda_per_fte",
        "label": "Operating Profitability per Employee",
        # "formula": "EBITDA / FTE",
        "level": "company",
        "value_col": "EBITDA per Employee (USD '000)",
        "yaxis_title": "USD '000",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
    },
    {
        "key": "revenue_per_fte",
        "label": "Revenue Productivity per Employee",
        # "formula": "Revenue / FTE",
        "level": "company",
        "value_col": "Revenue per Employee (USD '000)",
        "yaxis_title": "USD '000",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
    },
    {
        "key": "opcf_per_fte",
        "label": "Cash Productivity per Employee",
        # "formula": "Operating Cash Flow / FTE",
        "level": "company",
        "value_col": "Operating Cash Flow per Employee (USD '000)",
        "yaxis_title": "USD '000",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
    },
    {
        "key": "net_ppe_per_fte",
        "label": "Capital Intensity per Employee",
        # "formula": "Net PP&E / FTE",
        "level": "company",
        "value_col": "Net PP&E per Employee (USD '000)",
        "yaxis_title": "USD '000",
        "tickformat": ",.0f",
        "sort": "desc",
        "point_in_time": False,
    },
    {
        "key": "labor_intensity",
        "label": "Labor Intensity",
        # "formula": "FTE / Revenue",
        "level": "company",
        "value_col": "Labor intensity (FTE per $ mn revenue)",
        "yaxis_title": "FTE per $ mn",
        "tickformat": ".2f",
        "sort": "asc",
        "point_in_time": False,
    },
]

# ----------------------------
# KPI categories (new)
# ----------------------------

CATEGORY_ORDER: list[str] = [
    "Investor Value",
    "Earnings Quality",
    "Capital Efficiency",
    "Financial Risk",
    "Cash & Valuation",
    "Workforce Efficiency",
]

CATEGORY_ORDER: list[str] = [
    "Investor Value",
    "Earnings Quality",
    "Capital Efficiency",
    "Financial Risk",
    "Cash & Valuation",
    "Workforce Efficiency",
]

CATEGORY_TO_KEYS: dict[str, list[str]] = {
    "Investor Value": [
        "market_cap",
        "enterprise_value",
        "total_market_cap_country",
        "total_ev_country",
        "listed_count_country",
    ],
    "Earnings Quality": [
        "revenue",
        "ebitda",
        "ebitda_margin",
        "operating_margin",
        "yoy_ebitda",
        
    ],
    "Capital Efficiency": [
        "roic",
        "roce",
        "roa",
        "asset_turnover",
        "net_ppe",
    ],
    "Financial Risk": [
        "net_debt",
        "net_debt_ebitda",
        "debt_to_equity",
        
        "pct_short_term_debt",
    ],
    "Cash & Valuation": [
        "opcf",
        "fcf",
        "fcf_ebitda",
        "ev_ebitda",
        "pe",
    ],
    "Workforce Efficiency": [
        "fte",
        "ebitda_per_fte",
        "revenue_per_fte",
        "opcf_per_fte",
        "net_ppe_per_fte",
        "labor_intensity",
    ],
}

# ----------------------------
# Chat UI helpers
# ----------------------------

_LINK_RE = re.compile(r"\[([^\]]+)\]\((https?://[^)]+)\)")


def _format_message_html(text: str) -> str:
    if text is None:
        return ""
    t = str(text)
    t = html_escape.escape(t)

    def _link_sub(m):
        label = m.group(1)
        url = m.group(2)
        return f'<a href="{url}" target="_blank" rel="noopener">{label}</a>'

    t = _LINK_RE.sub(_link_sub, t)
    t = t.replace("\n", "<br>")
    return t


def _auto_scroll_chat(chat_dom_id: str = "chatbox"):
    components.html(
        f"""
        <script>
        (function() {{
            const el = window.parent.document.getElementById('{chat_dom_id}');
            if (el) el.scrollTop = el.scrollHeight;
        }})();
        </script>
        """,
        height=0,
    )


def render_message_content_html(text) -> str:
    """Render a safe subset of markdown-like formatting for chat bubbles."""
    raw = str(text)
    raw = raw.replace("\\%", "%")
    raw = raw.replace("\\\\%", "%")   # extra-safe in case double escaping appears
    safe = html_std.escape(raw, quote=False)
    safe = safe.replace("\r\n", "\n").replace("\r", "\n")

    safe = re.sub(r"`([^`]+)`", r"<code>\1</code>", safe)
    safe = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", safe)
    safe = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", safe)
    safe = re.sub(r"__([^_]+)__", r"<strong>\1</strong>", safe)
    safe = re.sub(r"(?<!_)_([^_]+)_(?!_)", r"<em>\1</em>", safe)
    safe = re.sub(
        r"((?:https?://|www\.)[^\s<]+)",
        lambda m: f'<a href="{m.group(1) if m.group(1).startswith(("http://", "https://")) else "https://" + m.group(1)}" target="_blank" rel="noopener noreferrer">{m.group(1)}</a>',
        safe,
    )

    lines = safe.split("\n")
    parts = []
    para = []
    list_stack = []

    def flush_para():
        nonlocal para
        if para:
            joined = " ".join(x.strip() for x in para if x.strip())
            if joined:
                parts.append(f"<p>{joined}</p>")
            para = []

    def close_lists(target=0):
        nonlocal list_stack
        while len(list_stack) > target:
            parts.append(f"</{list_stack.pop()}>")

    def _looks_like_table_row(s: str) -> bool:
        return "|" in s and s.count("|") >= 2

    def _looks_like_table_separator(s: str) -> bool:
        cells = [c.strip() for c in s.strip().strip("|").split("|")]
        if not cells:
            return False
        return all(bool(c) and re.fullmatch(r":?-{3,}:?", c) for c in cells)

    def _split_table_cells(s: str) -> List[str]:
        return [c.strip() for c in s.strip().strip("|").split("|")]

    def _table_html(table_lines: List[str]) -> str:
        headers = _split_table_cells(table_lines[0])
        align_cells = _split_table_cells(table_lines[1])
        alignments = []
        for cell in align_cells:
            if cell.startswith(":") and cell.endswith(":"):
                alignments.append("center")
            elif cell.endswith(":"):
                alignments.append("right")
            else:
                alignments.append("left")

        rows = []
        for row_line in table_lines[2:]:
            cells = _split_table_cells(row_line)
            if len(cells) < len(headers):
                cells += [""] * (len(headers) - len(cells))
            elif len(cells) > len(headers):
                cells = cells[:len(headers)]
            rows.append(cells)

        thead = "".join(
            f'<th style="border:1px solid rgba(0,0,0,0.12);padding:6px 8px;text-align:{alignments[i] if i < len(alignments) else "left"};background:rgba(0,0,0,0.04);font-weight:700;">{headers[i]}</th>'
            for i in range(len(headers))
        )

        tbody_rows = []
        for row in rows:
            tds = "".join(
                f'<td style="border:1px solid rgba(0,0,0,0.12);padding:6px 8px;text-align:{alignments[i] if i < len(alignments) else "left"};vertical-align:top;">{row[i]}</td>'
                for i in range(len(headers))
            )
            tbody_rows.append(f"<tr>{tds}</tr>")

        download_html = ""
        try:
            df_download = pd.DataFrame(rows, columns=headers)
            buffer = BytesIO()
            df_download.to_excel(buffer, index=False, engine="openpyxl")
            xlsx_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            download_html = (
                "<div style='display:flex;justify-content:flex-end;margin:0 0 0.35rem 0;'>"
                f"<a download='chat_table.xlsx' href='data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,{xlsx_b64}' "
                "style='display:inline-block;padding:4px 8px;font-size:0.78rem;line-height:1.1;border:1px solid rgba(0,0,0,0.12);border-radius:6px;background:#f7f7f7;color:#111;text-decoration:none;'>Download Excel</a>"
                "</div>"
            )
        except Exception:
            download_html = ""

        return (
            "<div style='overflow-x:auto; margin:0.45rem 0 0.8rem 0;'>"
            f"{download_html}"
            "<table style='border-collapse:collapse; width:100%; font-size:0.92rem;'>"
            f"<thead><tr>{thead}</tr></thead>"
            f"<tbody>{''.join(tbody_rows)}</tbody>"
            "</table></div>"
        )

    i = 0
    while i < len(lines):
        raw_line = lines[i]
        line = raw_line.rstrip()
        stripped = line.strip()

        if not stripped:
            flush_para()
            close_lists(0)
            i += 1
            continue

        if i + 1 < len(lines) and _looks_like_table_row(stripped) and _looks_like_table_separator(lines[i + 1].strip()):
            flush_para()
            close_lists(0)
            table_lines = [stripped, lines[i + 1].strip()]
            i += 2
            while i < len(lines):
                next_stripped = lines[i].strip()
                if not next_stripped or not _looks_like_table_row(next_stripped):
                    break
                table_lines.append(next_stripped)
                i += 1
            parts.append(_table_html(table_lines))
            continue

        heading_match = re.match(r"^(#{1,4})\s+(.*)$", stripped)
        if heading_match:
            flush_para()
            close_lists(0)
            level = min(len(heading_match.group(1)), 4)
            parts.append(f"<h{level}>{heading_match.group(2).strip()}</h{level}>")
            i += 1
            continue

        bullet_match = re.match(r"^([ \t]*)([-*])\s+(.*)$", line)
        numbered_match = re.match(r"^([ \t]*)(\d+[.)])\s+(.*)$", line)
        if bullet_match or numbered_match:
            flush_para()
            match = bullet_match or numbered_match
            indent = len(match.group(1).replace("\t", "    ")) // 2
            list_type = "ul" if bullet_match else "ol"
            content = match.group(3).strip()

            while len(list_stack) > indent:
                parts.append(f"</{list_stack.pop()}>")
            while len(list_stack) < indent + 1:
                list_stack.append(list_type)
                parts.append(f"<{list_type}>")
            if list_stack and list_stack[-1] != list_type:
                parts.append(f"</{list_stack.pop()}>")
                list_stack.append(list_type)
                parts.append(f"<{list_type}>")

            parts.append(f"<li>{content}</li>")
            i += 1
            continue

        if list_stack:
            if parts and parts[-1].endswith("</li>"):
                parts[-1] = parts[-1][:-5] + f"<br>{stripped}</li>"
            else:
                para.append(stripped)
        else:
            para.append(stripped)
        i += 1

    flush_para()
    close_lists(0)
    rendered = "".join(parts).strip()
    return rendered or "<p></p>"


def classify_web_intent(user_text: str) -> str:
    t = str(user_text or "").strip().casefold()
    if not t:
        return "chart_only"

    explanatory_markers = [
        "why", "reason", "reasons", "because",
        "driver", "drivers", "driving",
        "cause", "causes", "caused",
        "explain", "explains", "explaining",
        "what is behind", "what's behind", "what led to",
        "why is", "why are",
        "latest", "recent", "currently", "today", "news",
        "trend", "trends", "market", "industry", "macro",
        "competitor", "external", "validate", "verify", "confirm",
        "web", "internet", "online", "source", "sources",
        "citation", "citations", "reference", "references",
        "regulation", "policy", "announcement", "announced",
        "released", "launch",
    ]
    if any(x in t for x in explanatory_markers):
        return "external"

    explicit_chart_only = [
        "only from the chart", "only from chart", "only from the data",
        "only from data", "only from excel", "only from the spreadsheet",
        "based only on the chart", "based only on the data",
        "using only the chart", "using only the data", "using only excel",
    ]
    if any(x in t for x in explicit_chart_only):
        return "chart_only"

    chart_markers = [
        "chart", "graph", "plot", "visual", "figure",
        "excel", "spreadsheet", "sheet", "workbook",
        "data", "dataset",
        "current view", "this view", "selected filters", "current filters",
        "current chart", "this chart", "shown here", "shown in the chart",
        "from the chart", "from this chart", "from the data", "from excel",
    ]
    if any(x in t for x in chart_markers):
        return "chart_only"

    return "external"

BAIN_RED = "#E11C2A"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BAIN_LOGO_PATH = (
    os.path.join(os.path.dirname(BASE_DIR), "bainlogo.png")
    if os.path.exists(os.path.join(os.path.dirname(BASE_DIR), "bainlogo.png"))
    else os.path.join(BASE_DIR, "bainlogo.png")
)
BCN_LOGO_PATH = (
    os.path.join(os.path.dirname(BASE_DIR), "bcnlogo.png")
    if os.path.exists(os.path.join(os.path.dirname(BASE_DIR), "bcnlogo.png"))
    else os.path.join(BASE_DIR, "bcnlogo.png")
)


def img_to_base64(img_path: str) -> str:
    if not os.path.exists(img_path):
        return ""
    with open(img_path, "rb") as f:
        return f"data:image/png;base64,{base64.b64encode(f.read()).decode()}"


def render_banner() -> None:
    bain_uri = img_to_base64(BAIN_LOGO_PATH)
    bcn_uri = img_to_base64(BCN_LOGO_PATH)
    logos_block_w = 235
    spacing = 8

    st.markdown(
        f"""
        <div style="display:flex; align-items:center; justify-content:flex-start; width:100%; margin-bottom:10px; margin-top:-26px; box-sizing:border-box;">
          <div style="background:{BAIN_RED}; color:white; padding:14px 16px; border-radius:10px; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; flex: 1 1 auto; min-width: 0; max-width: calc(100% - {logos_block_w}px - {spacing}px); box-sizing: border-box; margin-right: {spacing}px;">
            <div style="font-size:32px; font-weight:800; line-height:1.1;">CemIQ</div>
            <div style="font-size:20px; font-weight:600; line-height:1.2; margin-top:4px;">Smarter Diagnostics and KPI intelligence for Cement and beyond</div>
          </div>
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:12px; flex:0 0 {logos_block_w}px; width:{logos_block_w}px; box-sizing:border-box;">
            {f"<img src='{bain_uri}' style='height:54px; width:auto; object-fit:contain; display:block;' />" if bain_uri else ""}
            {f"<img src='{bcn_uri}' style='height:54px; width:auto; object-fit:contain; display:block;' />" if bcn_uri else ""}
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def _valid_company_options_for_kpi(
    long_df: pd.DataFrame,
    wide_df: pd.DataFrame,
    kpi: dict,
    year: int,
    country: str = "All",
) -> list[str]:
    """
    Return only companies that have a usable value for the selected KPI
    in the selected year/country.

    Rules:
    - exclude null / NaN / non-numeric
    - exclude 0
    """
    if wide_df is None or wide_df.empty or "Company" not in wide_df.columns:
        return []

    df = wide_df.copy()

    if country != "All" and "Country" in df.columns:
        df = df[df["Country"].astype(str) == str(country)].copy()

    if df.empty:
        return []

    # Long-derived KPI
    if kpi.get("level") == "company_long":
        key = str(kpi.get("key") or "").strip()

        if key == "yoy_ebitda":
            yoy = ch.compute_yoy_growth(long_df, metric=kpi["long_metric"], year=int(year))
            if yoy is None or yoy.empty:
                return []
            df = df.merge(yoy, on=["CIQ_ID", "Company"], how="left")
            value_col = "YoY Growth"

        elif key == "ebitda_volatility":
            window = int(kpi.get("window", 5))
            vol = ch.compute_volatility_std(long_df, metric=kpi["long_metric"], year=int(year), window=window)
            if vol is None or vol.empty:
                return []
            df = df.merge(vol, on=["CIQ_ID", "Company"], how="left")
            value_col = "Volatility (STD)"

        else:
            return []

    else:
        value_col = kpi.get("value_col")
        if not value_col or value_col not in df.columns:
            return []

    df["_kpi_filter_val"] = pd.to_numeric(df[value_col], errors="coerce")
    df = df[df["_kpi_filter_val"].notna()].copy()
    df = df[df["_kpi_filter_val"] != 0].copy()

    return sorted(df["Company"].dropna().astype(str).unique().tolist())


def _default_top_companies_for_kpi(
    long_df: pd.DataFrame,
    wide_df: pd.DataFrame,
    kpi: dict,
    year: int,
    analyzed_company: str,
    country: str = "All",
    top_n: int = 10,
) -> list[str]:
    """
    Default comparison set, restricted to companies with valid KPI values.
    Keeps existing 'top N' behavior but removes invalid / zero KPI companies.
    """
    if wide_df is None or wide_df.empty:
        return []

    df = wide_df.copy()

    if country != "All" and "Country" in df.columns:
        df = df[df["Country"].astype(str) == str(country)].copy()

    if df.empty:
        return []

    # Build KPI values exactly like the chart logic
    if kpi.get("level") == "company_long":
        key = str(kpi.get("key") or "").strip()

        if key == "yoy_ebitda":
            yoy = ch.compute_yoy_growth(long_df, metric=kpi["long_metric"], year=int(year))
            if yoy is None or yoy.empty:
                return []
            df = df.merge(yoy, on=["CIQ_ID", "Company"], how="left")
            value_col = "YoY Growth"

        elif key == "ebitda_volatility":
            window = int(kpi.get("window", 5))
            vol = ch.compute_volatility_std(long_df, metric=kpi["long_metric"], year=int(year), window=window)
            if vol is None or vol.empty:
                return []
            df = df.merge(vol, on=["CIQ_ID", "Company"], how="left")
            value_col = "Volatility (STD)"

        else:
            return []

    else:
        value_col = kpi.get("value_col")
        if not value_col or value_col not in df.columns:
            return []

    df["_kpi_filter_val"] = pd.to_numeric(df[value_col], errors="coerce")
    df = df[df["_kpi_filter_val"].notna()].copy()
    df = df[df["_kpi_filter_val"] != 0].copy()

    if df.empty:
        return []

    ascending = (kpi.get("sort") == "asc")
    df = df.sort_values("_kpi_filter_val", ascending=ascending)

    companies = df["Company"].dropna().astype(str).tolist()

    # Keep analyzed company included if valid
    top = companies[:top_n]
    if analyzed_company and analyzed_company in companies and analyzed_company not in top:
        top = [analyzed_company] + top

    # de-dupe while preserving order
    seen = set()
    out = []
    for c in top:
        if c not in seen:
            seen.add(c)
            out.append(c)

    return out
    
def render_company_level_diagnosis(ciq_xlsx: Path):
    """
    Company-level diagnosis page with:
    - Sidebar "Select Category" dropdown (6 categories)
    - KPI dropdown filtered by selected category (same size as before)
    - Chart-mode toggle (Point-in-time vs Time series) replicating CACD toggle styling
    - Fix for "Number of Listed Cement Companies by Country" reacting to Year
    """

    lower_better_keys = {
        "ebitda_volatility",
        "net_debt",
        "net_debt_ebitda",
        "debt_to_equity",
        "pct_short_term_debt",
        "ev_ebitda",
        "pe",
        "labor_intensity",
    }

    def _rank_note(k: dict, by: str) -> str:
        if k.get("key") in lower_better_keys:
            if k.get("key") in {"ev_ebitda", "pe"}:
                return f"{by} are ranked from lowest to highest; lower values typically indicate a cheaper valuation (all else equal)."
            if k.get("key") == "ebitda_volatility":
                return f"{by} are ranked from lowest to highest; lower values indicate more stable earnings over time."
            if k.get("key") == "labor_intensity":
                return f"{by} are ranked from lowest to highest; lower values indicate a leaner workforce relative to revenue."
            return f"{by} are ranked from lowest to highest; lower values indicate lower financial risk (all else equal)."
        return f"{by} are ranked from highest to lowest to highlight relative outperformance on this metric."

    # ----------------------------
    # CSS: match existing look + replicate CACD tab-style toggle
    # ----------------------------
    st.markdown(
        """
        <style>
        [data-testid="stPlotlyChart"] > div { overflow: visible !important; }
        .js-plotly-plot .plotly .hoverlayer { overflow: visible !important; }

        .chat-wrap {
            border: none;
            border-radius: 0px;
            padding: 0px;
            height: 650px;
            overflow-y: auto;
            background: transparent;
            margin-top: 0px;
        }
        .chat-row { margin: 8px 0; display: flex; }
        .chat-row.user { justify-content: flex-end; }
        .chat-row.assistant { justify-content: flex-start; }
        .bubble {
            max-width: 95%;
            padding: 10px 12px;
            border-radius: 12px;
            line-height: 1.35;
            font-size: 0.95rem;
            border: 1px solid rgba(0,0,0,0.08);
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .bubble.user { background: rgba(225, 28, 42, 0.10); }
        .bubble.assistant { background: rgba(255, 255, 255, 0.85); }
        .bubble.assistant p { margin: 0 0 0.7rem 0; }
        .bubble.assistant p:last-child { margin-bottom: 0; }
        .bubble.assistant ul,
        .bubble.assistant ol { margin: 0.35rem 0 0.8rem 1.2rem; padding-left: 1rem; }
        .bubble.assistant li { margin: 0.25rem 0; }
        .bubble.assistant h1,
        .bubble.assistant h2,
        .bubble.assistant h3,
        .bubble.assistant h4 { margin: 0.2rem 0 0.65rem 0; line-height: 1.3; font-size: 1.02rem; }
        .bubble.assistant strong { font-weight: 700; }
        .bubble.assistant code {
            background: rgba(0,0,0,0.05);
            border-radius: 4px;
            padding: 0.05rem 0.3rem;
            font-family: Consolas, Monaco, monospace;
            font-size: 0.9em;
        }
        .bubble.assistant a { color: #2C5AA0; text-decoration: underline; }
        .bubble code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 6px; font-size: 0.9em; }
        .bubble a { color: #1d4ed8; text-decoration: none; }
        .bubble a:hover { text-decoration: underline; }

        .typing { display: inline-flex; gap: 5px; align-items: center; }
        .typing span {
            width: 7px; height: 7px; border-radius: 50%;
            background: rgba(0,0,0,0.45);
            display: inline-block;
            animation: blink 1.2s infinite ease-in-out;
        }
        .typing span:nth-child(2) { animation-delay: 0.15s; }
        .typing span:nth-child(3) { animation-delay: 0.30s; }

        @keyframes blink {
            0%, 80%, 100% { opacity: 0.25; transform: translateY(0px); }
            40% { opacity: 0.95; transform: translateY(-2px); }
        }

        .sticky-chat {
            position: sticky;
            top: 72px;
            z-index: 10;
            align-self: flex-start;
        }

        /* Tab-style view toggle (replicated from CACD) */
        div[data-testid="stRadio"] > div[role="radiogroup"] {
            flex-direction: row !important;
            gap: 0px !important;
            border: 1px solid rgba(0,0,0,0.18);
            border-radius: 10px;
            overflow: hidden;
            width: fit-content;
        }
        div[data-testid="stRadio"] label {
            margin: 0 !important;
            padding: 6px 14px !important;
            border-radius: 0 !important;
            border-right: 1px solid rgba(0,0,0,0.12);
            background: white;
        }
        div[data-testid="stRadio"] label:last-child { border-right: none; }
        div[data-testid="stRadio"] label:has(input:checked) {
            background: rgba(225, 28, 42, 0.08);
        }
        div[data-testid="stRadio"] label:has(input:checked) p {
            color: #E11C2A !important;
            font-weight: 700 !important;
        }
        

div[data-testid="stButton"] button,
div[data-testid="stDownloadButton"] button,
div[data-testid="stDownloadButton"] a {
  background-color: #f2f2f2 !important;   /* light grey background */
  color: #000000 !important;              /* keep text color same */
  border: 1px solid #d0d0d0 !important;
  border-radius: 6px !important;
  font-weight: 700 !important;            /* bold text */
  box-shadow: 0 3px 8px rgba(0,0,0,0.10) !important; /* subtle pop */
  transition: all 0.15s ease !important;
}

div[data-testid="stButton"] button:hover,
div[data-testid="stDownloadButton"] button:hover,
div[data-testid="stDownloadButton"] a:hover {
  background-color: #e6e6e6 !important;
  border: 1px solid #bfbfbf !important;
  box-shadow: 0 6px 14px rgba(0,0,0,0.15) !important;
  transform: translateY(-2px);
}
/* Match spacing logic */
div[data-testid="stButton"],
div[data-testid="stDownloadButton"] {
  margin-right: -6px !important;
}

div[data-testid="stButton"] button,
div[data-testid="stDownloadButton"] button,
div[data-testid="stDownloadButton"] a {
  white-space: nowrap !important;
  min-width: auto !important;
}

</style>
        """,
        unsafe_allow_html=True,
    )

    # Chat state (same defaults as earlier pages)
    if "chat_messages" not in st.session_state:
        st.session_state["chat_messages"] = [
            {"role": "assistant", "content": "Hi — ask me about the chart, the KPI definition, or the underlying data."}
        ]
    if "chart_context" not in st.session_state:
        st.session_state["chart_context"] = {}
    if "openai_messages" not in st.session_state:
        st.session_state["openai_messages"] = []
    if "is_typing" not in st.session_state:
        st.session_state["is_typing"] = False

    if not ciq_xlsx.exists():
        st.error(f"CIQ Excel file not found at: {ciq_xlsx}")
        st.stop()

    long = ch.load_ciq_ids_linked(ciq_xlsx)

    # Banner first (exactly as other pages)
    render_banner()

    # Page heading
    st.markdown(
        "<div style='font-size:28px;font-weight:800;margin-top:6px;margin-bottom:2px;'>Company-level diagnosis</div>",
        unsafe_allow_html=True,
    )

    # ----------------------------
    # Sidebar: category first, then year (and other filters after KPI chosen)
    # ----------------------------
    years = sorted([int(y) for y in long["Year"].dropna().unique().tolist()])
    default_year = max(years) if years else 2025

    with st.sidebar:
        st.header("How to use")
        st.markdown(
            """
            - Choose a **KPI category** and **KPI** to update the chart  
            - Use **Point-in-time** for current ranking and **Time series** for trend view  
            - Filter by **Year**, **Country**, and **Companies** to narrow the comparison  
            - Export **PPT** or **CSV** from the chart area  
        """
        )
        st.divider()
        st.header("Select the KPI Category")
        category = st.selectbox(
            "",
            options=["— Select —"] + CATEGORY_ORDER,
            index=0,
            key="financial_diag_category_select",
        )

    # Until category selected, show instruction screen
    if category == "— Select —":
        st.markdown(
            "<div style='margin-top:10px; font-size:18px; color:#6C6C6C;'>Please select the category you wish to analyse.</div>",
            unsafe_allow_html=True,
        )
        return

    with st.sidebar:
        st.markdown("## Filters")
        year = st.selectbox(
            "Year",
            options=years if years else [default_year],
            index=(years.index(default_year) if years and default_year in years else 0),
            key="financial_diag_year",
        )

    # KPI list for selected category
    keys_in_cat = set(CATEGORY_TO_KEYS.get(category, []))
    kpis_in_cat = [k for k in KPI_REGISTRY if k.get("key") in keys_in_cat]
    if not kpis_in_cat:
        st.warning("No KPIs configured for this category.")
        return

    kpi_labels = [k["label"] for k in kpis_in_cat]
    kpi_by_label = {k["label"]: k for k in kpis_in_cat}

    # KPI dropdown (UNDER heading) - SAME SIZE AS CURRENT (do not change the columns ratio)
    kpi_sel_col, _kpi_spacer = st.columns([1.55, 3.65])
    with kpi_sel_col:
        kpi_label = st.selectbox(
            "Select KPI",
            options=kpi_labels,
            index=0,  # first KPI under that category
            key=f"financial_diag_kpi_selectbox_main__{category}",
        )
    kpi = kpi_by_label[kpi_label]

    # View toggle (Point-in-time vs Time series) - replicate CACD toggle pattern.
    # Keep KPI dropdown size unchanged by placing toggle on a separate row.
    toggle_col, _toggle_spacer = st.columns([1.55, 3.65])
    with toggle_col:
        if hasattr(st, "segmented_control"):
            view_mode = st.segmented_control(
                "View",
                options=["Point-in-time", "Time series"],
                default=st.session_state.get("financial_diag_view_mode", "Point-in-time"),
                label_visibility="collapsed",
                key="financial_diag_view_mode",
            )
        else:
            view_mode = st.radio(
                "View",
                options=["Point-in-time", "Time series"],
                horizontal=True,
                label_visibility="collapsed",
                key="financial_diag_view_mode",
            )
    is_time_series = str(view_mode) == "Time series"

    # Prepare year snapshot (used by bars and by filters)
    wide_y = ch._wide_for_year(long, int(year))
    wide_y = ch._compute_metrics(wide_y) if not wide_y.empty else wide_y

    # For country-level KPIs: remove company selection controls entirely (unchanged behaviour)
    country = "All"
    analyzed_company = ""
    selected_companies: list[str] = []
    w_filt = wide_y.copy()

    if kpi.get("level") != "country":
        with st.sidebar:
            country_options = ["All"] + sorted(
                [c for c in wide_y["Country"].dropna().astype(str).unique().tolist()]
            )
            country = st.selectbox(
                "Country",
                options=country_options,
                index=0,
                key="financial_diag_country",
            )

            if country != "All" and "Country" in w_filt.columns:
                w_filt = w_filt[w_filt["Country"].astype(str) == country].copy()

            company_options = _valid_company_options_for_kpi(
                long_df=long,
                wide_df=wide_y,
                kpi=kpi,
                year=int(year),
                country=country,
            )

            SEL_KEY = "financial_diag_selected_companies"
            PREV_KEY = "_financial_diag_prev_analyzed_company"

            if not company_options:
                st.warning("No companies have non-zero data for the selected KPI/year/country.")
                analyzed_company = ""
                selected_companies = []
                st.session_state[SEL_KEY] = []
            else:
                analyzed_company = st.selectbox(
                    "Company to analyze",
                    options=company_options,
                    index=0,
                    key="financial_diag_analyzed_company",
                )

                default_n = 5 if is_time_series else 10
                default_companies = _default_top_companies_for_kpi(
                    long_df=long,
                    wide_df=wide_y,
                    kpi=kpi,
                    year=int(year),
                    analyzed_company=analyzed_company,
                    country=country,
                    top_n=default_n,
                )

                default_companies = [
                    c for c in default_companies
                    if c != "James Hardie Industries plc"
                ]

                prev_analyzed = st.session_state.get(PREV_KEY)
                valid_company_set = set(company_options)

                if SEL_KEY not in st.session_state:
                    init_sel = [c for c in default_companies if c in valid_company_set]
                    if analyzed_company and analyzed_company not in init_sel:
                        init_sel = [analyzed_company] + init_sel
                    st.session_state[SEL_KEY] = init_sel

                st.session_state[SEL_KEY] = [
                    c for c in st.session_state.get(SEL_KEY, [])
                    if c in valid_company_set
                ]

                if analyzed_company and analyzed_company != prev_analyzed:
                    cur = list(st.session_state.get(SEL_KEY, []))
                    if analyzed_company not in cur:
                        st.session_state[SEL_KEY] = [analyzed_company] + cur
                    st.session_state[PREV_KEY] = analyzed_company

                selected_companies = st.multiselect(
                    "Companies to compare",
                    options=company_options,
                    help="Only companies with non-zero data for the selected KPI are shown.",
                    key=SEL_KEY,
                )
    if wide_y.empty:
        st.warning("No data available for the selected year.")
        return

    # Two-column layout
    col_left, col_right = st.columns([3.2, 1.3], gap="large")

    # ----------------------------
    # As-of footnote for point-in-time market fields
    # ----------------------------
    asof_note = None
    if kpi.get("point_in_time") and kpi.get("source_metric"):
        m = str(kpi["source_metric"]).strip()
        tmp = long[
            (long["Year"].astype(int) == int(year))
            & (long["Metric"].astype(str).str.strip() == m)
        ].copy()
        asof_vals = tmp["AsOf"].dropna().unique().tolist() if "AsOf" in tmp.columns else []
        if asof_vals:
            asof_note = f"Data as of {asof_vals[0]} treated as FY{year}."

    def build_chart_title(label: str, formula: str | None) -> str:
        if not formula:
            return label
        if formula in label:
            return label
        return f"{label} ({formula})"

    chart_title = build_chart_title(kpi_label, kpi.get("formula"))

    footnote_text = ""
    plot_df_for_chat = pd.DataFrame()

    # ----------------------------
    # COUNTRY-LEVEL KPIs
    # ----------------------------
    if kpi.get("level") == "country":
        if "Country" not in wide_y.columns:
            st.warning("Country not available in the dataset.")
            return

        # POINT-IN-TIME (bars): exact same aggregation logic as before, except listed_count fix.
        def _country_agg_for_year(y: int) -> pd.DataFrame:
            wide = ch._wide_for_year(long, int(y))
            wide = ch._compute_metrics(wide) if not wide.empty else wide
            if wide is None or wide.empty:
                return pd.DataFrame(columns=["Country", "Value"])

            if kpi.get("key") == "listed_count_country":
                # FIX: count listed companies changes with year:
                # treat a company as "listed" in year Y if it has Market Cap in that year (preferred),
                # otherwise fall back to non-empty ticker.
                listed_flag = None
                if "Market capitalization ($ mn)" in wide.columns:
                    mc = pd.to_numeric(wide["Market capitalization ($ mn)"], errors="coerce")
                    listed_flag = mc.notna()
                else:
                    listed_flag = wide.get("Ticker", "").astype(str).str.strip().ne("")

                tmp = wide[listed_flag].copy()
                g = tmp.groupby("Country", dropna=True)["CIQ_ID"].nunique().reset_index(name="Value")
                return g

            # other country KPIs (sum / count)
            agg = kpi.get("agg")
            base_col = kpi.get("base_col")
            if agg == "count":
                g = wide.groupby("Country", dropna=True)[base_col].nunique().reset_index(name="Value")
            else:
                g = wide.groupby("Country", dropna=True)[base_col].sum(min_count=1).reset_index(name="Value")
            return g

        if not is_time_series:
            g = _country_agg_for_year(int(year))
            g = g.dropna(subset=["Country"]).copy()
            g["Country"] = g["Country"].astype(str)
            g = g.sort_values("Value", ascending=(kpi.get("sort") == "asc"))

            with col_left:
                chart_box = st.container(border=True)
                with chart_box:
                    ch._bar_chart_generic(
                        df_plot=g,
                        x_col="Country",
                        value_col="Value",
                        analyzed_x=None,
                        title=chart_title,
                        value_format=kpi.get("tickformat"),
                        yaxis_tickformat=kpi.get("tickformat"),
                        xaxis_title="Country",
                        yaxis_title=kpi.get("yaxis_title"),
                    )

                    footnote_text = (
                        f"Shows {kpi['label']} aggregated by country for FY{year}. "
                        f"Aggregation is based on listed cement companies included in the CIQ extract (sum or count, depending on the KPI). "
                        f"{_rank_note(kpi, 'Countries')}"
                    )
                    if asof_note:
                        footnote_text += f" {asof_note}"

                    ch.render_chart_footnote(footnote_text)

                table_df = g.rename(columns={"Value": kpi["label"]}).copy()
                plot_df_for_chat = table_df.copy()
        else:
            # TIME SERIES for country KPIs:
            # Build the exact same yearly aggregation, then plot top countries (by selected year) over time.
            years_ts = [int(y) for y in years if int(y) <= int(year)]
            yearly = []
            for y in years_ts:
                gg = _country_agg_for_year(int(y))
                if gg is None or gg.empty:
                    continue
                gg = gg.copy()
                gg["Year"] = int(y)
                yearly.append(gg)

            ts_c = pd.concat(yearly, ignore_index=True) if yearly else pd.DataFrame(columns=["Country", "Value", "Year"])
            if ts_c.empty:
                st.warning("No data available to plot.")
                return

            # pick top countries in selected year to avoid overcrowding
            g_last = ts_c[ts_c["Year"].astype(int) == int(year)].copy()
            g_last["Value"] = pd.to_numeric(g_last["Value"], errors="coerce")
            g_last = g_last.dropna(subset=["Value"])
            g_last = g_last.sort_values("Value", ascending=(kpi.get("sort") == "asc"))
            top_countries = g_last["Country"].astype(str).tolist()[:10]  # fixed top-10

            ts_c = ts_c[ts_c["Country"].astype(str).isin([str(c) for c in top_countries])].copy()
            ts_c = ts_c.rename(columns={"Country": "Company"})
            ts_c["Value"] = pd.to_numeric(ts_c["Value"], errors="coerce")
            ts_c = ts_c.dropna(subset=["Value"]).copy()

            with col_left:
                ch._line_chart(
                    df_plot=ts_c[["Year", "Company", "Value"]].copy(),
                    analyzed_company=None,
                    title=chart_title,
                    yaxis_tickformat=kpi.get("tickformat"),
                    yaxis_title=kpi.get("yaxis_title"),
                    value_format=kpi.get("tickformat"),
                )

            footnote_parts = [
                f"Shows {kpi['label']} over time for the top countries in FY{year} (FY{min(years_ts)}–FY{year})."
            ]
            if asof_note:
                footnote_parts.append(asof_note)
            footnote_text = " ".join(footnote_parts)

            with col_left:
                ch.render_chart_footnote(footnote_text)

            plot_df_for_chat = ts_c.rename(columns={"Value": kpi["label"]}).copy()

    # ----------------------------
    # COMPANY-LEVEL KPIs
    # ----------------------------
    else:
        if w_filt.empty:
            st.warning("No data available for the selected filters.")
            return
        if not selected_companies:
            st.info("Select at least one company in 'Companies to compare' to view charts.")
            return

        plot_df = w_filt[w_filt["Company"].astype(str).isin([str(c) for c in selected_companies])].copy()
        if plot_df.empty:
            st.warning("No matching companies found for the selected comparison set.")
            return

        value_col = kpi.get("value_col")

        # ----------------------------
        # POINT-IN-TIME (bars): exact same logic as before, without auto "trend KPI" switching.
        # ----------------------------
        if not is_time_series:
            # Long-derived KPIs (YoY + Volatility) evaluated into selected year (same as before)
            if kpi.get("level") == "company_long":
                if kpi.get("key") == "yoy_ebitda":
                    yoy = ch.compute_yoy_growth(long, metric=kpi["long_metric"], year=int(year))
                    plot_df = plot_df.merge(yoy, on=["CIQ_ID", "Company"], how="left")
                elif kpi.get("key") == "ebitda_volatility":
                    window = int(kpi.get("window", 5))
                    vol = ch.compute_volatility_std(long, metric=kpi["long_metric"], year=int(year), window=window)
                    plot_df = plot_df.merge(vol, on=["CIQ_ID", "Company"], how="left")

            if value_col not in plot_df.columns:
                st.warning(f"KPI data not found in the prepared dataset: {kpi['label']}.")
                st.caption("This typically means the underlying CIQ column is missing or renamed in the export.")
                return

            plot_df["_kpi_val"] = pd.to_numeric(plot_df[value_col], errors="coerce")
            plot_df = plot_df.dropna(subset=["_kpi_val"]).copy()
            plot_df = plot_df.sort_values("_kpi_val", ascending=(kpi.get("sort") == "asc"))

            with col_left:
                chart_box = st.container(border=True)
                with chart_box:
                    ch._bar_chart(
                        df_plot=plot_df,
                        value_col="_kpi_val",
                        analyzed_company=analyzed_company,
                        title=chart_title,
                        value_format=kpi.get("tickformat"),
                        yaxis_tickformat=kpi.get("tickformat"),
                        yaxis_title=kpi.get("yaxis_title"),
                    )

                    footnote_parts = [
                        f"Shows {kpi['label']} for the selected comparison set in FY{year}.",
                        _rank_note(kpi, "Companies"),
                    ]

                    if kpi.get("key") == "yoy_ebitda":
                        footnote_parts.append(
                            f"YoY growth is calculated into the selected year (FY{int(year)-1} → FY{year}) and excludes companies with prior-year EBITDA ≤ 0."
                        )
                    if kpi.get("key") == "ebitda_volatility":
                        footnote_parts.append(
                            f"Volatility is the standard deviation of EBITDA over the last {int(kpi.get('window', 5))} years ending in FY{year}; requires at least 3 observations."
                        )
                    if asof_note:
                        footnote_parts.append(asof_note)

                    footnote_text = " ".join(footnote_parts)
                    ch.render_chart_footnote(footnote_text)

            table_df = plot_df[["Company", "Country", "Ticker", "_kpi_val"]].rename(columns={"_kpi_val": kpi["label"]})
            plot_df_for_chat = table_df.copy()

        # ----------------------------
        # TIME SERIES: provide a time series for EVERY KPI (including YoY/Volatility),
        # keeping calculation logic identical to the bar logic, just repeated by year.
        # ----------------------------
        else:
            years_ts = [int(y) for y in years if int(y) <= int(year)]

            if kpi.get("level") == "company_long" and kpi.get("key") in {"yoy_ebitda", "ebitda_volatility"}:
                rows = []
                for y in years_ts:
                    if kpi.get("key") == "yoy_ebitda":
                        if y - 1 < min(years_ts):
                            continue
                        yoy = ch.compute_yoy_growth(long, metric=kpi["long_metric"], year=int(y))
                        if yoy is None or yoy.empty:
                            continue
                        tmp = yoy.copy()
                        tmp["Year"] = int(y)
                        tmp = tmp.rename(columns={"YoY Growth": "Value"})
                        rows.append(tmp[["Year", "Company", "Value"]])
                    else:
                        window = int(kpi.get("window", 5))
                        vol = ch.compute_volatility_std(long, metric=kpi["long_metric"], year=int(y), window=window)
                        if vol is None or vol.empty:
                            continue
                        tmp = vol.copy()
                        tmp["Year"] = int(y)
                        tmp = tmp.rename(columns={"Volatility (STD)": "Value"})
                        rows.append(tmp[["Year", "Company", "Value"]])

                ts = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=["Year", "Company", "Value"])
                if ts.empty:
                    st.warning("No data available to plot.")
                    return
                ts = ts[ts["Company"].astype(str).isin([str(c) for c in selected_companies])].copy()
                ts["Value"] = pd.to_numeric(ts["Value"], errors="coerce")
                ts = ts.dropna(subset=["Value"]).copy()

            else:
                # Build time series
                if kpi.get("key") in {"roic", "roce", "roa","ebitda_margin"}:
                    ts = ch.build_company_timeseries_direct(
        long_df=long,
        years=years_ts,
        companies=[str(c) for c in selected_companies],
        metric_name=str(kpi.get("source_metric") or "").strip(),
        country=country,
    )
                else:
                    ts = ch.build_company_timeseries(
        long_df=long,
        years=years_ts,
        companies=[str(c) for c in selected_companies],
        value_col=value_col,
        country=country,
    )       
            if not ts.empty and "Company" in ts.columns and "Value" in ts.columns:
                ts["Value"] = pd.to_numeric(ts["Value"], errors="coerce")
                valid_companies = (
                    ts.groupby("Company")["Value"]
                    .apply(lambda s: s.notna().any() and (s.dropna() != 0).any())
                )
                valid_companies = valid_companies[valid_companies].index.tolist()
                ts = ts[ts["Company"].astype(str).isin([str(c) for c in valid_companies])].copy()
                
            with col_left:
                chart_box = st.container(border=True)
                with chart_box:
                    ch._line_chart(
                        df_plot=ts,
                        analyzed_company=analyzed_company,
                        title=chart_title,
                        yaxis_tickformat=kpi.get("tickformat"),
                        yaxis_title=kpi.get("yaxis_title"),
                        value_format=kpi.get("tickformat"),
                    )

                    y0 = int(min(years_ts)) if years_ts else int(year)
                    footnote_parts = [
                        f"Shows {kpi['label']} over time for the selected comparison set (FY{y0}–FY{year})."
                    ]
                    if kpi.get("key") == "yoy_ebitda":
                        footnote_parts.append(
                            "YoY growth for each year is calculated into that year and excludes companies with prior-year EBITDA ≤ 0."
                        )
                    if kpi.get("key") == "ebitda_volatility":
                        footnote_parts.append(
                            f"Volatility each year is the standard deviation of EBITDA over the last {int(kpi.get('window', 5))} years ending in that year; requires at least 3 observations."
                        )
                    if asof_note:
                        footnote_parts.append(asof_note)

                    footnote_text = " ".join(footnote_parts)
                    ch.render_chart_footnote(footnote_text)
            plot_df_for_chat = ts.rename(columns={"Value": kpi["label"]}).copy()

    # ----------------------------
    # Chart context (for Construct Lens)
    # ----------------------------
    st.session_state["chart_context"] = {
        "page": "Company-level diagnosis",
        "section": "Financial diagnosis",
        "source": PAGE_SOURCE,
        "year": int(year),
        "category": category,
        "kpi": kpi.get("label"),
        "formula": kpi.get("formula"),
        "level": kpi.get("level"),
        "view_mode": "time_series" if is_time_series else "point_in_time",
        "country_filter": country,
        "analyzed_company": analyzed_company,
        "selected_companies": list(selected_companies) if selected_companies else [],
        "footnote": footnote_text,
        "point_in_time_note": asof_note,
    }

    # ----------------------------
    # Export controls (left column, under the chart)
    # - Keep logic unchanged: think-cell template is a bar chart, so we export the selected-year snapshot.
    # - CSV exports the currently displayed table (time series if time-series view; otherwise snapshot)
    # ----------------------------
    with col_left:
        st.write("")
        st.markdown('<div class="export-actions">', unsafe_allow_html=True)
        c1, c2 = st.columns([0.28, 0.72])

        with c1:
            if st.button("PPT", key=f"btn_tc_{kpi.get('key')}_{'ts' if is_time_series else 'pt'}"):
                try:
                    if is_time_series:
                        # ---------------------------------
                        # TIME SERIES EXPORT -> LINE CHART
                        # ---------------------------------
                        if plot_df_for_chat is None or plot_df_for_chat.empty:
                            raise RuntimeError("No time-series data available for export.")

                        ts_export = plot_df_for_chat.copy()

                        # Normalize columns
                        if "Value" not in ts_export.columns and kpi.get("label") in ts_export.columns:
                            ts_export = ts_export.rename(columns={kpi.get("label"): "Value"})

                        if "Company" not in ts_export.columns:
                            if "Country" in ts_export.columns:
                                ts_export = ts_export.rename(columns={"Country": "Company"})
                            else:
                                raise RuntimeError("Time-series export requires a Company or Country column.")

                        if "Year" not in ts_export.columns:
                            raise RuntimeError("Time-series export requires a Year column.")

                        ts_export["Year"] = pd.to_numeric(ts_export["Year"], errors="coerce").astype("Int64")
                        ts_export["Value"] = pd.to_numeric(ts_export["Value"], errors="coerce")
                        ts_export = ts_export.dropna(subset=["Year"]).copy()

                        years_sorted = sorted([int(y) for y in ts_export["Year"].dropna().unique().tolist()])
                        companies_sorted = ts_export["Company"].astype(str).dropna().unique().tolist()

                        series_map = {}
                        for comp in companies_sorted:
                            sub = ts_export[ts_export["Company"].astype(str) == str(comp)].copy()
                            year_to_val = {
                                int(y): (None if pd.isna(v) else float(v))
                                for y, v in zip(sub["Year"], sub["Value"])
                            }
                            series_map[str(comp)] = [year_to_val.get(y, None) for y in years_sorted]

                        ppttc = build_tc_line_ppttc(
                            title=chart_title,
                            years=years_sorted,
                            series_map=series_map,
                            template_ref=THINKCELL_TEMPLATE_LINE,
                        )
                        pptx_bytes = post_to_tcserver(TC_SERVER_URL_DEFAULT, ppttc)
                        trigger_pptx_download(pptx_bytes, f"{kpi.get('key')}_timeseries_to_FY{year}.pptx")

                    else:
                        # ---------------------------------
                        # POINT-IN-TIME EXPORT -> BAR CHART
                        # ---------------------------------
                        if kpi.get("level") == "country":
                            base = plot_df_for_chat.copy()
                            if "Year" in base.columns:
                                base = base[base["Year"].astype(int) == int(year)].copy()
                                if "Country" not in base.columns and "Company" in base.columns:
                                    base = base.rename(columns={"Company": "Country"})
                                if kpi.get("label") not in base.columns and "Value" in base.columns:
                                    base = base.rename(columns={"Value": kpi.get("label")})

                            if "Country" in base.columns and kpi.get("label") in base.columns:
                                labels = base["Country"].astype(str).tolist()
                                values = pd.to_numeric(base[kpi.get("label")], errors="coerce").tolist()
                            else:
                                labels, values = [], []

                        else:
                            wide = w_filt.copy()

                            if kpi.get("level") == "company_long":
                                if kpi.get("key") == "yoy_ebitda":
                                    yoy = ch.compute_yoy_growth(long, metric=kpi["long_metric"], year=int(year))
                                    wide = wide.merge(yoy, on=["CIQ_ID", "Company"], how="left")
                                    wide["_kpi_val"] = pd.to_numeric(wide[kpi["value_col"]], errors="coerce")
                                elif kpi.get("key") == "ebitda_volatility":
                                    window = int(kpi.get("window", 5))
                                    vol = ch.compute_volatility_std(long, metric=kpi["long_metric"], year=int(year), window=window)
                                    wide = wide.merge(vol, on=["CIQ_ID", "Company"], how="left")
                                    wide["_kpi_val"] = pd.to_numeric(wide[kpi["value_col"]], errors="coerce")
                            else:
                                wide["_kpi_val"] = pd.to_numeric(wide[kpi["value_col"]], errors="coerce")

                            wide = wide[wide["Company"].astype(str).isin([str(c) for c in selected_companies])].copy()
                            wide = wide.dropna(subset=["_kpi_val"]).copy()
                            wide = wide.sort_values("_kpi_val", ascending=(kpi.get("sort") == "asc"))

                            labels = wide["Company"].astype(str).tolist()
                            values = pd.to_numeric(wide["_kpi_val"], errors="coerce").tolist()

                        ppttc = build_tc_bar_ppttc(
                            title=chart_title,
                            labels=labels,
                            values=values,
                            template_ref=THINKCELL_TEMPLATE_BAR,
                        )
                        pptx_bytes = post_to_tcserver(TC_SERVER_URL_DEFAULT, ppttc)
                        trigger_pptx_download(pptx_bytes, f"{kpi.get('key')}_FY{year}.pptx")

                except Exception as e:
                    st.error(f"think-cell Server export failed: {e}")
        with c2:
            csv = plot_df_for_chat.to_csv(index=False).encode("utf-8")
            st.download_button(
                "CSV",
                data=csv,
                file_name=f"{kpi.get('key')}_{'timeseries' if is_time_series else f'FY{year}'}.csv",
                mime="text/csv",
                key=f"btn_csv_{kpi.get('key')}_{'ts' if is_time_series else 'pt'}",
            )

        st.markdown('</div>', unsafe_allow_html=True)
        st.caption(f"Source: {PAGE_SOURCE}")


    # ----------------------------
    # CAGR Overview table (below CSV export)
    # - Computed on the currently selected KPI (not shown for percentage KPIs)
    # - Applies start/end shifting rules via unique superscript markers per adjusted cell:
    #     [n] = details of what was shifted and which year(s) were used
    # - Adds note for potentially inflated CAGRs when the start or end denominator value is very small
    # - Allows exporting the CAGR table
    # ----------------------------
    def _is_percentage_kpi(_kpi: dict) -> bool:
        tf = str(_kpi.get("tickformat", "")).strip()
        ytitle = str(_kpi.get("yaxis_title", "")).strip()
        return ("%" in tf) or (ytitle == "%")

    def _small_denom_threshold(_kpi: dict) -> float:
        """
        Heuristic threshold to flag potentially unstable CAGRs due to very small
        start/end values (denominator close to 0). This checks only endpoints,
        not intervening years.
        """
        ytitle = str(_kpi.get("yaxis_title", "")).lower()
        # monetary fields ($ mn, USD '000) -> larger threshold
        if ("$" in ytitle) or ("usd" in ytitle):
            return 1.0
        # ratios (x, units) -> smaller threshold
        return 0.01

    def _compute_cagr_with_adjustments(ts_df: pd.DataFrame, company: str, start_year: int, end_year: int):
        """
        Compute CAGR for the selected KPI between start_year and end_year for one company.

        Rules:
        - If start-year value is missing or <=0, shift start forward to first year within the window with Value > 0.
        - If end-year value is missing or <=0, shift end backward to last year within the window with Value > 0.
        - CAGR is computed over the reduced period (used_end_year - used_start_year).
        Returns:
          (cagr_float_or_None, used_start_year, used_end_year, used_start_value, used_end_value, start_shifted, end_shifted)
        """
        df = ts_df[ts_df["Company"].astype(str) == str(company)].copy()
        if df.empty:
            return (None, None, None, None, None, False, False)

        df = df[(df["Year"].astype(int) >= int(start_year)) & (df["Year"].astype(int) <= int(end_year))].copy()
        df["Value"] = pd.to_numeric(df["Value"], errors="coerce")
        df = df.dropna(subset=["Value"]).sort_values("Year")
        if df.empty:
            return (None, None, None, None, None, False, False)

        # CAGR endpoints require positive values
        df_pos = df[df["Value"] > 0].copy()
        if df_pos.empty:
            return (None, None, None, None, None, False, False)

        # Start endpoint
        start_row = df_pos[df_pos["Year"].astype(int) == int(start_year)]
        if start_row.empty:
            start_row = df_pos[df_pos["Year"].astype(int) > int(start_year)].head(1)
        if start_row.empty:
            return (None, None, None, None, None, False, False)

        used_start_year = int(start_row["Year"].iloc[0])
        start_shifted = used_start_year != int(start_year)

        # End endpoint
        end_row = df_pos[df_pos["Year"].astype(int) == int(end_year)]
        if end_row.empty:
            end_row = df_pos[df_pos["Year"].astype(int) < int(end_year)].tail(1)
        if end_row.empty:
            return (None, used_start_year, None, float(start_row["Value"].iloc[0]), None, start_shifted, False)

        used_end_year = int(end_row["Year"].iloc[0])
        end_shifted = used_end_year != int(end_year)

        if used_end_year <= used_start_year:
            return (
                None,
                used_start_year,
                used_end_year,
                float(start_row["Value"].iloc[0]),
                float(end_row["Value"].iloc[0]),
                start_shifted,
                end_shifted,
            )

        start_val = float(start_row["Value"].iloc[0])
        end_val = float(end_row["Value"].iloc[0])
        n_years = used_end_year - used_start_year
        if start_val <= 0 or end_val <= 0 or n_years <= 0:
            return (None, used_start_year, used_end_year, start_val, end_val, start_shifted, end_shifted)

        cagr = (end_val / start_val) ** (1.0 / n_years) - 1.0
        return (cagr, used_start_year, used_end_year, start_val, end_val, start_shifted, end_shifted)

    # Show table only for company KPIs that are not percentage metrics.
    # For derived long-metrics (e.g., YoY growth) we skip CAGR table.
    show_cagr_table = (
        (kpi.get("level") == "company")
        and (not _is_percentage_kpi(kpi))
        and bool(selected_companies)
        and bool(kpi.get("value_col"))
    )

    if show_cagr_table:
        with col_left:
            st.write("")
            st.markdown("### CAGR Overview")
            st.caption(f"CAGR is computed on the selected KPI: {kpi.get('label')}.")

        periods = [(2000, 2010), (2011, 2019), (2020, 2025)]
        all_years_for_cagr = list(range(min(p[0] for p in periods), max(p[1] for p in periods) + 1))

        # Build KPI time series for the selected companies
        ts_kpi = ch.build_company_timeseries(
            long_df=long,
            years=all_years_for_cagr,
            companies=[str(c) for c in selected_companies],
            value_col=kpi.get("value_col"),
            country=country,
        )
        ts_kpi["Year"] = pd.to_numeric(ts_kpi["Year"], errors="coerce").astype("Int64")

        marker_counter = 1
        marker_notes: list[str] = []

        rows = []

        SMALL_DENOM_THRESHOLD = _small_denom_threshold(kpi)
        small_denom_events = []  # (company, period, start/end, year)

        for comp in [str(c) for c in selected_companies]:
            row = {"Company": comp}
            for (s, e) in periods:
                cagr, ys, ye, vs, ve, start_shifted, end_shifted = _compute_cagr_with_adjustments(ts_kpi, comp, s, e)
                col_name = f"{s}-{e}"

                if cagr is None or ys is None or ye is None:
                    row[col_name] = "n/a"
                    continue

                marks = ""
                if start_shifted or end_shifted:
                    marker_id = marker_counter
                    marker_counter += 1
                    marks = f"<sup>[{marker_id}]</sup>"

                    parts = []
                    if start_shifted:
                        parts.append(f"Starting year shifted to first available non-zero year ({int(ys)})")
                    if end_shifted:
                        parts.append(f"Ending year calculated till the last available non-zero year ({int(ye)})")
                    marker_notes.append(f"[{marker_id}] {comp} ({col_name}): " + "; ".join(parts) + ".")

                # small denominator notes (endpoints only)
                if vs is not None and 0 < abs(float(vs)) < SMALL_DENOM_THRESHOLD:
                    small_denom_events.append((comp, col_name, "start", int(ys)))
                if ve is not None and 0 < abs(float(ve)) < SMALL_DENOM_THRESHOLD:
                    small_denom_events.append((comp, col_name, "end", int(ye)))

                row[col_name] = f"{cagr*100:.2f}%{marks}"

            rows.append(row)

        cagr_df = pd.DataFrame(rows)

        with col_left:
            st.markdown(
                cagr_df.to_html(index=False, escape=False),
                unsafe_allow_html=True,
            )

            # Export CAGR table (plain values with markers stripped for CSV)
            export_df = cagr_df.copy()
            export_df = export_df.replace({r"<sup>\[\d+\]</sup>": ""}, regex=True)
            cagr_csv = export_df.to_csv(index=False).encode("utf-8")
            st.markdown('<div class="export-actions">', unsafe_allow_html=True)
            c1, c2 = st.columns([0.28, 0.72])
            with c1:
                st.download_button(
                    "CSV",
                    data=cagr_csv,
                    file_name=f"cagr_overview_{kpi.get('key')}.csv",
                    mime="text/csv",
                    key=f"btn_cagr_csv_{kpi.get('key')}",
                )
            st.markdown('</div>', unsafe_allow_html=True)
            st.caption(f"Source: {PAGE_SOURCE}")


            notes = []
            if marker_notes:
                notes.extend(marker_notes)

            if small_denom_events:
                buckets = {}
                for comp, per, which, y in small_denom_events:
                    buckets.setdefault((per, which), set()).add(y)
                parts = []
                for (per, which), ys in sorted(buckets.items(), key=lambda x: (x[0][0], x[0][1])):
                    years_list = ", ".join(str(y) for y in sorted(ys))
                    parts.append(f"{per} ({which}: {years_list})")
                notes.append(
                    f"Note: Some CAGRs may appear unusually large when the KPI value at the start or end of a period is very small "
                    f"(e.g., < {SMALL_DENOM_THRESHOLD:g}). Low endpoint values were observed at: {'; '.join(parts)}."
                )

            if notes:
                st.markdown(
                    "<div style='margin-top:10px; color:#6C6C6C; font-size:13px;'>"
                    + "<br>".join(notes)
                    + "</div>",
                    unsafe_allow_html=True,
                )





    # ----------------------------
        # ----------------------------
    # Construct Lens panel (right column)
    # ----------------------------
    with col_right:
        with st.container(border=True):
            st.session_state.setdefault(WEB_SEARCH_ENABLED_KEY, False)
            toggle_col, title_col = st.columns([1, 2])
            with title_col:
                st.markdown(
                    """
                    <div style="font-weight:700;font-family:Arial, Helvetica, sans-serif;font-size:25px;color:#2C5AA0;">
                    Construct Lens
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
            with toggle_col:
                web_on = st.toggle("🌐 Web", value=st.session_state[WEB_SEARCH_ENABLED_KEY], key="cld_web_toggle")
                st.session_state[WEB_SEARCH_ENABLED_KEY] = web_on

            st.markdown(
                '<hr style="border:none;border-top:1px solid rgba(0,0,0,0.15);margin:8px 0 14px 0;">',
                unsafe_allow_html=True,
            )

            def _build_chat_html(messages, is_typing: bool = False) -> str:
                out = ['<div class="chat-wrap" id="chat-box">']
                for msg in messages:
                    role = msg.get("role", "assistant")
                    content = msg.get("content", "")
                    role_class = "user" if role == "user" else "assistant"
                    bubble_class = "user" if role == "user" else "assistant"
                    out.append(f'<div class="chat-row {role_class}">')
                    rendered = html_escape.escape(str(content)) if role == "user" else render_message_content_html(str(content))
                    out.append(f'<div class="bubble {bubble_class}">{rendered}</div>')
                    out.append("</div>")
                if is_typing:
                    out.append('<div class="chat-row assistant">')
                    out.append('<div class="bubble assistant"><div class="typing"><span></span><span></span><span></span></div></div>')
                    out.append("</div>")
                out.append('<div id="chat-bottom"></div>')
                out.append("</div>")
                return "\n".join(out)

            chat_placeholder = st.empty()

            # Render chat ABOVE the input, always.
            chat_placeholder.markdown(
                _build_chat_html(
                    st.session_state["chat_messages"],
                    is_typing=st.session_state.get("is_typing", False),
                ),
                unsafe_allow_html=True,
            )

            # Auto-scroll (MutationObserver), same as Profit Pool page
            components.html(
                """
                <script>
                (function() {
                  function initAutoScroll() {
                    try {
                      const doc = window.parent.document;
                      const box = doc.getElementById("chat-box");
                      if (!box) { setTimeout(initAutoScroll, 100); return; }

                      const scrollToBottom = function() {
                        try {
                          box.scrollTop = box.scrollHeight;
                          if (typeof box.scrollTo === "function") {
                            try { box.scrollTo({ top: box.scrollHeight }); } catch (e) { box.scrollTo(0, box.scrollHeight); }
                          }
                        } catch (e) {}
                      };

                      scrollToBottom();

                      if (!window.parent.__chatAutoScrollObserver) {
                        const obs = new MutationObserver(function() {
                          scrollToBottom();
                          requestAnimationFrame(scrollToBottom);
                          setTimeout(scrollToBottom, 50);
                        });
                        obs.observe(box, { childList: true, subtree: true });
                        window.parent.__chatAutoScrollObserver = obs;
                      } else {
                        requestAnimationFrame(scrollToBottom);
                        setTimeout(scrollToBottom, 50);
                        setTimeout(scrollToBottom, 200);
                      }
                    } catch (e) {}
                  }
                  initAutoScroll();
                })();
                </script>
                """,
                height=0,
            )

            # Input (typing box) lives BELOW the chat history, inside the container.
            user_text = st.chat_input("Ask about the chart or the data…", key="financial_diag_chat_input")
            if user_text:
                st.session_state["chat_messages"].append({"role": "user", "content": user_text})

                st.session_state["is_typing"] = True
                chat_placeholder.markdown(
                    _build_chat_html(st.session_state["chat_messages"], is_typing=True),
                    unsafe_allow_html=True,
                )

                # Keep tool-loop behavior consistent with Profit Pool page
                base_df_for_scope = w_filt if kpi.get("level") != "country" else wide_y
                try:
                    sheets = {
                        "Data (snapshot)": base_df_for_scope,
                        "Data (plot)": plot_df_for_chat,
                    }
                    profile = build_scope_profile(base_df_for_scope, plot_df_for_chat)
                    chart_ctx = st.session_state.get("chart_context", {})
                    dataset_preview = ""
                    try:
                        preview_records = plot_df_for_chat.head(8).to_dict(orient="records")
                        dataset_preview = f"Sample rows from current view: {json.dumps(preview_records, default=str)}"
                    except Exception:
                        dataset_preview = ""
                    current_filters = {
                        "year_selected": int(year) if str(year).isdigit() else year,
                        "category": category,
                        "country": country,
                        "kpi": kpi.get("label"),
                        "kpi_key": kpi.get("key"),
                        "analyzed_company": analyzed_company,
                        "selected_companies": list(selected_companies) if selected_companies else [],
                        "view_mode": "time_series" if is_time_series else "point_in_time",
                    }
                    system_prompt = make_system_prompt(profile, chart_ctx, current_filters)
                    system_prompt += f"""

                    PAGE CONTEXT:
                    - This page is about: company-level financial diagnosis.
                    - Selected KPI category: {category}
                    - Selected KPI: {kpi.get("label")}
                    - Current visual view: {"Time series" if is_time_series else "Point-in-time"}
                    - Selected country filter: {country}
                    - Analyzed company: {analyzed_company}
                    - Comparison companies: {", ".join(list(selected_companies)) if selected_companies else "none"}
                    - Selected year: {year}
                    - Data source label for this page: {PAGE_SOURCE}

                    HOW TO ANSWER:
                    - Always use the current page topic and current chart/data selection as primary context.
                    - If the user asks a web/external question, do NOT ignore the page context.
                    - First interpret the question in the context of this page topic, selected KPI, company set, and chart mode.
                    - Use the page data to anchor the answer wherever useful.
                    - Then use web search to add recent market context, trends, news, external developments, or validation.
                    - If the query is broad, infer the most relevant scope from the page context before searching.
                    - When answering web-based questions, combine:
                    1. what the page/data says, and
                    2. what recent external sources say.
                    - Prefer a helpful answer with best-effort web context instead of refusing because the query is broad.
                    - Only ask the user to refine if the request is genuinely too ambiguous to search.

                    OUTPUT STYLE:
                    - Start with a direct answer.
                    - Use clean formatting with short paragraphs and bullet points where helpful.
                    - Bold only short labels or key takeaways, not whole sentences.
                    - If relevant, include a short section like "What the data shows" before recent web context.
                    - Keep answers specific to the selected KPI and companies, not generic.
                    """

                    mode = "web" if st.session_state.get(WEB_SEARCH_ENABLED_KEY, False) else "dataset"
                    if mode == "dataset":
                        system_prompt += """

                    STRICT DATASET ONLY:
                    - Answer only from the dataset and chart context.
                    - Do not use external news, trends, or web sources.
                    """
                    else:
                        system_prompt += """

                    WEB MODE:
                    - Use web search when needed.
                    - But keep the answer grounded in the page topic, chart, and selected filters.
                    - Do not respond with "please refine your query" unless absolutely necessary.
                    """

                    messages = [{"role": "system", "content": system_prompt}] + st.session_state.get("openai_messages", [])

                    used_dataset_mode = False

                    if mode == "web":
                        web_intent = classify_web_intent(user_text)
                        if web_intent == "chart_only":
                            enriched_user_text = f"""
User question: {user_text}

Answer ONLY from the chart context and Excel-backed data for this page.
Do NOT search the web.
Do NOT include web sources.

Page context:
- Topic/category: company-level financial diagnosis
- Data source for this page: {PAGE_SOURCE}
- KPI category: {category}
- KPI: {kpi.get("label")}
- View: {"Time series" if is_time_series else "Point-in-time"}
- Country filter: {country}
- Analyzed company: {analyzed_company}
- Comparison companies: {", ".join(list(selected_companies)) if selected_companies else "none"}
- Selected year: {year}
{dataset_preview}
"""
                        else:
                            enriched_user_text = f"""
User question: {user_text}

IMPORTANT: You MUST search the web to answer this. Do not say you cannot find sources - always attempt a search.

Page context to ground your answer:
- Topic/category: company-level financial diagnosis
- Data source for this page: {PAGE_SOURCE}
- KPI category: {category}
- KPI: {kpi.get("label")}
- View: {"Time series" if is_time_series else "Point-in-time"}
- Country filter: {country}
- Analyzed company: {analyzed_company}
- Comparison companies: {", ".join(list(selected_companies)) if selected_companies else "none"}
- Selected year: {year}
{dataset_preview}

Instructions:
1. Start by using the page data/chart to understand what the user is referring to.
2. Then search the web for external explanations, trends, drivers, news, or validation in the context of the selected KPI, companies, or market.
3. If the direct query returns nothing useful, broaden to related company, country, or cement-industry context.
4. Combine web findings with what the page data shows.
5. Structure your answer as:
- **What the data shows** (from the dataset/chart context)
- **Recent market context / possible reasons** (from web search)
- **Sources** (list URLs)
6. When possible, explain the likely reasoning behind the KPI movement or company ranking using valid sources.
7. Never respond with "please refine your query" - always make a best-effort answer.
"""
                        messages.append({"role": "user", "content": enriched_user_text})
                        answer, updated_messages = tool_loop_streamlit(
                            messages,
                            sheets=sheets,
                            mode="web",
                        )
                    else:
                        messages.append({"role": "user", "content": user_text})
                        answer, updated_messages = tool_loop_streamlit(
                            messages,
                            sheets=sheets,
                            mode="dataset",
                        )
                        used_dataset_mode = True

                    if used_dataset_mode and answer:
                        source_tag = f"Source: {PAGE_SOURCE}"
                        if source_tag not in str(answer):
                            answer = f"{str(answer).rstrip()}\n\n{source_tag}"
                            
                except Exception as e:
                    answer = f"Sorry - I hit an error: {e}"
                    updated_messages = [{"role": "system", "content": ""}] + st.session_state.get("openai_messages", [])

                st.session_state["chat_messages"].append({"role": "assistant", "content": answer})
                # Persist tool-loop memory (skip the system message)
                if isinstance(updated_messages, list) and len(updated_messages) >= 1:
                    st.session_state["openai_messages"] = updated_messages[1:]
                st.session_state["is_typing"] = False

                chat_placeholder.markdown(
                    _build_chat_html(st.session_state["chat_messages"], is_typing=False),
                    unsafe_allow_html=True,
                )
# ------------------------------------------------------------------
# Backwards-compatible entrypoint (app.py imports this name)
# ------------------------------------------------------------------
def render_financial_diagnosis(ciq_xlsx: Path):
    """Alias maintained for app.py imports."""
    return render_company_level_diagnosis(ciq_xlsx)
