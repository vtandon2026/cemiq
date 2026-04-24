"""
exec_summary/exec_outlook_renderer.py
======================================
Converts a list of SectionOutlook objects into a self-contained HTML string
that can be embedded in Streamlit (components.html), Flask (Markup), or
any other web framework.

Usage
-----
    from exec_summary.executive_outlook_builder import build_country_exec_outlook
    from exec_summary.exec_outlook_renderer import render_country_outlook

    sections = build_country_exec_outlook(df_long, country="Germany")
    html = render_country_outlook(sections)

    # Streamlit
    import streamlit.components.v1 as components
    components.html(html, height=700, scrolling=True)

    # Flask / Jinja2
    from markupsafe import Markup
    return render_template("page.html", outlook=Markup(html))
"""
from __future__ import annotations

import re
from typing import List, Optional, Tuple
from exec_summary.ux_formatter import normalize_bullets, shorten_text, escape
from exec_summary.executive_outlook_builder import SectionOutlook


# ---------------------------------------------------------------------------
# Band → badge CSS class + dot colour
# ---------------------------------------------------------------------------
_BAND_BADGE: dict[str, tuple[str, str]] = {
    "Stable":                    ("badge-stable",    "#185FA5"),
    "Moderate growth":           ("badge-moderate",  "#3B6D11"),
    "Strong growth":             ("badge-strong",    "#27500A"),
    "Moderate underperformance": ("badge-under",     "#854F0B"),
    "Material underperformance": ("badge-material",  "#A32D2D"),
}

# Human-readable tab labels matching SECTION_CATEGORIES order
_TAB_LABELS: dict[str, str] = {
    "Construction overall":               "Construction overall",
    "Building Products Overall Sales":    "Building products",
    "Cement, Concrete, Lime Overall Sales": "Cement, concrete & lime",
}

# Per-bullet visual metadata: (display label, icon-bg CSS class, label colour CSS class)
_BULLET_META: list[tuple[str, str, str]] = [
    ("Demand",             "icon-demand",  "label-demand"),
    ("Policy & funding",   "icon-policy",  "label-policy"),
    ("Supply & costs",     "icon-supply",  "label-supply"),
    ("Risks & uncertainty","icon-risk",    "label-risk"),
]

_LABEL_RE = re.compile(r"^\*\*([^*]+)\*\*:\s*")

_META_BY_LABEL = {
    "Demand": ("icon-demand", "label-demand"),
    "Policy & funding": ("icon-policy", "label-policy"),
    "Supply & costs": ("icon-supply", "label-supply"),
    "Risks & uncertainty": ("icon-risk", "label-risk"),
}

# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def _strip_label(raw: str) -> tuple[str, str]:
    """Return (label_text, body_text) from a '**Label:** body' markdown string."""
    m = _LABEL_RE.match(raw)
    if m:
        return m.group(1), raw[m.end():]
    return "", raw


def _fmt_cagr(v: Optional[float]) -> str:
    return "N/A" if v is None else f"{v * 100:.1f}%"


def _fmt_delta(dp: Optional[float]) -> tuple[str, str]:
    """Return (chip_text, css_key) where css_key is one of 'pos'/'neg'/'flat'."""
    if dp is None:
        return "", "flat"
    sign = "+" if dp >= 0 else "−"
    css = "pos" if dp > 0.5 else ("neg" if dp < -0.5 else "flat")
    return f"{sign}{abs(dp):.1f}pp vs region", css


# ---------------------------------------------------------------------------
# Per-section HTML
# ---------------------------------------------------------------------------

# Inline SVG icons for each bullet type — kept small (14×14 px viewBox)
_BULLET_ICONS: dict[str, str] = {
    "icon-demand": (
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
        '<rect x="2" y="7" width="2" height="5" rx="1" fill="#185FA5"/>'
        '<rect x="6" y="4" width="2" height="8" rx="1" fill="#185FA5"/>'
        '<rect x="10" y="1" width="2" height="11" rx="1" fill="#185FA5"/>'
        "</svg>"
    ),
    "icon-policy": (
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
        '<rect x="1" y="9" width="12" height="3" rx="1" fill="#0F6E56"/>'
        '<rect x="4" y="3" width="6" height="6" rx="1" fill="#0F6E56" opacity="0.4"/>'
        '<rect x="6" y="1" width="2" height="4" rx="1" fill="#0F6E56"/>'
        "</svg>"
    ),
    "icon-supply": (
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
        '<circle cx="7" cy="7" r="5" stroke="#854F0B" stroke-width="1.5" fill="none"/>'
        '<path d="M7 4v3l2 2" stroke="#854F0B" stroke-width="1.5" stroke-linecap="round"/>'
        "</svg>"
    ),
    "icon-risk": (
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">'
        '<path d="M7 2L12.2 11H1.8L7 2Z" stroke="#A32D2D" stroke-width="1.5" fill="none" stroke-linejoin="round"/>'
        '<line x1="7" y1="6" x2="7" y2="9" stroke="#A32D2D" stroke-width="1.5" stroke-linecap="round"/>'
        '<circle cx="7" cy="10.5" r="0.75" fill="#A32D2D"/>'
        "</svg>"
    ),
}

