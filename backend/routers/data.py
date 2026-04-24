"""
routers/data.py
All /data/* endpoints - flat file, CIQ, profit pool, geomap,
global cement, stock prices.
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from models.data import (
    GeoMapRequest,
    GlobalCementRequest,
    GrowthRequest,
    KpiRequest,
    MekkoRequest,
    ProfitPoolRequest,
    StockPriceRequest,
)
from services import (
    ciq_loader as ciq,
    flat_file_loader as ff,
    geomap_loader as geo,
    global_cement_loader as gcm,
    profit_pool_loader as pp,
    stock_price_loader as sp,
)
from services.cache_utils import ResponseCache

router = APIRouter()

_chart_cache = ResponseCache(maxsize=256, ttl_seconds=1800)


def _cached(prefix: str, payload, fn):
    key = ResponseCache.make_key(prefix, payload)
    return _chart_cache.get_or_set(key, fn)


def clear_chart_cache() -> None:
    _chart_cache.clear()


@router.get("/flat-file/meta")
@functools.lru_cache(maxsize=1)
def flat_file_meta():
    """Categories, years and KPI columns available in the flat file."""
    df = ff.get_flat_file_df()
    return {
        "categories": ff.get_categories(df),
        "years": ff.get_year_columns(df),
        "kpi_cols": ff.get_kpi_columns(df),
    }


@router.get("/flat-file/regions")
def flat_file_regions(category: Optional[str] = Query(None)):
    df = ff.get_flat_file_df()
    return {"regions": ff.get_regions(df, category)}


@router.get("/flat-file/countries")
def flat_file_countries(
    category: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
):
    df = ff.get_flat_file_df()
    return {"countries": ff.get_countries(df, category, region)}


@router.post("/flat-file/mekko")
def flat_file_mekko(req: MekkoRequest):
    """Mekko chart data for Market Intelligence pages."""

    def _compute():
        df = ff.get_flat_file_df()
        data = ff.get_mekko_data(df, req.category, req.year, req.top_n, req.show_other, req.kpi_filters)
        unit = ff.get_unit(df, req.category)
        return {"data": data, "year": req.year, "category": req.category, "unit": unit}

    return _cached("flat_file_mekko", req.model_dump(mode="json"), _compute)


@router.post("/flat-file/growth")
def flat_file_growth(req: GrowthRequest):
    """Growth view data (YoY + revenue + CAGR) for Market Intelligence pages."""

    def _compute():
        df = ff.get_flat_file_df()
        return ff.get_growth_data(
            df,
            req.category,
            req.region,
            req.country,
            req.year_min,
            req.year_max,
            req.kpi_filters,
        )

    return _cached("flat_file_growth", req.model_dump(mode="json"), _compute)


@router.get("/ciq/meta")
@functools.lru_cache(maxsize=1)
def ciq_meta():
    """Companies, countries, years available in the CIQ export."""
    try:
        long = ciq.get_ciq_long_df()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {
        "companies": ciq.get_companies(long),
        "countries": ciq.get_countries_ciq(long),
        "years": ciq.get_available_years(long),
    }


@router.get("/ciq/companies")
def ciq_companies(country: Optional[str] = Query(None)):
    long = ciq.get_ciq_long_df()
    return {"companies": ciq.get_companies(long, country)}


@router.post("/ciq/kpis")
def ciq_kpis(req: KpiRequest):
    """
    KPI data for the KPI diagnosis page.
    Returns point-in-time snapshot and/or time-series depending on chart_mode.
    """

    def _compute():
        try:
            long = ciq.get_ciq_long_df()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        result: dict = {"kpi_key": req.kpi_key, "year": req.year}

        if req.chart_mode in ("point_in_time", "both"):
            df = ciq.get_ciq_metrics_df_for_year(req.year).copy()
            if not df.empty:
                df = df[df["Company"].isin(req.companies)].copy()
                if req.country and req.country != "All" and "Country" in df.columns:
                    df = df[df["Country"] == req.country]
                all_cols = [c for c in df.columns if c != "CIQ_ID"]
                export_df = df[all_cols].copy()

                import math

                def _safe(v):
                    if v is None:
                        return None
                    try:
                        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                            return None
                        return v
                    except Exception:
                        return None

                result["point_in_time"] = [
                    {k: _safe(row[k]) for k in row}
                    for row in export_df.to_dict(orient="records")
                ]

        if req.chart_mode in ("time_series", "both"):
            years = [y for y in ciq.get_available_years(long) if req.year_range_start <= y <= req.year]
            kpi_value_col_map = {
                "revenue": "_Revenue",
                "ebitda": "_EBITDA",
                "ebitda_margin": "EBITDA margin",
                "yoy_ebitda": "YoY Growth",
                "market_cap": "Market capitalization ($ mn)",
                "enterprise_value": "Enterprise value ($ mn)",
                "roic": "ROIC (%)",
                "roce": "ROCE (%)",
                "roa": "ROA (%)",
                "asset_turnover": "Asset turnover",
                "net_debt": "Net debt ($ mn)",
                "net_debt_ebitda": "Net debt / EBITDA",
                "debt_to_equity": "Debt-to-equity",
                "pct_short_term": "% short-term debt",
                "pct_short_term_debt": "% short-term debt",
                "opcf": "Operating cash flow ($ mn)",
                "fcf": "Free cash flow ($ mn)",
                "fcf_ebitda": "FCF / EBITDA",
                "ev_ebitda": "EV / EBITDA",
                "pe": "P/E",
                "fte": "Full-time employees",
                "ebitda_per_fte": "EBITDA per Employee (USD '000)",
                "revenue_per_fte": "Revenue per Employee (USD '000)",
                "opcf_per_fte": "Operating Cash Flow per Employee (USD '000)",
                "net_ppe_per_fte": "Net PP&E per Employee (USD '000)",
                "labor_intensity": "Labor intensity (FTE per $ mn revenue)",
            }
            ts_col = kpi_value_col_map.get(req.kpi_key, req.kpi_key)
            result["time_series"] = ciq.build_timeseries(long, years, req.companies, ts_col, req.country)

        return result

    return _cached("ciq_kpis", req.model_dump(mode="json"), _compute)


@router.post("/ciq/yoy-growth")
def ciq_yoy_growth(year: int, companies: List[str], metric: str = "EBITDA ($ mn)"):
    long = ciq.get_ciq_long_df()
    df = ciq.compute_yoy_growth(long, metric, year)
    df = df[df["Company"].isin(companies)]
    return {"data": df.to_dict(orient="records")}


@router.get("/profit-pool/meta")
@functools.lru_cache(maxsize=1)
def profit_pool_meta():
    df = pp.get_profit_pool_df()
    return {
        "years": pp.get_available_profit_pool_years(df),
        "regions": pp.get_profit_pool_regions(df),
        "countries": pp.get_profit_pool_countries(df),
    }


@router.get("/profit-pool/countries")
def profit_pool_countries(regions: Optional[List[str]] = Query(None)):
    df = pp.get_profit_pool_df()
    return {"countries": pp.get_profit_pool_countries(df, regions)}


@router.post("/profit-pool/chart")
def profit_pool_chart(req: ProfitPoolRequest):
    def _compute():
        df = pp.get_profit_pool_df()
        data = pp.compute_profit_pool_view(df, req.year, req.selected_regions, req.selected_countries)
        return {"data": data, "year": req.year}

    return _cached("profit_pool_chart", req.model_dump(mode="json"), _compute)


@router.get("/geomap/meta")
@functools.lru_cache(maxsize=1)
def geomap_meta():
    df = geo.get_geomap_df()
    cap_min, cap_max = geo.get_capacity_range(df)
    return {
        "companies": geo.get_all_companies(df),
        "cap_min": cap_min,
        "cap_max": cap_max,
        "us_regions": sorted(df["us_region"].dropna().unique().tolist()),
        "states": sorted(df["state"].dropna().unique().tolist()),
        "cement_types": sorted(df["cement_type"].dropna().unique().tolist()),
        "statuses": sorted(df["status"].dropna().unique().tolist()),
    }


@router.post("/geomap/plants")
def geomap_plants(req: GeoMapRequest):
    def _compute():
        df = geo.get_geomap_df()
        filtered = geo.filter_plants(
            df,
            companies=req.companies,
            cap_min=req.cap_min,
            cap_max=req.cap_max,
            status=req.status,
            cement_type=req.cement_type,
            us_region=req.us_region,
        )
        return {
            "plants": geo.get_plants_geojson(filtered),
            "total": len(df),
            "filtered": len(filtered),
        }

    return _cached("geomap_plants", req.model_dump(mode="json"), _compute)


@router.post("/geomap/mekko")
def geomap_mekko(req: GeoMapRequest):
    def _compute():
        df = geo.get_geomap_df()
        filtered = geo.filter_plants(
            df,
            companies=req.companies,
            status=req.status,
            cement_type=req.cement_type,
            us_region=req.us_region,
        )
        return {"data": geo.build_mekko_data(filtered, req.top_n_state, req.state_share_cutoff)}

    return _cached("geomap_mekko", req.model_dump(mode="json"), _compute)


@router.get("/global-cement/meta")
@functools.lru_cache(maxsize=1)
def global_cement_meta():
    df = gcm.get_global_cement_df()
    return {
        "kpis": gcm.get_available_kpis(df),
        "countries": gcm.get_available_countries(df),
        "years": gcm.get_available_years_gcm(df),
    }


@router.post("/global-cement/chart")
def global_cement_chart(req: GlobalCementRequest):
    def _compute():
        df = gcm.get_global_cement_df()
        effective_req = req
        if effective_req.view == "time_series":
            data = gcm.get_timeseries_data(df, effective_req.kpi, effective_req.countries)
        else:
            if effective_req.year is None:
                years = gcm.get_available_years_gcm(df)
                effective_req = effective_req.model_copy(update={"year": max(years)})
            data = gcm.get_point_in_time_data(df, effective_req.kpi, effective_req.countries, effective_req.year)
        cagr = gcm.compute_cagr_table(df, effective_req.kpi, effective_req.countries)
        return {"data": data, "cagr": cagr, "kpi": effective_req.kpi, "view": effective_req.view}

    return _cached("global_cement_chart", req.model_dump(mode="json"), _compute)

class CementDemandRequest(BaseModel):
    country:    str
    kpi:        str   = "Consumption (Mt)"
    year_min:   int   = 2005
    year_max:   int   = 2029
    cutoff_year:int   = 2024


@router.post("/cement-demand/growth")
def cement_demand_growth(req: CementDemandRequest):
    """
    Return GrowthData-shaped payload (years, revenue→demand, yoy, cagr)
    from global_cement_metrics.xlsx for a single country + KPI.
    """
    import pandas as _pd
    df = gcm.get_global_cement_df()

    # Filter to country + kpi
    sub = df[
        (df["Country"].astype(str).str.strip().str.casefold() == req.country.strip().casefold()) &
        (df["KPI"].astype(str).str.strip() == req.kpi.strip())
    ].copy()

    sub = sub.dropna(subset=["Value"]).copy()
    sub["Year"]  = sub["Year"].astype(int)
    sub["Value"] = _pd.to_numeric(sub["Value"], errors="coerce")
    sub = sub[(sub["Year"] >= req.year_min) & (sub["Year"] <= req.year_max)]
    sub = sub.sort_values("Year")

    if sub.empty:
        return {"years": [], "revenue": {}, "yoy": {}, "cagr": [], "cutoff_year": req.cutoff_year}

    years  = sub["Year"].tolist()
    values = dict(zip(sub["Year"].astype(str), sub["Value"]))

    # Compute YoY
    yoy: dict = {}
    for i, yr in enumerate(years):
        if i == 0:
            yoy[str(yr)] = None
            continue
        prev_v = values.get(str(years[i - 1]))
        cur_v  = values.get(str(yr))
        if prev_v and prev_v > 0 and cur_v is not None:
            yoy[str(yr)] = (cur_v / prev_v) - 1.0
        else:
            yoy[str(yr)] = None

    # CAGR periods
    def _cagr_val(y1: int, y2: int) -> float | None:
        v1 = values.get(str(y1))
        v2 = values.get(str(y2))
        if v1 and v2 and v1 > 0 and v2 > 0 and y2 > y1:
            return (v2 / v1) ** (1.0 / (y2 - y1)) - 1.0
        return None

    cagr = []
    for p_start, p_end in [(2012, 2019), (2020, req.cutoff_year)]:
        if p_start in years and p_end in years:
            cagr.append({
                "period": f"{p_start}–{p_end}",
                "start":   values.get(str(p_start)),
                "end":     values.get(str(p_end)),
                "cagr":    _cagr_val(p_start, p_end),
                "country": req.country,
            })

    return {
        "years":       years,
        "revenue":     values,   # named "revenue" to reuse GrowthData type (actual = demand)
        "yoy":         yoy,
        "cagr":        cagr,
        "cutoff_year": req.cutoff_year,
        "kpi":         req.kpi,
        "unit":        req.kpi,
    }


@router.get("/cement-demand/meta")
@functools.lru_cache(maxsize=1)
def cement_demand_meta():
    """Countries and KPIs available for cement demand chart."""
    df = gcm.get_global_cement_df()
    return {
        "countries": gcm.get_available_countries(df),
        "kpis":      gcm.get_available_kpis(df),
    }

@router.get("/stock-prices/meta")
@functools.lru_cache(maxsize=1)
def stock_prices_meta():
    df = sp.get_stock_prices_df()
    return {
        "years": sp.get_stock_years(df),
        "countries": sp.get_stock_countries(df),
        "companies": sp.get_stock_companies(df),
    }


@router.get("/stock-prices/companies")
def stock_prices_companies(country: Optional[str] = Query(None)):
    df = sp.get_stock_prices_df()
    return {"companies": sp.get_stock_companies(df, country)}


@router.post("/stock-prices/chart")
def stock_prices_chart(req: StockPriceRequest):
    def _compute():
        df = sp.get_stock_prices_df()
        start_year = req.end_year - req.window_years
        return sp.get_indexed_price_data(df, req.companies, start_year, req.end_year, req.country)

    return _cached("stock_prices_chart", req.model_dump(mode="json"), _compute)
