# exec_summary/ux_formatter.py
from __future__ import annotations

import html as html_std
import re
from typing import Dict, List, Tuple

_LABEL_RE = re.compile(r"^\*\*([^*]+)\*\*:\s*(.*)$", re.IGNORECASE)

EXPECTED_ORDER = [
    "Demand",
    "Policy & funding",
    "Supply & costs",
    "Risks & uncertainty",
]

_LABEL_ALIASES = {
    "demand": "Demand",
    "policy & funding": "Policy & funding",
    "policy": "Policy & funding",
    "supply & costs": "Supply & costs",
    "supply": "Supply & costs",
    "risks & uncertainty": "Risks & uncertainty",
    "risk": "Risks & uncertainty",
}

def parse_labeled_bullets(bullets: List[str]) -> List[Tuple[str, str]]:
    parsed: List[Tuple[str, str]] = []

    for raw in bullets or []:
        raw = (raw or "").strip()
        if not raw:
            continue

        m = _LABEL_RE.match(raw)
        if m:
            label = _LABEL_ALIASES.get(m.group(1).strip().lower(), m.group(1).strip())
            body = m.group(2).strip()
            parsed.append((label, body))
        else:
            parsed.append(("", raw))

    return parsed

def normalize_bullets(bullets: List[str]) -> List[Tuple[str, str]]:
    parsed = parse_labeled_bullets(bullets)
    bucketed: Dict[str, str] = {}

    unlabeled: List[str] = []
    for label, body in parsed:
        if label in EXPECTED_ORDER and label not in bucketed:
            bucketed[label] = body
        elif body:
            unlabeled.append(body)

    normalized: List[Tuple[str, str]] = []
    for label in EXPECTED_ORDER:
        if label in bucketed:
            normalized.append((label, bucketed[label]))

    for extra in unlabeled:
        normalized.append(("", extra))

    return normalized

def shorten_text(text: str, max_len: int = 180) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    if len(text) <= max_len:
        return text

    clauses = re.split(r"(?<=[.;])\s+|,\s+", text)
    out = ""
    for clause in clauses:
        candidate = (out + ("; " if out else "") + clause).strip()
        if len(candidate) > max_len:
            break
        out = candidate

    if out:
        return out.rstrip(" ;,") + "…"
    return text[: max_len - 1].rstrip() + "…"

def build_takeaway(headline: str, bullets: List[str], band_label: str) -> str:
    parsed = normalize_bullets(bullets)
    bodies = {label: body for label, body in parsed if label}

    demand = bodies.get("Demand", "")
    supply = bodies.get("Supply & costs", "")
    risk = bodies.get("Risks & uncertainty", "")

    if "underperformance" in (band_label or "").lower():
        return "Growth is constrained by softer fundamentals and tighter delivery or cost conditions."
    if "strong growth" in (band_label or "").lower():
        return "Demand tailwinds are strong, and policy support appears sufficient to outweigh operating constraints."
    if "moderate growth" in (band_label or "").lower():
        return "Demand is supported, with policy tailwinds helping offset supply and cost friction."
    if risk and supply:
        return "Conditions are balanced: supportive demand is partly offset by cost, supply, or execution risks."
    if demand:
        return shorten_text(demand, max_len=120)
    return shorten_text(headline, max_len=120)

def format_quality_message(validation_notes: List[str]) -> Tuple[str, str]:
    note = (validation_notes or ["All quality checks passed"])[0]
    n = note.lower()

    if "passed" in n:
        return "checked", "Quality checked"
    if "regeneration" in n or "regenerations" in n:
        return "refined", "Some lines were refined for clarity and consistency"
    return "checked", shorten_text(note, 90)

def escape(text: str) -> str:
    return html_std.escape(text or "")