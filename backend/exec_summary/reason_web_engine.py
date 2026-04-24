# exec_summary/reason_web_engine.py
from __future__ import annotations

import hashlib
import json
import os
from dotenv import load_dotenv
load_dotenv(override=True)
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

# This module generates *evidence-backed* driver bullets for the Executive Outlook.
# Headline conclusions (CAGR & regional comparison) remain fully data-driven.

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


# -----------------------------
# Types
# -----------------------------
@dataclass(frozen=True)
class SourceRef:
    title: str
    url: str
    date: Optional[str] = None


# -----------------------------
# Config
# -----------------------------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not OPENAI_API_KEY:
    raise RuntimeError(
        "OPENAI_API_KEY not found. Ensure it is set in your .env file."
    )

client = OpenAI(api_key=OPENAI_API_KEY)

DEFAULT_MODEL = os.getenv("OPENAI_EXEC_OUTLOOK_MODEL", "gpt-4.1-mini")
CACHE_DIR = os.getenv("EXEC_OUTLOOK_REASON_CACHE_DIR", ".exec_outlook_reason_cache")
CACHE_TTL_SECONDS = int(os.getenv("EXEC_OUTLOOK_REASON_CACHE_TTL_SECONDS", str(7 * 24 * 3600)))


_SPECULATIVE_WORDS = re.compile(r"\b(could|may|might|possibly|potential|likely)\b", re.IGNORECASE)

# Heuristics to prevent "risk" bullets from becoming upside drivers or forward-looking projections
_RISK_UPSIDE_WORDS = re.compile(
    r"\b(boost|support|tailwind|catalyst|drive|driving|increase|rising|expand|expanding|growth)\b",
    re.IGNORECASE,
)
_RISK_DEMAND_PHRASES = re.compile(
    r"(increase|boost|support|drive|driving)\s+(cement\s+)?demand|demand\s+(increase|growth|tailwind)",
    re.IGNORECASE,
)
_RISK_PROJECTION_PHRASES = re.compile(
    r"\b(projected to|expected to|forecast to|set to|poised to)\b",
    re.IGNORECASE,
)

# Simple country-consistency denylist for policy/program names (prevents cross-country contamination)
_INDIA_POLICY_MARKERS = re.compile(
    r"\b(PMAY|Pradhan\s+Mantri|Awas\s+Yojana|Union\s+Budget|crore|lakh|\bINR\b|\bRs\b)\b",
    re.IGNORECASE,
)

# Global validators: ensure sections are distinct and Supply & costs contains an economic/cost signal
_SUPPLY_COST_SIGNAL = re.compile(
    r"\b(cost|costs|price|prices|inflation|deflation|margin|margins|energy|fuel|power|electricity|freight|logistics|transport|fx|exchange|currency|tariff|input|labor|labour|utilization|utilisation|capacity\s+utili)\b",
    re.IGNORECASE,
)

# Prevent web-sourced "market definition" numbers (size/CAGR/reach-$X) that can contradict Excel scope/units.
_MARKET_DEFINITION_PHRASES = re.compile(
    r"\b(cagr|compound\s+annual\s+growth\s+rate)\b"
    r"|\b(grow|growing|increase|increasing)\b[^\n]{0,60}?\b(annually|per\s+year|a\s+year)\b"
    r"|\b(reach|reaching|valued\s+at|worth|market\s+size)\b[^\n]{0,40}?[\$€£]|[\$€£][^\n]{0,20}\b(mn|million|bn|billion)\b",
    re.IGNORECASE,
)

# Strong semantic block for market-defining language (forbidden in bullets regardless of source)
_MARKET_DEFINITION_LANGUAGE = re.compile(
    r"\b(market\s+(was|is)\s+valued|market\s+is\s+projected|market\s+will\s+reach|"
    r"market\s+expected\s+to\s+reach|market\s+size|total\s+market|overall\s+market|"
    r"revenue\s+reached|revenue\s+will\s+reach|valued\s+at\s+[\$€£])\b",
    re.IGNORECASE,
)


