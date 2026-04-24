# backend/services/kpi_registry.py
"""
Single source of truth for KPI definitions.
Mirrors the KPI_REGISTRY in cld/financial_diagnosis.py
and KPI_CATEGORIES in deck_builder/slides/slide_06_company_comparison.py.
"""
from __future__ import annotations
from typing import Any, Dict, List

KPI_REGISTRY: List[Dict[str, Any]] = [
    # Investor Value
    {"key": "market_cap",       "label": "Market Capitalization",
     "value_col": "Market capitalization ($ mn)", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Investor Value"},
    {"key": "enterprise_value", "label": "Enterprise Value (EV)",
     "value_col": "Enterprise value ($ mn)", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Investor Value"},

    # Earnings Quality
    {"key": "revenue",        "label": "Revenue",
     "value_col": "_Revenue", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Earnings Quality"},
    {"key": "ebitda",         "label": "EBITDA",
     "value_col": "_EBITDA",  "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Earnings Quality"},
    {"key": "ebitda_margin",  "label": "EBITDA Margin",
     "value_col": "EBITDA margin", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc", "wide_scale": 100, "category": "Earnings Quality"},
    {"key": "operating_margin","label": "Operating Profit Margin",
     "value_col": "Operating profit margin", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc", "category": "Earnings Quality"},
    {"key": "yoy_ebitda",     "label": "Year-over-Year EBITDA Growth",
     "value_col": "YoY Growth", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc",
     "level": "company_long", "long_metric": "EBITDA ($ mn)", "category": "Earnings Quality"},

    # Capital Efficiency
    {"key": "roic",           "label": "Return on Invested Capital (ROIC)",
     "value_col": "ROIC (%)", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc", "category": "Capital Efficiency"},
    {"key": "roce",           "label": "Return on Capital Employed (ROCE)",
     "value_col": "ROCE (%)", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc", "category": "Capital Efficiency"},
    {"key": "roa",            "label": "Return on Assets (ROA)",
     "value_col": "ROA (%)", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "desc", "category": "Capital Efficiency"},
    {"key": "asset_turnover", "label": "Asset Turnover Ratio",
     "value_col": "Asset turnover", "yaxis_title": "x",
     "tickformat": ".2f", "sort": "desc", "category": "Capital Efficiency"},

    # Financial Risk
    {"key": "net_debt",        "label": "Net Debt",
     "value_col": "Net debt ($ mn)", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "asc", "category": "Financial Risk"},
    {"key": "net_debt_ebitda", "label": "Net Leverage",
     "value_col": "Net debt / EBITDA", "yaxis_title": "x",
     "tickformat": ".2f", "sort": "asc", "category": "Financial Risk"},
    {"key": "debt_to_equity",  "label": "Debt-to-Equity Ratio",
     "value_col": "Debt-to-equity", "yaxis_title": "%",
     "tickformat": ".2f", "sort": "asc", "wide_scale": 100, "category": "Financial Risk"},
    {"key": "pct_short_term_debt", "label": "Percentage of Short-Term Debt",
     "value_col": "% short-term debt", "yaxis_title": "%",
     "tickformat": ".0%", "sort": "asc", "category": "Financial Risk"},

    # Cash & Valuation
    {"key": "opcf",      "label": "Operating Cash Flow",
     "value_col": "Operating cash flow ($ mn)", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Cash & Valuation"},
    {"key": "fcf",       "label": "Free Cash Flow (FCF)",
     "value_col": "Free cash flow ($ mn)", "yaxis_title": "$ mn",
     "tickformat": ",.0f", "sort": "desc", "category": "Cash & Valuation"},
    {"key": "fcf_ebitda","label": "Cash Conversion",
     "value_col": "FCF / EBITDA", "yaxis_title": "%",
     "tickformat": ".0%", "sort": "desc", "category": "Cash & Valuation"},
    {"key": "ev_ebitda", "label": "Valuation Multiple",
     "value_col": "EV / EBITDA", "yaxis_title": "x",
     "tickformat": ".2f", "sort": "asc", "category": "Cash & Valuation"},
    {"key": "pe",        "label": "Price-to-Earnings",
     "value_col": "P/E", "yaxis_title": "x",
     "tickformat": ".2f", "sort": "asc", "category": "Cash & Valuation"},

    # Workforce Efficiency
    {"key": "fte",              "label": "Number of Full-Time Employees",
     "value_col": "Full-time employees", "yaxis_title": "Employees",
     "tickformat": ",.0f", "sort": "desc", "category": "Workforce Efficiency"},
    {"key": "ebitda_per_fte",   "label": "Operating Profitability per Employee",
     "value_col": "EBITDA per Employee (USD '000)", "yaxis_title": "USD '000",
     "tickformat": ",.0f", "sort": "desc", "category": "Workforce Efficiency"},
    {"key": "revenue_per_fte",  "label": "Revenue Productivity per Employee",
     "value_col": "Revenue per Employee (USD '000)", "yaxis_title": "USD '000",
     "tickformat": ",.0f", "sort": "desc", "category": "Workforce Efficiency"},
    {"key": "opcf_per_fte",     "label": "Cash Productivity per Employee",
     "value_col": "Operating Cash Flow per Employee (USD '000)", "yaxis_title": "USD '000",
     "tickformat": ",.0f", "sort": "desc", "category": "Workforce Efficiency"},
    {"key": "net_ppe_per_fte",  "label": "Capital Intensity per Employee",
     "value_col": "Net PP&E per Employee (USD '000)", "yaxis_title": "USD '000",
     "tickformat": ",.0f", "sort": "desc", "category": "Workforce Efficiency"},
    {"key": "labor_intensity",  "label": "Labor Intensity",
     "value_col": "Labor intensity (FTE per $ mn revenue)", "yaxis_title": "FTE per $ mn",
     "tickformat": ".2f", "sort": "asc", "category": "Workforce Efficiency"},
]

KPI_BY_KEY:   Dict[str, Dict[str, Any]] = {k["key"]:   k for k in KPI_REGISTRY}
KPI_BY_LABEL: Dict[str, Dict[str, Any]] = {k["label"]: k for k in KPI_REGISTRY}

CATEGORY_ORDER = [
    "Investor Value",
    "Earnings Quality",
    "Capital Efficiency",
    "Financial Risk",
    "Cash & Valuation",
    "Workforce Efficiency",
]

KPI_CATEGORIES: Dict[str, List[Dict[str, Any]]] = {
    cat: [k for k in KPI_REGISTRY if k.get("category") == cat]
    for cat in CATEGORY_ORDER
}