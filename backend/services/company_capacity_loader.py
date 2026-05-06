"""
services/company_capacity_loader.py
Aggregates GEM tracker data by company (owner) for the Company Capacity page.
"""
from __future__ import annotations

import re
import pandas as pd

_CAP_COL     = "Cement Capacity (millions metric tonnes per annum)"
_COUNTRY_COL = "Country/Area"
_OWNER_COL   = "Owner name (English)"
_STATUS_COL  = "Operating status"


def _parse_owner(raw: str) -> str:
    if not raw or str(raw).strip().lower() in ("nan", "n/a", "unknown", ""):
        return "Unknown"
    first = str(raw).split(";")[0].strip()
    first = re.sub(r"\s*\[\d+\.?\d*%?\]", "", first).strip()
    return first or "Unknown"


def get_companies(df: pd.DataFrame) -> list[str]:
    df2 = df.copy()
    df2["_owner"] = df2[_OWNER_COL].apply(_parse_owner)
    return sorted(df2["_owner"].dropna().unique().tolist())


def compute_company_capacity(
    df: pd.DataFrame,
    statuses: list[str] | None = None,
    countries: list[str] | None = None,
    top_n: int = 20,
    min_capacity: float = 0.0,
) -> list[dict]:
    fdf = df.copy()

    if statuses:
        fdf = fdf[fdf[_STATUS_COL].astype(str).str.strip().str.lower().isin([s.lower() for s in statuses])]
    if countries:
        fdf = fdf[fdf[_COUNTRY_COL].isin(countries)]

    fdf = fdf.dropna(subset=[_CAP_COL])
    fdf[_CAP_COL] = pd.to_numeric(fdf[_CAP_COL], errors="coerce")
    fdf = fdf[fdf[_CAP_COL] > 0]
    fdf["_owner"] = fdf[_OWNER_COL].apply(_parse_owner)

    grp = (
        fdf.groupby("_owner")
        .agg(
            total_capacity=(_CAP_COL, "sum"),
            plant_count=(_CAP_COL, "count"),
        )
        .reset_index()
        .rename(columns={"_owner": "company"})
    )

    # Countries per company
    country_map = (
        fdf.groupby("_owner")[_COUNTRY_COL]
        .apply(lambda x: sorted(x.dropna().unique().tolist()))
        .to_dict()
    )

    grp["total_capacity"] = grp["total_capacity"].round(2)
    grp["countries"] = grp["company"].map(country_map)

    if min_capacity > 0:
        grp = grp[grp["total_capacity"] >= min_capacity]

    grp = grp.sort_values("total_capacity", ascending=False).head(top_n)

    total_all = grp["total_capacity"].sum()
    rows = []
    for i, (_, row) in enumerate(grp.iterrows()):
        rows.append({
            "rank":          i + 1,
            "company":       row["company"],
            "total_capacity": float(row["total_capacity"]),
            "plant_count":   int(row["plant_count"]),
            "market_share":  round(float(row["total_capacity"]) / total_all * 100, 1) if total_all > 0 else 0,
            "countries":     row["countries"] if isinstance(row["countries"], list) else [],
            "country_count": len(row["countries"]) if isinstance(row["countries"], list) else 0,
        })
    return rows


def compute_company_country_breakdown(
    df: pd.DataFrame,
    company: str,
    statuses: list[str] | None = None,
) -> list[dict]:
    fdf = df.copy()
    fdf["_owner"] = fdf[_OWNER_COL].apply(_parse_owner)
    fdf = fdf[fdf["_owner"] == company]
    if statuses:
        fdf = fdf[fdf[_STATUS_COL].astype(str).str.strip().str.lower().isin([s.lower() for s in statuses])]
    fdf = fdf.dropna(subset=[_CAP_COL])
    fdf[_CAP_COL] = pd.to_numeric(fdf[_CAP_COL], errors="coerce")
    fdf = fdf[fdf[_CAP_COL] > 0]
    grp = (
        fdf.groupby(_COUNTRY_COL)
        .agg(capacity=(_CAP_COL, "sum"), plants=(_CAP_COL, "count"))
        .reset_index()
        .rename(columns={_COUNTRY_COL: "country"})
        .sort_values("capacity", ascending=False)
    )
    return [
        {"country": r["country"], "capacity": round(float(r["capacity"]), 2), "plants": int(r["plants"])}
        for _, r in grp.iterrows()
    ]