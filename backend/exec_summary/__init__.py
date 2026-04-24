"""
exec_summary
============
Package init — exposes the public API for the Executive Outlook feature.
"""
# exec_summary/__init__.py
# Core data model & builder
from exec_summary.executive_outlook_builder import (
    SectionOutlook,
    build_country_exec_outlook,
    classify_band,
    compute_country_and_region_cagr,
    resolve_region_for_country,
)

# LLM bullet generator
from exec_summary.reason_web_engine import (
    generate_exec_outlook_bullets,
    SourceRef,
)

# HTML renderer  ← NEW
from exec_summary.exec_outlook_renderer import (
    render_country_outlook,
    render_section,
)

__all__ = [
    # builder
    "SectionOutlook",
    "build_country_exec_outlook",
    "classify_band",
    "compute_country_and_region_cagr",
    "resolve_region_for_country",
    # engine
    "generate_exec_outlook_bullets",
    "SourceRef",
    # renderer
    "render_country_outlook",
    "render_section",
]

from exec_summary.ux_formatter import (
    normalize_bullets,
    build_takeaway,
    format_quality_message,
)

__all__ += [
    "normalize_bullets",
    "build_takeaway",
    "format_quality_message",
]