// PATH: frontend/app/business-performance/kpis/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterCheckbox } from "@/components/layout/Sidebar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { KpiBarChart, KpiLineChart } from "@/components/charts/KpiBarChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getCiqMeta, getCiqCompanies, getCiqKpis, exportPptx } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { KpiPointRow, KpiTimeSeriesRow } from "@/lib/types";

// value_col matches exactly what compute_metrics() produces in ciq_loader.py
// Reference: cld/financial_diagnosis.py KPI_REGISTRY
const KPI_CATEGORIES: Record<string, { key: string; label: string; value_col: string; yaxis_title: string; sort: string }[]> = {
  "Investor Value": [
    { key: "market_cap",       label: "Market Cap",      value_col: "Market capitalization ($ mn)", yaxis_title: "$ mn", sort: "desc" },
    { key: "enterprise_value", label: "EV",              value_col: "Enterprise value ($ mn)",      yaxis_title: "$ mn", sort: "desc" },
  ],
  "Earnings Quality": [
    { key: "revenue",       label: "Revenue",           value_col: "_Revenue",            yaxis_title: "$ mn", sort: "desc" },
    { key: "ebitda",        label: "EBITDA",            value_col: "_EBITDA",             yaxis_title: "$ mn", sort: "desc" },
    { key: "ebitda_margin", label: "EBITDA Margin",     value_col: "EBITDA margin",       yaxis_title: "%",    sort: "desc" },
    { key: "yoy_ebitda",    label: "YoY EBITDA Growth", value_col: "YoY Growth",          yaxis_title: "%",    sort: "desc" },
  ],
  "Capital Efficiency": [
    { key: "roic",           label: "ROIC",           value_col: "ROIC (%)",        yaxis_title: "%", sort: "desc" },
    { key: "roce",           label: "ROCE",           value_col: "ROCE (%)",        yaxis_title: "%", sort: "desc" },
    { key: "roa",            label: "ROA",            value_col: "ROA (%)",         yaxis_title: "%", sort: "desc" },
    { key: "asset_turnover", label: "Asset Turnover", value_col: "Asset turnover",  yaxis_title: "x", sort: "desc" },
  ],
  "Financial Risk": [
    { key: "net_debt",        label: "Net Debt",          value_col: "Net debt ($ mn)",   yaxis_title: "$ mn", sort: "asc" },
    { key: "net_debt_ebitda", label: "Net Leverage",      value_col: "Net debt / EBITDA", yaxis_title: "x",    sort: "asc" },
    { key: "debt_to_equity",  label: "Debt-to-Equity",    value_col: "Debt-to-equity",    yaxis_title: "%",    sort: "asc" },
    { key: "pct_short_term",  label: "% Short-Term Debt", value_col: "% short-term debt", yaxis_title: "%",    sort: "asc" },
  ],
  "Cash & Valuation": [
    { key: "opcf",      label: "Operating CF", value_col: "Operating cash flow ($ mn)", yaxis_title: "$ mn", sort: "desc" },
    { key: "fcf",       label: "Free CF",      value_col: "Free cash flow ($ mn)",      yaxis_title: "$ mn", sort: "desc" },
    { key: "ev_ebitda", label: "EV / EBITDA",  value_col: "EV / EBITDA",                yaxis_title: "x",    sort: "asc"  },
    { key: "pe",        label: "P/E",          value_col: "P/E",                        yaxis_title: "x",    sort: "asc"  },
  ],
  "Workforce Efficiency": [
    { key: "ebitda_per_fte",  label: "EBITDA / FTE",    value_col: "EBITDA per Employee (USD '000)",         yaxis_title: "USD '000", sort: "desc" },
    { key: "revenue_per_fte", label: "Revenue / FTE",   value_col: "Revenue per Employee (USD '000)",        yaxis_title: "USD '000", sort: "desc" },
    { key: "labor_intensity", label: "Labor Intensity", value_col: "Labor intensity (FTE per $ mn revenue)",  yaxis_title: "FTE/$mn",   sort: "asc"  },
  ],
};

// Extract numeric value from a row — tries multiple field name patterns
function extractValue(row: KpiPointRow, value_col: string): number {
  // Try exact match first
  if (row[value_col] != null) return Number(row[value_col]);
  // Try with underscore prefix (backend sometimes prefixes private cols)
  if (row[`_${value_col}`] != null) return Number(row[`_${value_col}`]);
  // Try Value field directly
  if (row["Value"] != null) return Number(row["Value"]);
  // Try lowercase
  const lower = value_col.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower && row[k] != null) return Number(row[k]);
  }
  return Number.NaN;
}

