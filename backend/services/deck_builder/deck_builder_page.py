# deck_builder/deck_builder_page.py
from __future__ import annotations

import base64
import io
import os
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
import streamlit as st

from stock_prices.company_stock_prices_page import (
    get_company_options_by_country,
    get_stock_price_universe,
)
from deck_builder.dataset_cache import (
    load_ciq_long_df,
    load_excel_with_parquet_cache,
)
from deck_builder.slides.slide_06_company_comparison import (
    CHART_MODE_MAP,
    CHART_MODE_OPTIONS,
    DEFAULT_BAR_TEMPLATE,
    DEFAULT_LINE_TEMPLATE,
    KPI_BY_KEY,
    KPI_BY_LABEL,
    KPI_CATEGORIES,
    ComparisonSlideRequest,
    KpiSelection,
)


PROJECT_ROOT = Path(__file__).resolve().parents[1]
PROFIT_POOL_FILENAME = "Profit_Pool.xlsx"
DEFAULT_COMPANY = "Holcim AG"
SESSION_DF_FLAT = "df_flat"

CIQ_XLSX = PROJECT_ROOT / "TBD_CIQ_Company financials_01282026_final.xlsx"

ALL_COUNTRIES_LABEL = "All countries"
S6_KPI_ROWS_KEY = "_s6_kpi_rows"

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


