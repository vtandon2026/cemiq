# services/cement_capacity_loader.py
"""
Loads and processes Global-Cement-and-Concrete-Tracker_July-2025.xlsx
for the Capacity Concentration page.
"""
from __future__ import annotations

import functools
import os
import re
import pandas as pd

_EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "Global-Cement-and-Concrete-Tracker_July-2025.xlsx")

_CAP_COL    = "Cement Capacity (millions metric tonnes per annum)"
_COUNTRY_COL = "Country/Area"
_OWNER_COL   = "Owner name (English)"
_STATUS_COL  = "Operating status"


@functools.lru_cache(maxsize=1)
def get_gem_df() -> pd.DataFrame:
    """Read & cache the GEM tracker Excel file."""
    path = os.path.abspath(_EXCEL_PATH)
    df = pd.read_excel(path, sheet_name=0, engine="openpyxl")
    df.columns = df.columns.str.strip()
    df[_CAP_COL] = pd.to_numeric(df[_CAP_COL], errors="coerce")
    df[_COUNTRY_COL] = df[_COUNTRY_COL].astype(str).str.strip()
    df[_STATUS_COL]  = df[_STATUS_COL].astype(str).str.strip().str.lower()
    df[_OWNER_COL]   = df[_OWNER_COL].astype(str).str.strip()
    return df


def get_statuses(df: pd.DataFrame) -> list[str]:
    return sorted(df[_STATUS_COL].dropna().unique().tolist())


def get_all_countries(df: pd.DataFrame) -> list[str]:
    return sorted(df[_COUNTRY_COL].dropna().unique().tolist())


def _parse_owner(raw: str) -> str:
    """Extract the first owner name, stripping percentage annotations like 'Holcim [50.0%]'."""
    if not raw or raw.lower() in ("nan", "n/a", "unknown"):
        return "Unknown"
    # Take the first owner entry (before any semicolons)
    first = raw.split(";")[0].strip()
    # Strip percentage annotation e.g. " [100.0%]"
    first = re.sub(r"\s*\[\d+\.?\d*%?\]", "", first).strip()
    return first or "Unknown"


def compute_concentration(
    df: pd.DataFrame,
    statuses: list[str] | None,
    countries: list[str] | None,
    top_n_countries: int = 10,
) -> list[dict]:
    """
    For each country, compute:
      - total_capacity
      - top3_capacity  (sum of top-3 owners by capacity)
      - top3_share     (%)
      - other_share    (%)
      - top3_owners    list of {owner, capacity}
    Returns rows sorted descending by top3_share.
    """
    fdf = df.copy()

    # Filter by status
    if statuses:
        fdf = fdf[fdf[_STATUS_COL].isin([s.lower() for s in statuses])]

    # Filter by countries
    if countries:
        fdf = fdf[fdf[_COUNTRY_COL].isin(countries)]

    fdf = fdf.dropna(subset=[_CAP_COL])
    fdf = fdf[fdf[_CAP_COL] > 0]

    # Parse owner
    fdf = fdf.copy()
    fdf["_owner"] = fdf[_OWNER_COL].apply(_parse_owner)

    # Group by country → owner
    grp = (
        fdf.groupby([_COUNTRY_COL, "_owner"])[_CAP_COL]
        .sum()
        .reset_index()
        .rename(columns={_COUNTRY_COL: "country", "_owner": "owner", _CAP_COL: "capacity"})
    )

    rows = []
    for country, cdf in grp.groupby("country"):
        total = cdf["capacity"].sum()
        if total <= 0:
            continue
        top3 = cdf.nlargest(3, "capacity")
        top3_cap = top3["capacity"].sum()
        top3_share = round(top3_cap / total * 100, 1)
        rows.append({
            "country": country,
            "total_capacity": round(total, 2),
            "top3_capacity": round(top3_cap, 2),
            "top3_share": top3_share,
            "other_share": round(100 - top3_share, 1),
            "top3_owners": [
                {"owner": r["owner"], "capacity": round(r["capacity"], 2)}
                for _, r in top3.iterrows()
            ],
        })

    # Sort by top3_share descending
    rows.sort(key=lambda x: x["top3_share"], reverse=True)

    # If countries not explicitly provided, slice to top_n
    if not countries:
        rows = rows[:top_n_countries]

    return rows