export default function KpisPage() {
  const [years,        setYears]        = useState<number[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [countryCompanies, setCountryCompanies] = useState<string[]>([]);
  const [visibleCompanies, setVisibleCompanies] = useState<string[]>([]);
  const [year,         setYear]         = useState(2024);
  const [country,      setCountry]      = useState("All");
  const [analyzedCo,   setAnalyzedCo]   = useState("");
  const [selCompanies, setSelCompanies] = useState<string[]>([]);
  const [category,     setCategory]     = useState("Earnings Quality");
  const [kpiKey,       setKpiKey]       = useState("ebitda");
  const [viewMode,     setViewMode]     = useState("Point-in-time");
  const [rawPtData,    setRawPtData]    = useState<(KpiPointRow & { _value: number })[]>([]);
  const [rawTsData,    setRawTsData]    = useState<KpiTimeSeriesRow[]>([]);
  const [ptData,       setPtData]       = useState<(KpiPointRow & { _value: number })[]>([]);
  const [tsData,       setTsData]       = useState<KpiTimeSeriesRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [metaLoading,  setMetaLoading]  = useState(true);
  const [chartCtx,     setChartCtx]     = useState<Record<string, unknown>>({});
  const [exporting,    setExporting]    = useState(false);

  const kpisInCat = KPI_CATEGORIES[category] ?? [];
  const kpiDef    = kpisInCat.find((k) => k.key === kpiKey) ?? kpisInCat[0];

  useEffect(() => {
    getCiqMeta()
      .then((r) => {
        const latestYear = r.data.years?.at(-1) ?? 2024;
        setYears(r.data.years ?? []);
        setYear(latestYear);
        setAllCountries(["All", ...(r.data.countries ?? [])]);
        setAllCompanies(r.data.companies ?? []);
        setCountryCompanies(r.data.companies ?? []);
        setVisibleCompanies(r.data.companies ?? []);
        setAnalyzedCo(r.data.companies?.[0] ?? "");
        setSelCompanies((r.data.companies ?? []).slice(0, 8));
        setMetaLoading(false);
      })
      .catch((err) => {
        console.error("[KPI META] FAILED:", err?.message ?? err);
        setMetaLoading(false);
      });
  }, []);

  useEffect(() => {
    const first = KPI_CATEGORIES[category]?.[0];
    if (first) setKpiKey(first.key);
  }, [category]);

  useEffect(() => {
    let cancelled = false;

    if (country === "All") {
      setCountryCompanies(allCompanies);
      return;
    }

    getCiqCompanies(country)
      .then((r) => {
        if (cancelled) return;
        const filtered = r.data.companies ?? [];
        setCountryCompanies(filtered);
      })
      .catch((err) => {
        console.error("[KPI COMPANIES] FAILED:", err?.message ?? err);
      });

    return () => {
      cancelled = true;
    };
  }, [country, JSON.stringify(allCompanies)]);

  useEffect(() => {
    if (!kpiDef || countryCompanies.length === 0) {
      setLoading(false);
      setVisibleCompanies([]);
      setRawPtData([]);
      setRawTsData([]);
      setPtData([]);
      setTsData([]);
      return;
    }
    setLoading(true);
    getCiqKpis({
      kpi_key:          kpiDef.key,
      year,
      companies:        countryCompanies,
      country:          country === "All" ? undefined : country,
      chart_mode:       viewMode === "Point-in-time" ? "point_in_time" : "time_series",
      year_range_start: 2010,
    }).then((r) => {
      let nextVisibleCompanies: string[] = [];
      if (r.data.point_in_time) {
        const rows = (r.data.point_in_time as KpiPointRow[])
          .map((row) => ({ ...row, _value: extractValue(row, kpiDef.value_col) }))
          .filter((row) => Number.isFinite(row._value));
        setRawPtData(rows);
        setRawTsData([]);
        nextVisibleCompanies = [...new Set(rows.map((row) => row.Company))];
      }
      if (r.data.time_series) {
        const rows = (r.data.time_series as KpiTimeSeriesRow[]).filter((row) => Number.isFinite(Number(row.Value)));
        setRawTsData(rows);
        setRawPtData([]);
        nextVisibleCompanies = [...new Set(rows.map((row) => row.Company))];
      }
      setVisibleCompanies(nextVisibleCompanies);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [kpiDef?.key, year, country, viewMode, JSON.stringify(countryCompanies)]);

  useEffect(() => {
    const nextAnalyzed = visibleCompanies.includes(analyzedCo) ? analyzedCo : visibleCompanies[0] ?? "";
    if (nextAnalyzed !== analyzedCo) {
      setAnalyzedCo(nextAnalyzed);
    }
    setSelCompanies((prev) =>
      prev.filter((c) => c !== nextAnalyzed && visibleCompanies.includes(c)).slice(0, 8)
    );
  }, [JSON.stringify(visibleCompanies)]);

  useEffect(() => {
    const selectedCompanies = [analyzedCo, ...selCompanies.filter((c) => c !== analyzedCo)];
    if (viewMode === "Point-in-time") {
      setPtData(rawPtData.filter((row) => selectedCompanies.includes(row.Company)));
      setTsData([]);
    } else {
      setTsData(rawTsData.filter((row) => selectedCompanies.includes(row.Company)));
      setPtData([]);
    }
    setChartCtx({ kpi: kpiDef?.label, year, category, viewMode, companies: selectedCompanies });
  }, [rawPtData, rawTsData, analyzedCo, JSON.stringify(selCompanies), viewMode, kpiDef?.label, year, category]);

  const exportPpt = async () => {
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      if (viewMode === "Point-in-time") {
        // BAR template: [null, co1, co2, ...] header + one series row of values
        const sorted = [...ptData].sort((a, b) =>
          kpiDef?.sort === "asc" ? a._value - b._value : b._value - a._value
        );
        const header = [null, ...sorted.map((r) => tc(r.Company))];
        const values = [tc(kpiDef?.label ?? "Value"), ...sorted.map((r) => tc(r._value))];
        const res = await exportPptx({
          template: "bar",
          filename: `kpi_${kpiKey}_${year}.pptx`,
          data: [{ name: "BarChart", table: [header, values] }],
        });
        downloadBlob(
          new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
          `kpi_${kpiKey}_${year}.pptx`,
        );
      } else {
        // GROWTH_OLD template: same structure as growth chart
        // header: [null, year1, year2, ...]
        // rows: one row per company with their time series values
        const allYears = [...new Set(tsData.map((r) => r.Year))].sort();
        const companies_ts = [...new Set(tsData.map((r) => r.Company))];
        const header = [null, ...allYears.map((y) => tc(String(y)))];
        const rows = companies_ts.map((co) => {
          const row: (ReturnType<typeof tc>)[] = [tc(co)];
          allYears.forEach((y) => {
            const match = tsData.find((r) => r.Company === co && r.Year === y);
            row.push(tc(match ? match.Value : null));
          });
          return row;
        });
        const res = await exportPptx({
          template: "growth_old",
          filename: `kpi_${kpiKey}_timeseries.pptx`,
          data: [{ name: "GrowthChart", table: [header, ...rows] }],
        });
        downloadBlob(
          new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
          `kpi_${kpiKey}_timeseries.pptx`,
        );
      }
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const downloadCsv = () => {
    const rows = viewMode === "Point-in-time"
      ? ptData.map((r) => `${r.Company},${r.Country},${r._value}`)
      : tsData.map((r) => `${r.Company},${r.Year},${r.Value}`);
    const header = viewMode === "Point-in-time" ? "Company,Country,Value" : "Company,Year,Value";
    downloadBlob(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), `kpi_${kpiKey}.csv`);
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader title="Company KPI Diagnosis" subtitle="Business Performance · CapIQ" />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Category</FilterLabel>
            <FilterSelect value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.keys(KPI_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Year</FilterLabel>
            <FilterSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Country</FilterLabel>
            <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              {allCountries.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Analyzed company</FilterLabel>
            <FilterSelect value={analyzedCo} onChange={(e) => setAnalyzedCo(e.target.value)}>
              {visibleCompanies.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Companies to compare</FilterLabel>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {visibleCompanies.map((c) => (
                <FilterCheckbox
                  key={c}
                  label={c}
                  checked={selCompanies.includes(c)}
                  onChange={(v) => setSelCompanies(v ? [...selCompanies, c] : selCompanies.filter((x) => x !== c))}
                />
              ))}
            </div>
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* KPI tab pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {kpisInCat.map((k) => {
                const active = kpiKey === k.key;
                return (
                  <button
                    key={k.key}
                    onClick={() => setKpiKey(k.key)}
                    style={{
                      padding: "5px 14px",
                      fontSize: 12,
                      fontWeight: 600,
                      borderRadius: 20,
                      border: active ? `1.5px solid ${BAIN_RED}` : "1.5px solid #e2e8f0",
                      background: active ? "#fff1f1" : "#ffffff",
                      color: active ? BAIN_RED : "#475569",
                      cursor: "pointer",
                      transition: "all 0.13s",
                      fontFamily: "Arial, Helvetica, sans-serif",
                    }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <SegmentedControl
                options={["Point-in-time", "Time series"]}
                value={viewMode}
                onChange={setViewMode}
              />
            </div>

            {/* Chart card */}
            <div style={{
              background: "#ffffff",
              border: "1px solid #e9ecef",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
                    {kpiDef?.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    {viewMode === "Point-in-time" ? `${year} snapshot · ${country}` : "Historical performance trends"}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    csvDisabled={viewMode === "Point-in-time" ? ptData.length === 0 : tsData.length === 0}
                    showPpt={true}
                    onPpt={exportPpt}
                    pptDisabled={viewMode === "Point-in-time" ? ptData.length === 0 : tsData.length === 0}
                    pptLoading={exporting}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : viewMode === "Point-in-time" ? (
                ptData.length > 0 ? (
                  <KpiBarChart
                    data={ptData}
                    analyzedCompany={analyzedCo}
                    valueKey={kpiDef?.value_col ?? ""}
                    yAxisTitle={kpiDef?.yaxis_title ?? ""}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                    No data for this KPI / year combination
                  </div>
                )
              ) : (
                tsData.length > 0 ? (
                  <KpiLineChart
                    data={tsData}
                    analyzedCompany={analyzedCo}
                    yAxisTitle={kpiDef?.yaxis_title ?? ""}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                    No data for this KPI / year combination
                  </div>
                )
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CapIQ</p>
            </div>
          </div>

          {/* ── Chat ──────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ category, kpi: kpiDef?.label, year, country, analyzedCo, viewMode }}
              chartContext={chartCtx}
              dataScope="ciq"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
