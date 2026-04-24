// PATH: frontend/app/supply-production/global-cement-volumes/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterCheckbox, FilterDivider } from "@/components/layout/Sidebar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import GlobalCementChart from "@/components/charts/GlobalCementChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getGlobalCementMeta, getGlobalCementChart, exportPptx } from "@/lib/api";
import { downloadBlob, fmtCagr, BAIN_RED } from "@/lib/chartHelpers";
import type { GlobalCementRow, GlobalCagrRow } from "@/lib/types";

export default function GlobalCementVolumesPage() {
  const [kpis, setKpis] = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [years, setYears] = useState<number[]>([]);
  const [kpi, setKpi] = useState("");
  const [mainCountry, setMainCountry] = useState("United States");
  const [compareList, setCompareList] = useState<string[]>(["China", "India"]);
  const [rawData, setRawData] = useState<GlobalCementRow[]>([]);
  const [rawCagrData, setRawCagrData] = useState<GlobalCagrRow[]>([]);
  const [year, setYear] = useState(2024);
  const [view, setView] = useState<"time_series" | "point_in_time">("time_series");
  const [data, setData] = useState<GlobalCementRow[]>([]);
  const [cagrData, setCagrData] = useState<GlobalCagrRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartCtx, setChartCtx] = useState<Record<string, unknown>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getGlobalCementMeta().then((r) => {
      setKpis(r.data.kpis);
      setAllCountries(r.data.countries);
      setCountries(r.data.countries);
      setYears(r.data.years);
      const preferred = "Consumption (Mt)";
      setKpi(r.data.kpis.includes(preferred) ? preferred : r.data.kpis[0] ?? "");
      setYear(r.data.years.at(-1) ?? 2024);
    });
  }, []);

  useEffect(() => {
    if (!kpi || allCountries.length === 0) return;
    setLoading(true);
    getGlobalCementChart({ kpi, countries: allCountries, view, year: view === "point_in_time" ? year : undefined })
      .then((r) => {
        const nextRawData = r.data.data ?? [];
        const nextRawCagr = r.data.cagr ?? [];
        const availableSet = new Set(nextRawData.map((row) => row.Country));
        const nextCountries = allCountries.filter((c) => availableSet.has(c));
        const nextMain = nextCountries.includes(mainCountry) ? mainCountry : nextCountries[0] ?? "";
        const nextCompare = compareList.filter((c) => c !== nextMain && nextCountries.includes(c));

        setRawData(nextRawData);
        setRawCagrData(nextRawCagr);
        setCountries(nextCountries);
        setMainCountry(nextMain);
        setCompareList(nextCompare);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [kpi, view, year, JSON.stringify(allCountries)]);

  useEffect(() => {
    const selectedCountries = [mainCountry, ...compareList.filter((c) => c !== mainCountry)];
    setData(rawData.filter((row) => selectedCountries.includes(row.Country)));
    setCagrData(rawCagrData.filter((row) => selectedCountries.includes(row.Country)));
    setChartCtx({ view, kpi, countries: selectedCountries, year });
  }, [rawData, rawCagrData, mainCountry, JSON.stringify(compareList), view, kpi, year]);

  const downloadCsv = () => {
    const csv = ["Country,Year,Value", ...data.map((r) => `${r.Country},${r.Year},${r.Value}`)].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `global_cement_${kpi.replace(/\s+/g, "_")}.csv`);
  };

  const exportPpt = async () => {
    if (!data.length) return;
    setExporting(true);
    // think-cell table cells must be {string: "..."} or {number: 123} objects
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      const isTimeSeries = view === "time_series";
      let table: (Record<string, unknown> | null)[][];
      if (isTimeSeries) {
        const allYears = [...new Set(data.map((r) => r.Year))].sort();
        const countryMap: Record<string, Record<number, number>> = {};
        data.forEach((r) => {
          if (!countryMap[r.Country]) countryMap[r.Country] = {};
          countryMap[r.Country][r.Year] = r.Value;
        });
        const header = [tc("Country"), ...allYears.map((y) => tc(String(y)))];
        const rows = Object.entries(countryMap).map(([country, vals]) => [
          tc(country),
          ...allYears.map((y) => tc(vals[y] ?? null)),
        ]);
        table = [header, ...rows];
      } else {
        // Bar template expects: [null, cat1, cat2, ...] header + [seriesName, val1, val2, ...]
        // One series row with country names as categories
        const header = [null, ...data.map((r) => tc(r.Country))];
        const row = [tc(kpi), ...data.map((r) => tc(r.Value))];
        table = [header, row];
      }
      const safeKpi = kpi.replace(/[^a-zA-Z0-9_]/g, "_");
      const template = isTimeSeries ? "growth_old" : "bar";
      const elemName = isTimeSeries ? "GrowthChart" : "BarChart";
      const res = await exportPptx({
        template,
        filename: `global_cement_${safeKpi}_${view}.pptx`,
        data: [{ name: elemName, table }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        `global_cement_${safeKpi}.pptx`,
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const cagrCols = cagrData.length > 0
    ? Object.keys(cagrData[0]).filter((k) => k !== "Country")
    : [];

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader title="Global Cement Demand" subtitle="Supply & Production · CemNet" />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>KPI</FilterLabel>
            <FilterSelect value={kpi} onChange={(e) => setKpi(e.target.value)}>
              {kpis.map((k) => <option key={k}>{k}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Focus country</FilterLabel>
            <FilterSelect value={mainCountry} onChange={(e) => setMainCountry(e.target.value)}>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          {view === "point_in_time" && (
            <div>
              <FilterLabel>Year</FilterLabel>
              <FilterSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y}>{y}</option>)}
              </FilterSelect>
            </div>
          )}

          <FilterDivider />

          <div>
            <FilterLabel>Compare countries</FilterLabel>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {countries.filter((c) => c !== mainCountry).map((c) => (
                <label key={c} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, color: "#374151", cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={compareList.includes(c)}
                    onChange={(e) => setCompareList(
                      e.target.checked ? [...compareList, c] : compareList.filter((x) => x !== c)
                    )}
                    style={{ accentColor: BAIN_RED, width: 13, height: 13 }}
                  />
                  <span style={{ fontSize: 12 }}>{c}</span>
                </label>
              ))}
            </div>
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <SegmentedControl
                options={["Time series", "Point-in-time"]}
                value={view === "time_series" ? "Time series" : "Point-in-time"}
                onChange={(v) => setView(v === "Time series" ? "time_series" : "point_in_time")}
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
                    {kpi}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    {view === "time_series" ? `Historical & forecast trends · Global` : `Point-in-time snapshot · ${year}`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    csvDisabled={data.length === 0}
                    showPpt={true}
                    onPpt={exportPpt}
                    pptDisabled={data.length === 0}
                    pptLoading={exporting}
                  />
                </div>
              </div>

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                <GlobalCementChart
                  data={data}
                  view={view}
                  highlightCountry={mainCountry}
                  kpiName={kpi}
                />
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CemNet</p>
            </div>

            {/* CAGR table */}
            {cagrData.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8,
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}>
                  CAGR Overview
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%", borderCollapse: "separate", borderSpacing: 0,
                    fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif",
                    border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden",
                  }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        <th style={{
                          padding: "8px 12px", textAlign: "left",
                          fontWeight: 600, fontSize: 11, color: "#64748b",
                          textTransform: "uppercase", letterSpacing: "0.05em",
                          borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #f1f5f9",
                          whiteSpace: "nowrap",
                        }}>Country</th>
                        {cagrCols.map((k, i) => (
                          <th key={k} style={{
                            padding: "8px 12px", textAlign: "right",
                            fontWeight: 600, fontSize: 11, color: "#64748b",
                            textTransform: "uppercase", letterSpacing: "0.05em",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: i < cagrCols.length - 1 ? "1px solid #f1f5f9" : "none",
                            whiteSpace: "nowrap",
                          }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cagrData.map((row, i) => {
                        const isLast = i === cagrData.length - 1;
                        const rowBg = i % 2 === 0 ? "#ffffff" : "#fafafa";
                        const border = isLast ? "none" : "1px solid #f1f5f9";
                        return (
                          <tr key={i}>
                            <td style={{
                              padding: "7px 12px", fontWeight: 700, color: "#1e293b",
                              background: rowBg, borderBottom: border,
                              borderRight: "1px solid #f1f5f9",
                            }}>{row.Country}</td>
                            {cagrCols.map((k, ci) => {
                              const v = row[k] as number | null;
                              const isPos = v != null && v >= 0;
                              return (
                                <td key={k} style={{
                                  padding: "7px 12px", textAlign: "right",
                                  background: rowBg, borderBottom: border,
                                  borderRight: ci < cagrCols.length - 1 ? "1px solid #f1f5f9" : "none",
                                }}>
                                  {v == null ? (
                                    <span style={{ color: "#94a3b8", fontSize: 11 }}>n/a</span>
                                  ) : (
                                    <span style={{
                                      display: "inline-block",
                                      padding: "2px 8px", borderRadius: 20,
                                      fontSize: 11, fontWeight: 700,
                                      color: isPos ? "#15803d" : BAIN_RED,
                                      background: isPos ? "#f0fdf4" : "#fff1f2",
                                    }}>
                                      {fmtCagr(v)}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Chat ──────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ kpi, view, mainCountry, compareList, year }}
              chartContext={chartCtx}
              dataScope="global_cement"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