# Badge SVG dot — colour injected at render time
_BADGE_DOT = '<svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true"><circle cx="4" cy="4" r="4" fill="{color}"/></svg>'


def render_section(s: SectionOutlook) -> str:
    """Return the inner HTML for a single category card."""
    badge_cls, badge_color = _BAND_BADGE.get(s.band_label, ("badge-stable", "#185FA5"))
    delta_text, delta_css = _fmt_delta(s.delta_pp)

    delta_chip = (
        f'<span class="eo-delta delta-{delta_css}">{delta_text}</span>'
        if delta_text else ""
    )

    takeaway_html = ""
    if s.takeaway:
        takeaway_html = f'<p class="eo-takeaway">{escape(s.takeaway)}</p>'

    # ── Bullets ──────────────────────────────────────────────────────────────
    normalized = normalize_bullets(s.bullets)

    if not normalized:
      bullets_html = """
      <div class="eo-empty-state">
        Driver details are not available for this section yet.
      </div>
      """
    bullets_html = ""
    for label, body in normalized[:4]:
        if not label:
            continue

        icon_cls, label_cls = _META_BY_LABEL.get(label, ("icon-demand", "label-demand"))
        icon_svg = _BULLET_ICONS.get(icon_cls, "")

        bullets_html += f"""
        <div class="eo-bullet">
          <div class="eo-bullet-icon {icon_cls}">{icon_svg}</div>
          <div class="eo-bullet-body">
            <div class="eo-bullet-label {label_cls}">{escape(label)}</div>
            <div class="eo-bullet-text">{escape(shorten_text(body, 220))}</div>
          </div>
        </div>"""

    # ── Source chips ──────────────────────────────────────────────────────────
    source_chips = ""
    for src in (s.source_refs or []):
        title = escape(src.get("title", "") or src.get("domain", "") or "Source")
        domain = escape(src.get("domain", ""))
        url = escape(src.get("url", "#"))
        chip_text = domain or title
        source_chips += (
            f'<a class="eo-source-chip eo-source-link" href="{url}" '
            f'target="_blank" rel="noopener noreferrer" title="{title}">{chip_text}</a>'
        )

    {source_chips if source_chips else '<span class="eo-source-label">Evidence links unavailable</span>'}
    
    # ── Validation note ───────────────────────────────────────────────────────
    note = s.quality_message or "Quality checked"
    dot_color = "#9FE1CB" if (s.quality_status == "checked") else "#FAC775"

    return f"""
<div class="eo-card">
  <div class="eo-header">
    <div class="eo-header-copy">
      <p class="eo-headline">{escape(s.headline)}</p>
      {takeaway_html}
    </div>
    <span class="eo-badge {badge_cls}">
      {_BADGE_DOT.format(color=badge_color)}
      {escape(s.band_label)}
    </span>
  </div>

  <div class="eo-cagr-row">
    <div class="eo-cagr-item">
      <span class="eo-cagr-label">Country CAGR</span>
      <span class="eo-cagr-val">{_fmt_cagr(s.country_cagr)} {delta_chip}</span>
    </div>
    <div class="eo-cagr-item">
      <span class="eo-cagr-label">Region avg</span>
      <span class="eo-cagr-val">{_fmt_cagr(s.region_cagr)}</span>
    </div>
  </div>

  <hr class="eo-divider">

  <div class="eo-bullets">{bullets_html}</div>

  <hr class="eo-divider">

  <div class="eo-footer">
    <div class="eo-sources">
      <span class="eo-source-label">Sources</span>
      {source_chips if source_chips else '<span class="eo-source-label">—</span>'}
    </div>
    <div class="eo-regen">
      <div class="eo-regen-dot" style="background:{dot_color}"></div>
      {note}
    </div>
  </div>
</div>"""