def inject_css() -> None:
    st.markdown(
        """
        <style>
        .ams-title {
            font-size: 28px;
            font-weight: 800;
            margin: 6px 0 10px 0;
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def _latest_ciq_year(long_df: pd.DataFrame, requested_year: int) -> int:
    try:
        available = sorted(long_df["Year"].dropna().astype(int).unique().tolist())
        candidates = [y for y in available if y <= requested_year]
        return max(candidates) if candidates else max(available)
    except Exception:
        return requested_year


@st.cache_data(show_spinner=False)
def _build_wide_df_cached(
    long_df: pd.DataFrame,
    year: int,
    country_filter: Optional[str] = None,
) -> Optional[pd.DataFrame]:
    actual_year = _latest_ciq_year(long_df, year)

    try:
        from cld import ciq_helpers as ch  # type: ignore

        wide = ch._wide_for_year(long_df, actual_year)
        if wide is None or wide.empty:
            return None

        wide = ch._compute_metrics(wide)
        if wide is None or wide.empty:
            return None

        if (
            country_filter
            and country_filter.strip()
            and country_filter != ALL_COUNTRIES_LABEL
            and "Country" in wide.columns
        ):
            cf = country_filter.strip().lower()
            mask = (
                wide["Country"]
                .astype(str)
                .str.strip()
                .str.lower()
                .str.contains(cf, regex=False, na=False)
            )
            filtered = wide[mask].copy()
            if not filtered.empty:
                wide = filtered

        return wide if not wide.empty else None
    except Exception:
        pass

    try:
        required = {"Year", "Company", "Metric", "Value"}
        if not required.issubset(long_df.columns):
            return None

        sub = long_df[long_df["Year"].astype(int) == actual_year].copy()
        if sub.empty:
            return None

        if (
            country_filter
            and country_filter.strip()
            and country_filter != ALL_COUNTRIES_LABEL
            and "Country" in sub.columns
        ):
            cf = country_filter.strip().lower()
            mask = (
                sub["Country"]
                .astype(str)
                .str.strip()
                .str.lower()
                .str.contains(cf, regex=False, na=False)
            )
            filtered = sub[mask]
            if not filtered.empty:
                sub = filtered

        wide = sub.pivot_table(
            index="Company",
            columns="Metric",
            values="Value",
            aggfunc="first",
        ).reset_index()
        wide.columns.name = None
        return wide if not wide.empty else None
    except Exception:
        return None


def _load_profit_pool_df() -> pd.DataFrame:
    candidates = [
        PROJECT_ROOT / PROFIT_POOL_FILENAME,
        PROJECT_ROOT / "Profit_Pool" / PROFIT_POOL_FILENAME,
    ]
    data_path = next((p for p in candidates if p.exists()), None)
    if data_path is None:
        raise FileNotFoundError(
            f"{PROFIT_POOL_FILENAME} not found. Place it in the project root or in ./Profit_Pool/."
        )

    return load_excel_with_parquet_cache(
        data_path,
        header_row=1,
        cache_stem_suffix="profit_pool",
    )


def _build_filename(country: Optional[str], company: Optional[str]) -> str:
    parts = [p for p in (country, company) if p]
    base = "_".join(parts) + "_Deck" if parts else "Deck"
    return base.replace(" ", "_") + ".pptx"


def _companies_for_country_from_stock_universe(
    country_filter: Optional[str],
    countries_raw: List[str],
) -> List[str]:
    apply_country = bool(country_filter and country_filter.strip() and country_filter != ALL_COUNTRIES_LABEL)

    try:
        if apply_country:
            raw = get_company_options_by_country(country_filter) or []
            return sorted(str(c) for c in raw if str(c).strip())

        agg: List[str] = []
        for ctry in countries_raw:
            raw = get_company_options_by_country(ctry) or []
            agg.extend(str(c) for c in raw if str(c).strip())
        return sorted(set(agg))
    except Exception:
        return []


def _companies_for_country_from_ciq(
    long_df: Optional[pd.DataFrame],
    country_filter: Optional[str],
) -> List[str]:
    if long_df is None or long_df.empty or "Company" not in long_df.columns:
        return []

    df = long_df
    if country_filter and country_filter != ALL_COUNTRIES_LABEL and "Country" in df.columns:
        df = df[df["Country"].astype(str).str.strip() == country_filter.strip()]

    return sorted(df["Company"].dropna().astype(str).unique().tolist())


def _default_kpi_rows() -> List[Dict]:
    first_cat = list(KPI_CATEGORIES.keys())[0]
    first_kpi = KPI_CATEGORIES[first_cat][0]
    return [{"category": first_cat, "kpi_label": first_kpi["label"], "chart_mode_label": "Both"}]


def _get_kpi_rows() -> List[Dict]:
    if S6_KPI_ROWS_KEY not in st.session_state:
        st.session_state[S6_KPI_ROWS_KEY] = _default_kpi_rows()
    return st.session_state[S6_KPI_ROWS_KEY]


def _set_kpi_rows(rows: List[Dict]) -> None:
    st.session_state[S6_KPI_ROWS_KEY] = rows


def render_page() -> None:
    inject_css()
    render_banner()

    st.markdown('<div class="ams-title">Deck Builder</div>', unsafe_allow_html=True)
    st.caption("Generates a PowerPoint deck (Slides 1-5 + optional KPI comparison slides)")

    try:
        from deck_builder.builder import DeckRequest, build_deck
    except Exception as e:
        st.error("Deck builder import failed.")
        st.exception(e)
        return

    df_flat = st.session_state.get(SESSION_DF_FLAT)
    if not isinstance(df_flat, pd.DataFrame) or df_flat.empty:
        st.error(f"Flat file not loaded (`st.session_state['{SESSION_DF_FLAT}']` is missing).")
        st.info("Ensure the main app loads the flat file before opening this page.")
        return

    try:
        df_profit_pool = _load_profit_pool_df()
    except Exception as e:
        st.error("Profit pool dataset failed to load.")
        st.exception(e)
        return

    try:
        uni = get_stock_price_universe()
    except Exception as e:
        st.error("Failed to load stock price universe.")
        st.exception(e)
        return

    years = sorted(int(y) for y in (uni.get("years") or []))
    countries_raw = sorted(str(c) for c in (uni.get("countries") or []) if str(c).strip())
    country_opts = [ALL_COUNTRIES_LABEL] + countries_raw

    if not years:
        st.error("No years found in the stock price dataset.")
        return

    resolved_year = max(years)

    with st.sidebar:
        st.header("How to use")
        st.markdown(
            """
            - Choose **Country** and **Cement company** for the base deck  
            - Turn **Apply filters** on to use the selected country/company across slides  
            - Enable **KPI comparison slides** to add company benchmark charts  
            - Pick one or more **KPIs** and choose **Point-in-time**, **Time series**, or **Both**  
            - Review the expected **slide count** before generating the deck  
            """
        )
        st.divider()
        st.header("Filters")

        selected_country = st.selectbox(
            "Country",
            options=country_opts,
            index=0,
            key="deck_country",
        )
        country_filter: Optional[str] = None if selected_country == ALL_COUNTRIES_LABEL else selected_country

        # Fast base-company dropdown from stock universe only.
        all_companies = _companies_for_country_from_stock_universe(country_filter, countries_raw)
        company_opts = all_companies or ["(None)"]

        if company_opts == ["(None)"]:
            st.warning("No companies found for the selected country.")

        default_idx = company_opts.index(DEFAULT_COMPANY) if DEFAULT_COMPANY in company_opts else 0
        selected_company = st.selectbox(
            "Cement company",
            options=company_opts,
            index=default_idx,
            key="deck_company",
            help="Base company used across all slides.",
        )

        apply_filters = st.checkbox("Apply filters", value=True, key="deck_apply")

    resolved_country = country_filter if apply_filters else None
    resolved_company = selected_company if (apply_filters and selected_company not in ("(None)", "")) else None

    st.markdown("---")
    st.subheader("KPI Comparison Slides (optional)")

    include_s6 = st.checkbox(
        "Include KPI comparison slides",
        value=False,
        key="s6_include",
    )

    comparison_request: Optional[ComparisonSlideRequest] = None
    long_df: Optional[pd.DataFrame] = None
    ciq_status_icon = "ℹ️"
    ciq_status_msg = "CIQ data is loaded only when KPI comparison slides are enabled."

    if include_s6:
        if CIQ_XLSX.exists():
            long_df = load_ciq_long_df(CIQ_XLSX)
            if long_df is not None and not long_df.empty:
                ciq_status_icon = "✅"
                ciq_status_msg = f"CIQ data ready ({len(long_df):,} rows). Loaded from cache when available."
            else:
                ciq_status_icon = "⚠️"
                ciq_status_msg = "CIQ file found but failed to load — KPI slides unavailable."
        else:
            ciq_status_icon = "⚠️"
            ciq_status_msg = f"CIQ file not found ({CIQ_XLSX.name}) — KPI slides unavailable."

    st.caption(f"{ciq_status_icon} {ciq_status_msg}")

    slide6_available = include_s6 and long_df is not None and not long_df.empty

    if slide6_available:
        ciq_companies = _companies_for_country_from_ciq(long_df, country_filter)
        peer_source_companies = ciq_companies or all_companies
        peer_opts = [c for c in peer_source_companies if c != selected_company]

        if not peer_opts:
            st.warning("No peer companies available for the selected country.")
        else:
            cache_key = f"_s6_peers__{selected_country}__{selected_company}"
            if cache_key not in st.session_state:
                st.session_state[cache_key] = peer_opts[:5]

            valid_defaults = [p for p in st.session_state[cache_key] if p in peer_opts]

            peer_companies: List[str] = st.multiselect(
                "Peer companies",
                options=peer_opts,
                default=valid_defaults,
                key="s6_peers",
                help="Select companies to compare against the base company.",
            )
            st.session_state[cache_key] = list(peer_companies)

            year_range_start: int = st.number_input(
                "Time-series start year  (applies to all line charts)",
                min_value=2000,
                max_value=resolved_year - 1,
                value=2010,
                step=1,
                key="s6_year_start",
            )

            st.markdown("---")
            st.markdown("#### KPIs to include")
            st.caption(
                "Each row = one KPI. 'Both' generates a bar chart and a line chart. "
                "You can mix KPIs from different categories."
            )

            hcols = st.columns([2, 3, 2, 0.6])
            hcols[0].markdown("**Category**")
            hcols[1].markdown("**KPI**")
            hcols[2].markdown("**Chart type**")
            hcols[3].markdown("")

            kpi_rows = _get_kpi_rows()
            updated_rows: List[Dict] = []
            rows_to_delete: List[int] = []

            for i, row in enumerate(kpi_rows):
                cols = st.columns([2, 3, 2, 0.6])

                with cols[0]:
                    cat_options = list(KPI_CATEGORIES.keys())
                    cat_idx = cat_options.index(row["category"]) if row["category"] in cat_options else 0
                    new_cat = st.selectbox(
                        f"cat_{i}",
                        options=cat_options,
                        index=cat_idx,
                        key=f"s6_row_cat_{i}",
                        label_visibility="collapsed",
                    )

                with cols[1]:
                    kpi_opts_in_cat = [k["label"] for k in KPI_CATEGORIES.get(new_cat, [])]
                    cur_kpi = (
                        row["kpi_label"]
                        if (new_cat == row["category"] and row["kpi_label"] in kpi_opts_in_cat)
                        else kpi_opts_in_cat[0]
                    )
                    kpi_idx = kpi_opts_in_cat.index(cur_kpi) if cur_kpi in kpi_opts_in_cat else 0
                    new_kpi_label = st.selectbox(
                        f"kpi_{i}",
                        options=kpi_opts_in_cat,
                        index=kpi_idx,
                        key=f"s6_row_kpi_{i}",
                        label_visibility="collapsed",
                    )

                with cols[2]:
                    mode_idx = (
                        CHART_MODE_OPTIONS.index(row["chart_mode_label"])
                        if row["chart_mode_label"] in CHART_MODE_OPTIONS
                        else 2
                    )
                    new_mode_label = st.selectbox(
                        f"mode_{i}",
                        options=CHART_MODE_OPTIONS,
                        index=mode_idx,
                        key=f"s6_row_mode_{i}",
                        label_visibility="collapsed",
                    )

                with cols[3]:
                    if st.button("✕", key=f"s6_row_del_{i}", help="Remove this row"):
                        rows_to_delete.append(i)

                updated_rows.append(
                    {
                        "category": new_cat,
                        "kpi_label": new_kpi_label,
                        "chart_mode_label": new_mode_label,
                    }
                )

            if rows_to_delete:
                updated_rows = [r for idx, r in enumerate(updated_rows) if idx not in rows_to_delete]
                if not updated_rows:
                    updated_rows = _default_kpi_rows()
                _set_kpi_rows(updated_rows)
                st.rerun()
            else:
                _set_kpi_rows(updated_rows)

            btn_cols = st.columns([1, 1, 4])
            with btn_cols[0]:
                if st.button("+ Add KPI", key="s6_add_row"):
                    current = _get_kpi_rows()
                    used_cats = {r["category"] for r in current}
                    unused = [c for c in KPI_CATEGORIES if c not in used_cats]
                    next_cat = unused[0] if unused else list(KPI_CATEGORIES.keys())[0]
                    next_kpi = KPI_CATEGORIES[next_cat][0]["label"]
                    current.append(
                        {
                            "category": next_cat,
                            "kpi_label": next_kpi,
                            "chart_mode_label": "Both",
                        }
                    )
                    _set_kpi_rows(current)
                    st.rerun()

            with btn_cols[1]:
                if st.button(
                    "Reset",
                    key="s6_reset_rows",
                    help="Clear all rows and reset to one default KPI",
                ):
                    _set_kpi_rows(_default_kpi_rows())
                    st.rerun()

            final_rows = _get_kpi_rows()
            kpi_selections: List[KpiSelection] = []
            seen_keys: set[str] = set()

            for row in final_rows:
                kpi_def = KPI_BY_LABEL.get(row["kpi_label"])
                if kpi_def is None:
                    continue
                key = kpi_def["key"]
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                chart_mode = CHART_MODE_MAP.get(row["chart_mode_label"], "both")
                kpi_selections.append(KpiSelection(kpi_key=key, chart_mode=chart_mode))

            if kpi_selections and peer_companies:
                n_kpi_slides = sum(s.slides_count() for s in kpi_selections)
                total_slides = 5 + n_kpi_slides

                needs_bar = any(s.chart_mode in ("point_in_time", "both") for s in kpi_selections)

                wide_for_s6: Optional[pd.DataFrame] = None
                wide_year_used: Optional[int] = None
                if needs_bar:
                    wide_year_used = _latest_ciq_year(long_df, resolved_year)
                    wide_for_s6 = _build_wide_df_cached(long_df, wide_year_used, country_filter)

                comparison_request = ComparisonSlideRequest(
                    base_company=selected_company,
                    peer_companies=list(peer_companies),
                    kpi_selections=kpi_selections,
                    year=wide_year_used or resolved_year,
                    wide_df=wide_for_s6,
                    long_df=long_df,
                    bar_template_path=DEFAULT_BAR_TEMPLATE,
                    line_template_path=DEFAULT_LINE_TEMPLATE,
                    country=country_filter,
                    year_range_start=int(year_range_start),
                )

                st.markdown("---")
                mc1, mc2, mc3 = st.columns(3)
                mc1.metric("KPIs selected", len(kpi_selections))
                mc2.metric("KPI slides", n_kpi_slides)
                mc3.metric("Total slides in deck", total_slides)

                long_ok = f"✅ {len(long_df):,} rows"
                if not needs_bar:
                    wide_ok = "— (no bar charts)"
                elif wide_for_s6 is not None:
                    wide_ok = f"✅ {len(wide_for_s6):,} rows (FY{wide_year_used})"
                else:
                    wide_ok = f"⚠️ failed to build for FY{wide_year_used} — bar charts may be empty"

                st.caption(f"long_df: {long_ok}  |  wide_df: {wide_ok}")
            elif not peer_companies:
                st.info("Select at least one peer company above to enable KPI slides.")
            else:
                st.info("Add at least one KPI row above.")

    st.markdown("---")
    with st.expander("Current selections", expanded=False):
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**Slides 1-5**")
            st.markdown(
                f"- Country: `{resolved_country or 'All'}`\n"
                f"- Company: `{resolved_company or 'None'}`\n"
                f"- Year: `{resolved_year}`"
            )
        with c2:
            if comparison_request is not None and comparison_request.kpi_selections:
                st.markdown("**KPI Comparison Slides**")
                st.markdown(
                    f"- Base: `{comparison_request.base_company}`\n"
                    f"- Peers: `{len(comparison_request.peer_companies)} selected`\n"
                    f"- Year range: `{comparison_request.year_range_start}-{comparison_request.year}`"
                )
                for sel in comparison_request.kpi_selections:
                    st.markdown(f"  - `{sel.label}` ({sel.category}) → {sel.chart_mode_label}")
            else:
                st.markdown("**KPI Comparison Slides:** _not included_")

    req = DeckRequest(
        country=resolved_country,
        company=resolved_company,
        year=resolved_year,
        df_flat=df_flat,
        df_profit_pool=df_profit_pool,
        comparison_request=comparison_request,
    )

    has_kpi = comparison_request is not None and bool(comparison_request.kpi_selections)
    n_base = 5
    n_kpi = sum(s.slides_count() for s in comparison_request.kpi_selections) if has_kpi else 0
    btn_label = f"Generate PPT ({n_base + n_kpi} slide{'s' if n_base + n_kpi != 1 else ''})"

    if st.button(btn_label, type="primary"):
        with st.spinner("Building deck..."):
            try:
                prs = build_deck(req)
            except Exception as e:
                st.error("Deck generation failed.")
                st.exception(e)
                return

        actual_count = len(prs.slides)
        buf = io.BytesIO()
        prs.save(buf)

        st.success(f"Deck ready — {actual_count} slide(s).")
        st.download_button(
            label="Download PPTX",
            data=buf.getvalue(),
            file_name=_build_filename(resolved_country, resolved_company),
            mime="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        )

        if has_kpi:
            with st.expander("KPI slides — data preview", expanded=False):
                st.markdown(
                    f"**Base:** {comparison_request.base_company}  |  "
                    f"**Peers:** {', '.join(comparison_request.peer_companies)}  |  "
                    f"**FY:** {comparison_request.year}"
                )
                for sel in comparison_request.kpi_selections:
                    kpi = KPI_BY_KEY.get(sel.kpi_key, {})
                    value_col = kpi.get("value_col", "")
                    st.markdown(
                        f"**{sel.label}** &nbsp;·&nbsp; {sel.category} &nbsp;·&nbsp; {sel.chart_mode_label}"
                    )
                    wide = comparison_request.wide_df
                    if (
                        sel.chart_mode in ("point_in_time", "both")
                        and wide is not None
                        and value_col in wide.columns
                    ):
                        all_cos = [comparison_request.base_company] + comparison_request.peer_companies
                        preview = (
                            wide[wide["Company"].isin(all_cos)][["Company", value_col]]
                            .rename(columns={value_col: sel.label})
                            .sort_values(sel.label, ascending=False)
                            .reset_index(drop=True)
                        )
                        st.dataframe(preview, use_container_width=True)
                    else:
                        st.caption(
                            "Point-in-time snapshot not available (time-series only mode, or value column absent)."
                        )
                    st.divider()