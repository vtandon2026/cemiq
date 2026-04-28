"""
routers/world_view.py
Endpoints for the Construction Detail — World View Map page.
  GET  /world-view/meta
  POST /world-view/choropleth   (View 1 — country-level aggregated values)
  POST /world-view/bubble       (View 2 — country bubbles by value)
"""
from __future__ import annotations

import functools
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class ChoroplethRequest(BaseModel):
    year:       int
    segment:    Optional[str] = None
    new_ren:    Optional[str] = None
    source:     Optional[str] = None
    metric:     str           = "total_value"   # "total_value" | "yoy_growth"


class BubbleRequest(BaseModel):
    year:       int
    segment:    Optional[str] = None
    new_ren:    Optional[str] = None
    source:     Optional[str] = None
    top_n:      int           = 100


@router.get("/meta")
@functools.lru_cache(maxsize=1)
def world_view_meta():
    """Regions, segments, new/ren values, sources and years from Construction Detail data."""
    try:
        from services.construction_detail_loader import (
            get_construction_detail_df,
            get_regions,
            get_segments,
            get_new_ren_values,
            get_sources,
            get_year_columns,
        )
        df = get_construction_detail_df()
        return {
            "regions":  get_regions(df),
            "segments": get_segments(df),
            "new_ren":  get_new_ren_values(df),
            "sources":  get_sources(df),
            "years":    get_year_columns(df),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/choropleth")
def world_view_choropleth(req: ChoroplethRequest):
    """
    View 1 — Country-level aggregated value for a given year.
    Returns [{country, region, value, yoy_growth}] suitable for a choropleth map.
    """
    try:
        import pandas as pd
        from services.construction_detail_loader import get_construction_detail_df

        df = get_construction_detail_df()

        base = df.copy()
        if req.segment and req.segment != "All":
            base = base[base["Segment"].astype(str) == req.segment]
        if req.new_ren and req.new_ren != "All":
            base = base[base["New/Ren"].astype(str) == req.new_ren]
        if req.source and req.source != "All":
            base = base[base["Source"].astype(str) == req.source]

        year_col  = str(req.year)
        prev_col  = str(req.year - 1)

        if year_col not in base.columns:
            return {"data": []}

        base[year_col] = pd.to_numeric(base[year_col], errors="coerce")
        agg = (
            base.groupby(["Country", "Region"], as_index=False)[year_col]
            .sum()
            .rename(columns={year_col: "value"})
        )

        # YoY growth
        # Compute weighted avg CAGR per country using source weights
        # GlobalData=1, IHS=2, Euroconstruct=2
        source_weights = {"globaldata": 1.0, "ihs": 2.0, "euroconstruct": 2.0}

        # Find forecast period end year (year + 4 or last available)
        from services.construction_detail_loader import get_year_columns
        all_years = get_year_columns(base)
        forecast_end = min(req.year + 4, max(all_years)) if all_years else req.year

        def weighted_cagr_for_country(country_df: pd.DataFrame) -> float | None:
            total_w, weighted_sum = 0.0, 0.0
            y_s, y_e, n = str(req.year), str(forecast_end), forecast_end - req.year
            if "Source" in country_df.columns:
                for src_key, weight in source_weights.items():
                    src_df = country_df[
                        country_df["Source"].astype(str).str.lower().str.contains(src_key, na=False)
                    ]
                    if src_df.empty or y_s not in src_df.columns or y_e not in src_df.columns:
                        continue
                    vs = pd.to_numeric(src_df[y_s], errors="coerce").sum()
                    ve = pd.to_numeric(src_df[y_e], errors="coerce").sum()
                    if vs > 0 and ve > 0 and n > 0:
                        weighted_sum += ((ve / vs) ** (1.0 / n) - 1.0) * weight
                        total_w += weight
            # Fallback: use total if no source match
            if total_w == 0 and y_s in country_df.columns and y_e in country_df.columns:
                vs = pd.to_numeric(country_df[y_s], errors="coerce").sum()
                ve = pd.to_numeric(country_df[y_e], errors="coerce").sum()
                if vs > 0 and ve > 0 and n > 0:
                    return (ve / vs) ** (1.0 / n) - 1.0
            return (weighted_sum / total_w) if total_w > 0 else None

        rows_out = []
        for (country, region), grp in base.groupby(["Country", "Region"]):
            val = pd.to_numeric(grp[year_col], errors="coerce").sum()
            if pd.isna(val) or val <= 0:
                continue
            wcagr = weighted_cagr_for_country(grp)
            rows_out.append({
                "country": country, "region": region,
                "value": round(float(val), 4),
                "yoy_growth": round(float(wcagr), 6) if wcagr is not None else None,
            })

        return {"data": rows_out, "year": req.year, "metric": req.metric}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bubble")
def world_view_bubble(req: BubbleRequest):
    """
    View 2 — Top N countries by value as bubble data.
    Returns [{country, region, value, yoy_growth, rank}].
    """
    try:
        import pandas as pd
        from services.construction_detail_loader import get_construction_detail_df

        df = get_construction_detail_df()

        base = df.copy()
        if req.segment and req.segment != "All":
            base = base[base["Segment"].astype(str) == req.segment]
        if req.new_ren and req.new_ren != "All":
            base = base[base["New/Ren"].astype(str) == req.new_ren]
        if req.source and req.source != "All":
            base = base[base["Source"].astype(str) == req.source]

        year_col = str(req.year)
        prev_col = str(req.year - 1)

        if year_col not in base.columns:
            return {"data": []}

        base[year_col] = pd.to_numeric(base[year_col], errors="coerce")
        agg = (
            base.groupby(["Country", "Region"], as_index=False)[year_col]
            .sum()
            .rename(columns={year_col: "value"})
        )

        # Weighted avg CAGR per country
        source_weights = {"globaldata": 1.0, "ihs": 2.0, "euroconstruct": 2.0}
        from services.construction_detail_loader import get_year_columns
        all_years = get_year_columns(base)
        forecast_end = min(req.year + 4, max(all_years)) if all_years else req.year

        rows_out = []
        for (country, region), grp in base.groupby(["Country", "Region"]):
            val = pd.to_numeric(grp[year_col], errors="coerce").sum()
            if pd.isna(val) or val <= 0:
                continue

            total_w, weighted_sum = 0.0, 0.0
            if "Source" in grp.columns:
                for src_key, weight in source_weights.items():
                    src_df = grp[grp["Source"].astype(str).str.lower().str.contains(src_key, na=False)]
                    if src_df.empty:
                        continue
                    y_s, y_e = str(req.year), str(forecast_end)
                    if y_s not in src_df.columns or y_e not in src_df.columns:
                        continue
                    vs = pd.to_numeric(src_df[y_s], errors="coerce").sum()
                    ve = pd.to_numeric(src_df[y_e], errors="coerce").sum()
                    n  = forecast_end - req.year
                    if vs > 0 and ve > 0 and n > 0:
                        cagr = (ve / vs) ** (1.0 / n) - 1.0
                        weighted_sum += cagr * weight
                        total_w += weight

            # Fallback: if no source-specific CAGR, compute from total
            if total_w == 0:
                y_s, y_e = str(req.year), str(forecast_end)
                if y_s in grp.columns and y_e in grp.columns:
                    vs = pd.to_numeric(grp[y_s], errors="coerce").sum()
                    ve = pd.to_numeric(grp[y_e], errors="coerce").sum()
                    n  = forecast_end - req.year
                    if vs > 0 and ve > 0 and n > 0:
                        weighted_sum = (ve / vs) ** (1.0 / n) - 1.0
                        total_w = 1.0

            wcagr = (weighted_sum / total_w) if total_w > 0 else None
            rows_out.append({
                "country": country, "region": region,
                "value": round(float(val), 4),
                "yoy_growth": round(float(wcagr), 6) if wcagr is not None else None,
            })

        rows_out.sort(key=lambda x: x["value"], reverse=True)
        rows_out = rows_out[:req.top_n]
        for i, r in enumerate(rows_out):
            r["rank"] = i + 1

        return {"data": rows_out, "year": req.year}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))