# ---------------------------------------------------------------------------
# CSS  (minified single block — no external dependencies)
# ---------------------------------------------------------------------------
_CSS = """<style>
.eo-tabs{display:flex;gap:6px;margin-bottom:1.25rem;flex-wrap:wrap}
.eo-tab{padding:6px 14px;border-radius:999px;border:0.5px solid var(--color-border-secondary,#ccc);
  background:transparent;font-size:13px;color:var(--color-text-secondary,#555);cursor:pointer;
  transition:background .15s}
.eo-tab:hover{background:var(--color-background-secondary,#f5f5f5)}
.eo-tab.active{background:var(--color-background-secondary,#f5f5f5);
  color:var(--color-text-primary,#111);border-color:var(--color-border-primary,#999);font-weight:500}
.eo-card{background:var(--color-background-primary,#fff);
  border:0.5px solid var(--color-border-tertiary,#e0e0e0);
  border-radius:var(--border-radius-lg,12px);padding:1.25rem}
.eo-header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:1rem}
.eo-headline{font-size:15px;line-height:1.5;color:var(--color-text-primary,#111);
  font-weight:400;flex:1;margin:0}
.eo-badge{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;
  border-radius:999px;font-size:12px;font-weight:500;white-space:nowrap}
.badge-stable{background:#E6F1FB;color:#185FA5}
.badge-moderate{background:#EAF3DE;color:#3B6D11}
.badge-strong{background:#C0DD97;color:#27500A}
.badge-under{background:#FAEEDA;color:#854F0B}
.badge-material{background:#FCEBEB;color:#A32D2D}
.eo-divider{border:none;border-top:0.5px solid var(--color-border-tertiary,#e0e0e0);margin:1rem 0}
.eo-cagr-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:1rem}
.eo-cagr-item{display:flex;flex-direction:column;gap:1px}
.eo-cagr-label{font-size:11px;color:var(--color-text-tertiary,#888);
  text-transform:uppercase;letter-spacing:.04em}
.eo-cagr-val{font-size:15px;font-weight:500;color:var(--color-text-primary,#111)}
.eo-delta{font-size:12px;padding:2px 6px;border-radius:4px;font-weight:500;margin-left:4px}
.delta-pos{background:#EAF3DE;color:#3B6D11}
.delta-neg{background:#FAEEDA;color:#854F0B}
.delta-flat{background:#E6F1FB;color:#185FA5}
.eo-bullets{display:flex;flex-direction:column;gap:10px}
.eo-bullet{display:flex;gap:10px;align-items:flex-start}
.eo-bullet-icon{width:26px;height:26px;border-radius:var(--border-radius-md,8px);
  flex-shrink:0;display:flex;align-items:center;justify-content:center}
.icon-demand{background:#E6F1FB}
.icon-policy{background:#E1F5EE}
.icon-supply{background:#FAEEDA}
.icon-risk{background:#FCEBEB}
.eo-bullet-body{flex:1}
.eo-bullet-label{font-size:12px;font-weight:500;margin-bottom:2px}
.label-demand{color:#185FA5}
.label-policy{color:#0F6E56}
.label-supply{color:#854F0B}
.label-risk{color:#A32D2D}
.eo-bullet-text{font-size:14px;color:var(--color-text-primary,#111);line-height:1.5}
.eo-footer{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.eo-sources{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.eo-source-label{font-size:12px;color:var(--color-text-tertiary,#888)}
.eo-source-chip{font-size:12px;padding:3px 8px;border-radius:999px;
  border:0.5px solid var(--color-border-tertiary,#e0e0e0);
  color:var(--color-text-secondary,#555);background:var(--color-background-secondary,#f5f5f5)}
.eo-regen{font-size:12px;color:var(--color-text-tertiary,#888);
  display:flex;align-items:center;gap:4px}
.eo-regen-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.eo-header-copy{flex:1;min-width:0}
.eo-takeaway{
  margin:.35rem 0 0 0;
  font-size:13px;
  line-height:1.45;
  color:var(--color-text-secondary,#555);
}
.eo-source-link{
  text-decoration:none;
}
.eo-source-link:hover{
  border-color:var(--color-border-primary,#999);
  color:var(--color-text-primary,#111);
}
.eo-empty-state{
  font-size:13px;
  color:var(--color-text-secondary,#555);
  padding:.5rem 0;
}
</style>"""

# ---------------------------------------------------------------------------
# JS — minimal tab switcher (no library dependency)
# ---------------------------------------------------------------------------
_JS = """<script>
function _eoTab(idx){
  document.querySelectorAll('.eo-sec').forEach(function(s,j){
    s.style.display = j===idx ? '' : 'none';
  });
  document.querySelectorAll('.eo-tab').forEach(function(t,j){
    t.classList.toggle('active', j===idx);
  });
}
</script>"""


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def render_country_outlook(sections: List[SectionOutlook]) -> str:
    """
    Convert a list of SectionOutlook objects into a self-contained HTML string.

    Parameters
    ----------
    sections : list[SectionOutlook]
        Typically the output of ``build_country_exec_outlook()``.

    Returns
    -------
    str
        Complete HTML (CSS + markup + JS) ready for direct embedding.
        Contains no external asset references — safe for Streamlit's sandbox.
    """
    if not sections:
        return (
            "<p style='color:var(--color-text-secondary,#555);font-size:14px'>"
            "No outlook data available for this selection.</p>"
        )

    tabs_html = ""
    panels_html = ""

    for i, s in enumerate(sections):
        label = _TAB_LABELS.get(s.category, s.category)
        active_cls = "active" if i == 0 else ""
        display_style = "" if i == 0 else "display:none"

        tabs_html += (
            f'<button class="eo-tab {active_cls}" onclick="_eoTab({i})"'
            f' aria-label="View {label} outlook">{label}</button>\n'
        )
        panels_html += (
            f'<div class="eo-sec" style="{display_style}">'
            f'{render_section(s)}'
            f'</div>\n'
        )

    return (
        f'{_CSS}\n'
        f'<div style="padding:1rem 0">\n'
        f'  <div class="eo-tabs">{tabs_html}</div>\n'
        f'  {panels_html}\n'
        f'</div>\n'
        f'{_JS}'
    )