def _ensure_cache_dir() -> None:
    os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_key(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cache_path(key: str) -> str:
    return os.path.join(CACHE_DIR, f"{key}.json")


def _load_cache(key: str) -> Optional[Dict[str, Any]]:
    try:
        path = _cache_path(key)
        if not os.path.exists(path):
            return None
        if (time.time() - os.path.getmtime(path)) > CACHE_TTL_SECONDS:
            return None
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def _save_cache(key: str, data: Dict[str, Any]) -> None:
    try:
        _ensure_cache_dir()
        with open(_cache_path(key), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception:
        # cache is best-effort
        pass


def _extract_sources_from_openai(resp: Any) -> List[SourceRef]:
    """Best-effort extraction of web sources from Responses API output."""
    sources: List[SourceRef] = []
    try:
        out = getattr(resp, "output", None) or []
        for item in out:
            item_dict = item.model_dump() if hasattr(item, "model_dump") else item
            for block in item_dict.get("content", []) or []:
                ann = block.get("annotations") or []
                for a in ann:
                    if a.get("type") == "web_search_result":
                        title = a.get("title") or a.get("name") or ""
                        url = a.get("url") or ""
                        date = a.get("date")
                        if url:
                            sources.append(SourceRef(title=title or url, url=url, date=date))
    except Exception:
        pass

    # de-dup
    seen = set()
    deduped: List[SourceRef] = []
    for s in sources:
        if s.url in seen:
            continue
        seen.add(s.url)
        deduped.append(s)
    return deduped[:6]


def _force_bucket(label: str, body: str) -> str:
    """
    Enforce correct bucket assignment when the model mislabels
    supply-side or capacity-expansion actions as risks.
    """
    t = body.lower()

    if label == "Risks & uncertainty":
        supply_keywords = [
            "factory", "factories", "plant", "plants",
            "capacity", "production line", "kiln",
            "establish", "commission", "expansion",
            "supply chain", "localization", "localisation",
            "manufacturing", "facility", "facilities",
        ]
        if any(k in t for k in supply_keywords):
            return "Supply & costs"

    return label


def _parse_bullets(text: str) -> List[str]:
    """Parse 4 labeled lines into markdown bullets."""
    text = (text or "").strip()
    lines = [ln.strip() for ln in re.split(r"\r?\n+", text) if ln.strip()]

    # Accept either "Label: ..." or "- Label: ..."
    cleaned: List[str] = []
    for ln in lines:
        ln = re.sub(r"^[-•\*\s]+", "", ln).strip()
        cleaned.append(ln)

    # Keep only recognized prefixes, in fixed order
    order = [
        "Demand:",
        "Policy & funding:",
        "Supply & costs:",
        "Risks & uncertainty:",
    ]

    out: List[str] = []
    for prefix in order:
        match = next((c for c in cleaned if c.lower().startswith(prefix.lower())), None)
        if match:
            body = match[len(prefix):].strip()
            label = prefix[:-1]
            label = _force_bucket(label, body)
            out.append(f"**{label}:** {body}")

    # If we failed to collect all 4, attempt to stitch label-only lines + continuation/citation lines.
    if len(out) != 4:
        stitched: List[str] = []
        pending_label: Optional[str] = None

        def _is_prefix_line(x: str) -> bool:
            return any(x.lower().startswith(p.lower()) for p in order)

        def _is_citation_only_line(x: str) -> bool:
            return bool(re.match(r"^\(\s*[^)]+\.[a-z]{2,}\s*\)$", x.strip(), flags=re.IGNORECASE))

        for ln in cleaned:
            if stitched and _is_citation_only_line(ln):
                stitched[-1] = stitched[-1].rstrip() + " " + ln.strip()
                continue

            if _is_prefix_line(ln):
                prefix = next(p for p in order if ln.lower().startswith(p.lower()))
                body = ln[len(prefix):].strip()
                label = prefix[:-1]

                if body:
                    label = _force_bucket(label, body)
                    stitched.append(f"**{label}:** {body}")
                    pending_label = None
                else:
                    pending_label = label
                continue

            if pending_label is not None:
                body = ln.strip()
                label = _force_bucket(pending_label, body)
                stitched.append(f"**{label}:** {body}")
                pending_label = None
            else:
                stitched.append(ln.strip())

        if len(stitched) >= 4:
            out = stitched[:4]
        else:
            fallback = cleaned[:4]
            out = [f"- {ln}" for ln in fallback] if fallback else []
    return out


def _validate_risk_line(bullets: List[str]) -> bool:
    """Ensure the 4th bullet (risk) is non-speculative and includes an evidence anchor."""
    if not bullets or len(bullets) < 4:
        return False
    risk = bullets[3]
    if _SPECULATIVE_WORDS.search(risk):
        return False
    has_number = bool(re.search(r"\d", risk))
    has_year = bool(re.search(r"\b(19\d{2}|20\d{2})\b", risk))
    return has_number or has_year


def _validate_demand_no_figures(bullets: List[str]) -> bool:
    """Ensure the Demand line contains no numeric figures."""
    if not bullets:
        return True
    demand = bullets[0]
    return not bool(re.search(r"\d", demand))


def _validate_risk_is_downside(bullets: List[str]) -> bool:
    """Ensure the Risks & uncertainty line is actually a downside/headwind."""
    if not bullets or len(bullets) < 4:
        return False
    risk = bullets[3].lower()

    if _RISK_DEMAND_PHRASES.search(risk):
        return False

    if _RISK_PROJECTION_PHRASES.search(risk):
        return False

    if _RISK_UPSIDE_WORDS.search(risk):
        if not re.search(r"\b(risk|uncertaint|headwind|delay|decline|slow|tighten|cut|shortage|disrupt|downturn|constraint|pressure)\b", risk):
            return False

    return True


def _validate_policy_country_consistency(bullets: List[str], country: str) -> bool:
    """Ensure the Policy & funding line references programs consistent with the given country."""
    if not bullets or len(bullets) < 2:
        return False
    policy = bullets[1]
    c = (country or "").strip().lower()

    if c not in {"india", "republic of india"}:
        if _INDIA_POLICY_MARKERS.search(policy):
            return False

    return True


def _validate_supply_costs_has_cost_signal(bullets: List[str]) -> bool:
    """Supply & costs must include an economic/cost/price/utilization signal."""
    if not bullets or len(bullets) < 3:
        return False
    supply = bullets[2]
    return bool(_SUPPLY_COST_SIGNAL.search(supply))


def _normalize_for_overlap(s: str) -> set:
    s = re.sub(r"\*\*[^*]+\*\*:\s*", "", s)
    s = re.sub(r"[^a-z0-9\s]", " ", (s or "").lower())
    tokens = [t for t in s.split() if len(t) > 3]
    return set(tokens)


def _validate_supply_not_duplicate_demand(bullets: List[str], min_jaccard: float = 0.5) -> bool:
    """Ensure Supply & costs is not materially duplicating Demand."""
    if not bullets or len(bullets) < 3:
        return False
    d = _normalize_for_overlap(bullets[0])
    s = _normalize_for_overlap(bullets[2])
    if not d or not s:
        return True
    inter = len(d & s)
    union = len(d | s)
    j = inter / union if union else 0.0
    return j < min_jaccard


def _validate_no_repetition_across_bullets(bullets: List[str], min_jaccard: float = 0.5) -> bool:
    """Ensure no two bullets materially repeat the same mechanism."""
    if not bullets or len(bullets) < 4:
        return False

    sets = [_normalize_for_overlap(b) for b in bullets]
    for i, j in ((0, 1), (0, 2), (0, 3), (1, 2), (1, 3), (2, 3)):
        a, b = sets[i], sets[j]
        if not a or not b:
            continue
        inter = len(a & b)
        union = len(a | b)
        score = inter / union if union else 0.0
        if score >= min_jaccard:
            return False
    return True


def _validate_no_market_definitions_in_bullets(bullets: List[str]) -> bool:
    """Disallow any market-defining language in bullets."""
    if not bullets:
        return True
    for b in bullets:
        if _MARKET_DEFINITION_PHRASES.search(b):
            return False
        if _MARKET_DEFINITION_LANGUAGE.search(b):
            return False
    return True


def _validate_global_bullets(bullets: List[str], country: str) -> bool:
    """Global validator enforcing key structural quality constraints."""
    return (
        _validate_demand_no_figures(bullets)
        and _validate_no_market_definitions_in_bullets(bullets)
        and _validate_risk_line(bullets)
        and _validate_risk_is_downside(bullets)
        and _validate_policy_country_consistency(bullets, country)
        and _validate_supply_costs_has_cost_signal(bullets)
        and _validate_supply_not_duplicate_demand(bullets)
        and _validate_no_repetition_across_bullets(bullets)
    )


_CAGR_MENTION_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%\s*(?:cagr|CAGR)")


def _validate_cagr_mentions(
    bullets: List[str],
    allowed_cagrs_pct: List[float],
    tol_pct: float = 0.2,
) -> bool:
    """If any bullet mentions a CAGR %, ensure it matches the Excel-provided benchmark(s)."""
    if not bullets:
        return True

    if not allowed_cagrs_pct:
        for b in bullets:
            if _CAGR_MENTION_RE.search(b):
                return False
        return True

    for b in bullets:
        for mm in _CAGR_MENTION_RE.finditer(b):
            try:
                val = float(mm.group(1))
            except Exception:
                continue
            if not any(abs(val - a) <= tol_pct for a in allowed_cagrs_pct if a is not None):
                return False
    return True


def generate_exec_outlook_bullets(
    *,
    country: str,
    region: str,
    category: str,
    start_year: int,
    end_year: int,
    country_cagr: Optional[float],
    region_cagr: Optional[float],
    delta_pp: Optional[float],
    yoy_2425: Optional[float] = None,
    band_label: str,
    model: str = DEFAULT_MODEL,
    use_cache: bool = True,
) -> Tuple[List[str], List[SourceRef], Dict[str, Any]]:
    """Return (bullets, sources, debug). Bullets are 4 markdown strings."""

    payload = {
        "country": country,
        "region": region,
        "category": category,
        "start_year": start_year,
        "end_year": end_year,
        "country_cagr": country_cagr,
        "region_cagr": region_cagr,
        "delta_pp": delta_pp,
        "band_label": band_label,
        "yoy_2425": yoy_2425,
        "model": model,
        "prompt_version": "v9-no-market-definition-language",
    }
    key = _cache_key(payload)

    if use_cache:
        cached = _load_cache(key)
        if cached and isinstance(cached.get("bullets"), list):
            bullets = list(cached["bullets"])
            sources = [SourceRef(**s) for s in cached.get("sources", [])]
            debug = dict(cached.get("debug", {}))
            debug["cache_hit"] = True
            return bullets, sources, debug

    # ── Initialise debug including regen-tracking flags ───────────────────────
    # These boolean flags are read by executive_outlook_builder._build_validation_notes()
    # to produce human-readable status messages in the rendered UI.
    debug: Dict[str, Any] = {
        "cache_hit": False,
        # Regeneration tracking — flipped to True if the corresponding retry fires
        # and produces an accepted result.
        "regen_demand":        False,
        "regen_risk":          False,
        "regen_risk_downside": False,
        "regen_policy":        False,
        "regen_global":        False,
        "regen_cagr":          False,
    }

    # If OpenAI SDK is not available (e.g., local lint), return empty bullets.
    if OpenAI is None:
        return [], [], {**debug, "error": "OpenAI SDK not available"}

    c_cagr_txt = "N/A" if country_cagr is None else f"{country_cagr*100:.1f}%"
    r_cagr_txt = "N/A" if region_cagr is None else f"{region_cagr*100:.1f}%"
    delta_txt = "N/A" if delta_pp is None else f"{delta_pp:+.1f}pp"

    yoy_txt = "N/A" if yoy_2425 is None else f"{yoy_2425*100:+.1f}%"

    yoy_guardrail = ""
    if yoy_2425 is not None and yoy_2425 < 0:
        yoy_guardrail = (
            "Excel indicates a YoY revenue decline from 2024 to 2025. "
            "Do NOT claim that 2025 is higher than 2024; frame any positives as pipeline or medium-term potential."
        )

    query_hint = f"{country} {category} outlook drivers {start_year} {end_year} housing infrastructure investment cement building materials".replace(",", " ")

    system = (
        "You are writing Bain-style executive summary drivers for construction and building materials. "
        "You must be factual, specific, and evidence-backed using recent web information. "
        "Do not invent numbers. If a number is uncertain, use an approximate qualifier (e.g., ~, around, >). "
        "Never contradict the given CAGR comparison. "
    )

    # Relative positioning instruction
    if band_label.lower().startswith("under"):
        relative_instruction = (
            "The country is UNDERPERFORMING its regional benchmark. "
            "Your bullets must explain WHY growth trails the region. "
            "Positive developments may be mentioned ONLY if explicitly offset by constraints. "
            "At least two bullets must describe binding constraints or headwinds "
            "(e.g., FX pressure, financing costs, execution bottlenecks, import dependence, policy frictions) "
            "that limit growth relative to peers."
        )
    elif band_label.lower().startswith("out"):
        relative_instruction = (
            "The country is OUTPERFORMING its regional benchmark. "
            "Your bullets must explain WHY growth exceeds peers, "
            "highlighting catalysts that are stronger or more advanced than in the region."
        )
    else:
        relative_instruction = (
            "The country is broadly IN LINE with its regional benchmark. "
            "Your bullets should present a balanced mix of supportive drivers and constraints."
        )

    user = f"""
Country: {country}
Region benchmark: {region}
Category: {category}
Horizon: {start_year}–{end_year}
Data-driven benchmark (do not dispute): country CAGR ~{c_cagr_txt}, region CAGR ~{r_cagr_txt} (delta {delta_txt}; band: {band_label}).
Excel YoY (2024→2025): {yoy_txt}.
{yoy_guardrail}
{relative_instruction}

Task:
Write EXACTLY four lines, in this exact order, each starting with the label prefix:
1) Demand:
2) Policy & funding:
3) Supply & costs:
4) Risks & uncertainty:

Rules:
- Segment definitions (do NOT change scope):
  * Construction overall = the total construction market (all end uses; not limited to cement).
  * Building products = a sub-segment of construction, covering all building materials/products.
  * Cement, concrete & lime = a sub-segment of building products, focused on cement-related materials only.
- Demand must NOT include any numeric figures, revenue, or growth rates; explain only the qualitative drivers behind the Excel headline for the defined segment.
- Policy & funding, Supply & costs, and Risks & uncertainty must each include at least ONE concrete figure (€, $, %, bn, mtpa, unit counts, or a year + magnitude).
- Each bullet must address a DISTINCT mechanism; do NOT repeat the same driver, phrasing, or logic across bullets.
- Avoid repetition ACROSS categories for the same country: if you already cited a specific project/program in Construction overall, do not reuse the same named example in Building products or Cement; choose a different angle.
- Do NOT output label-only lines. Each of the four lines must include the label and its sentence on the SAME line.
- Policy & funding must reference programs/budgets specific to the stated country; do NOT cite policies from other countries.
- Supply & costs must include a cost/price/utilization/margin signal (not only capacity additions) and must be distinct from Demand drivers.
- Risks & uncertainty must be NON-SPECULATIVE, describe a downside/headwind (not a demand catalyst), and be anchored in an observable signal or precedent.
- Do NOT include market-definition numbers in any bullet (no market size '$X', no 'reach $X by year', no 'grow at Y% annually', no 'CAGR'); the Excel headline is the only market definition.
- Excel is the primary source for CAGR. Do NOT cite or repeat any CAGR from web sources.
- Keep each line to ~120–180 characters.

Use recent sources (prefer last 18 months). Search the web as needed. Query hint: {query_hint}
""".strip()

    openai_client = OpenAI()

    try:
        resp = openai_client.responses.create(
            model=model,
            input=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            tools=[{"type": "web_search"}],
            temperature=0.2,
        )

        # Prefer output_text if available
        out_text = getattr(resp, "output_text", None)
        if not out_text:
            out_text = ""
            for item in getattr(resp, "output", []) or []:
                item_dict = item.model_dump() if hasattr(item, "model_dump") else item
                for block in item_dict.get("content", []) or []:
                    if block.get("type") in ("output_text", "text"):
                        out_text += (block.get("text") or "") + "\n"

        bullets = _parse_bullets(out_text)
        sources = _extract_sources_from_openai(resp)

        # ── Retry 1: Demand has figures ───────────────────────────────────────
        if bullets and not _validate_demand_no_figures(bullets):
            tighter_user = user + "\n\nIMPORTANT: The Demand line must contain NO numbers or figures."
            resp_d = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": tighter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text_d = getattr(resp_d, "output_text", None) or ""
            bullets_d = _parse_bullets(out_text_d)
            if bullets_d and _validate_demand_no_figures(bullets_d):
                bullets = bullets_d
                src_d = _extract_sources_from_openai(resp_d)
                merged = {s.url: s for s in (sources + src_d)}
                sources = list(merged.values())[:6]
                debug["regen_demand"] = True  # ← regen flag

        # ── Retry 2: Risk line fails evidence-anchor check ────────────────────
        if bullets and not _validate_risk_line(bullets):
            tighter_user = user + "\n\nIMPORTANT: The 4th line must NOT contain speculative words and must contain a number or year."
            resp2 = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": tighter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text2 = getattr(resp2, "output_text", None) or ""
            bullets2 = _parse_bullets(out_text2)
            if bullets2 and _validate_risk_line(bullets2):
                bullets = bullets2
                src2 = _extract_sources_from_openai(resp2)
                merged = {s.url: s for s in (sources + src2)}
                sources = list(merged.values())[:6]
                debug["regen_risk"] = True  # ← regen flag

        # ── Retry 3: Risk is not a downside ───────────────────────────────────
        if bullets and not _validate_risk_is_downside(bullets):
            tighter_user = user + "\n\nIMPORTANT: The Risks & uncertainty line must be a downside/headwind and must NOT describe demand catalysts or use projection phrases like 'projected/expected'."
            resp_r = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": tighter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text_r = getattr(resp_r, "output_text", None) or ""
            bullets_r = _parse_bullets(out_text_r)
            if bullets_r and _validate_risk_line(bullets_r) and _validate_risk_is_downside(bullets_r):
                bullets = bullets_r
                src_r = _extract_sources_from_openai(resp_r)
                merged = {s.url: s for s in (sources + src_r)}
                sources = list(merged.values())[:6]
                debug["regen_risk_downside"] = True  # ← regen flag

        # ── Retry 4: Policy is cross-country contaminated ─────────────────────
        if bullets and not _validate_policy_country_consistency(bullets, country):
            tighter_user = user + "\n\nIMPORTANT: The Policy & funding line must reference policies/programs specific to the stated country. Do NOT reference programs from other countries."
            resp_p = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": tighter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text_p = getattr(resp_p, "output_text", None) or ""
            bullets_p = _parse_bullets(out_text_p)
            if bullets_p and _validate_policy_country_consistency(bullets_p, country):
                bullets = bullets_p
                src_p = _extract_sources_from_openai(resp_p)
                merged = {s.url: s for s in (sources + src_p)}
                sources = list(merged.values())[:6]
                debug["regen_policy"] = True  # ← regen flag

        # ── Retry 5: Global quality gate ──────────────────────────────────────
        if bullets and not _validate_global_bullets(bullets, country):
            tighter_user = user + (
                "\n\nIMPORTANT: Global quality rules: "
                "Demand has NO numbers; Supply & costs must include cost/price/utilization/margin and must not repeat Demand; "
                "Do NOT repeat the same mechanism across bullets; "
                "Do NOT include market-definition numbers (no market size/reach-$X/grow-%-annually/CAGR) in bullets; "
                "Policy must be country-specific; Risk must be a downside/headwind and non-speculative."
            )
            resp_g = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": tighter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text_g = getattr(resp_g, "output_text", None) or ""
            bullets_g = _parse_bullets(out_text_g)
            if bullets_g and _validate_global_bullets(bullets_g, country):
                bullets = bullets_g
                src_g = _extract_sources_from_openai(resp_g)
                merged = {s.url: s for s in (sources + src_g)}
                sources = list(merged.values())[:6]
                debug["regen_global"] = True  # ← regen flag

        # ── Retry 6: CAGR consistency ─────────────────────────────────────────
        allowed_cagrs = []
        if country_cagr is not None:
            allowed_cagrs.append(country_cagr * 100.0)
        if region_cagr is not None:
            allowed_cagrs.append(region_cagr * 100.0)

        if bullets and not _validate_cagr_mentions(bullets, allowed_cagrs):
            stricter_user = user + (
                f"\n\nIMPORTANT: If you mention CAGR, you may ONLY use the benchmark values: "
                f"country CAGR ~{c_cagr_txt}"
                + (f", region CAGR ~{r_cagr_txt}." if r_cagr_txt != "N/A" else ".")
                + " Do not quote any other CAGR from web sources."
            )
            resp3 = openai_client.responses.create(
                model=model,
                input=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": stricter_user},
                ],
                tools=[{"type": "web_search"}],
                temperature=0.2,
            )
            out_text3 = getattr(resp3, "output_text", None) or ""
            bullets3 = _parse_bullets(out_text3)
            if bullets3 and _validate_risk_line(bullets3) and _validate_cagr_mentions(bullets3, allowed_cagrs):
                bullets = bullets3
                src3 = _extract_sources_from_openai(resp3)
                merged = {s.url: s for s in (sources + src3)}
                sources = list(merged.values())[:6]
                debug["regen_cagr"] = True  # ← regen flag

        debug.update(
            {
                "model": model,
                "raw_output": out_text,
                "source_count": len(sources),
            }
        )

        result = {"bullets": bullets, "sources": [s.__dict__ for s in sources], "debug": debug}
        if use_cache:
            _save_cache(key, result)

        return bullets, sources, debug

    except Exception as e:
        debug["error"] = repr(e)
        return [], [], debug


# -------------------------------------------------------------------
# Backwards-compatible helper (legacy Q/A flow)
# -------------------------------------------------------------------
def add_reason_bullets(*args, **kwargs):
    """Legacy entrypoint retained to avoid breaking older pages."""
    return None