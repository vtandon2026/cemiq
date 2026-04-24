"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import GrowthChart from "@/components/charts/GrowthChart";
import CagrTable from "@/components/ui/CagrTable";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getCementDemandMeta, getCementDemandGrowth, exportPptx } from "@/lib/api";
import {downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { GrowthData } from "@/lib/types";


const F = "Arial, Helvetica, sans-serif";
const DEFAULT_KPI = "Consumption (Mt)";
const HIST_START = 2009;
const HIST_END   = 2024;
const FC_START   = 2025;
const FC_END     = 2029;
const ELEM_CHART = "GrowthChart";
const ELEM_TITLE = "ChartTitle";

/** Build the ppttc table rows from GrowthData — same shape as builder.py */
function buildGrowthTable(data: GrowthData, title: string) {
  const slideYears: number[] = [];
  for (let y = HIST_START; y <= FC_END; y++) slideYears.push(y);

  const yoyByYear: Record<number, number | null> = {};
  data.years.forEach((y) => { yoyByYear[y] = data.yoy[String(y)] ?? null; });

  const tc = (v: number | null) => v == null ? null : { number: parseFloat((v * 100).toFixed(4)) };
  const ts = (s: string) => ({ string: s });

  const header   = [null,       ...slideYears.map((y) => ts(String(y)))];
  const histRow  = [ts(`Historical (${HIST_START}–${HIST_END})`),
    ...slideYears.map((y) =>
      y >= HIST_START && y <= HIST_END ? tc(yoyByYear[y] ?? null) : null
    ),
  ];
  const fcRow    = [ts(`Forecast (${FC_START}–${FC_END})`),
    ...slideYears.map((y) =>
      y >= FC_START && y <= FC_END ? tc(yoyByYear[y] ?? null) : null
    ),
  ];

  return [
    { name: ELEM_CHART, table: [header, histRow, fcRow] },
    { name: ELEM_TITLE, table: [[ts(title)]] },
  ];
}


export default function CementDemandPage() {
  const [countries, setCountries] = useState<string[]>([]);
  const [kpis, setKpis] = useState<string[]>([]);
  const [country, setCountry] = useState("United States");
  const [kpi, setKpi] = useState(DEFAULT_KPI);
  const [cutoffYear, setCutoffYear] = useState(2024);
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartCtx, setChartCtx] = useState<Record<string, unknown>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getCementDemandMeta()
      .then((r) => {
        setCountries(r.data.countries);
        setKpis(r.data.kpis);
        setKpi(r.data.kpis.includes(DEFAULT_KPI) ? DEFAULT_KPI : r.data.kpis[0] ?? "");
        if (!r.data.countries.includes("United States")) {
          setCountry(r.data.countries[0] ?? "");
        }
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!country || !kpi) return;
    setLoading(true);
    setError(null);
    getCementDemandGrowth({ country, kpi, cutoff_year: cutoffYear })
      .then((r) => {
        setGrowthData(r.data);
        setChartCtx({ country, kpi, cutoff_year: cutoffYear });
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [country, kpi, cutoffYear]);

  const downloadCsv = () => {
    if (!growthData) return;
    const rows = Object.entries(growthData.revenue)
      .map(([yr, v]) => `${yr},${v ?? ""}`)
      .join("\n");
    const blob = new Blob([`Year,Value\n${rows}`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cement_demand_${country}.csv`;
    a.click();
  };

  const downloadPpt = async () => {
    if (!growthData) return;
    setExporting(true);
    try {
      const title  = `${country} — ${kpi} (YoY Growth)`;
      const data   = buildGrowthTable(growthData, title);
      const res    = await exportPptx({ template: "growth", data, filename: `cement_demand_${country}.pptx` });
      downloadBlob(res.data as Blob, `cement_demand_${country}.pptx`);
    } catch (e) {
      alert(`PPT export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="Cement Demand - Growth View"
        subtitle="Market Intelligence · Demand (Consumption) by Country"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Country</FilterLabel>
            <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>KPI / Metric</FilterLabel>
            <FilterSelect value={kpi} onChange={(e) => setKpi(e.target.value)}>
              {kpis.map((k) => <option key={k}>{k}</option>)}
            </FilterSelect>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Cutoff Year</FilterLabel>
            <FilterSelect value={String(cutoffYear)} onChange={(e) => setCutoffYear(Number(e.target.value))}>
              {[2022, 2023, 2024, 2025].map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>
        </Sidebar>

        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
                color: "#b91c1c",
                fontSize: 13,
                fontFamily: F,
                marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            <div style={{
              background: "#fff",
              border: "1px solid #e9ecef",
              borderRadius: 10,
              padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
                    {kpi} — {country}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    Forecast to {cutoffYear}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    csvDisabled={!growthData}
                    onPpt={downloadPpt}
                    pptLoading={exporting}
                    pptDisabled={!growthData}
                    showPpt
                  />
                </div>
              </div>
              
              {loading ? (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 300,
                  gap: 12,
                  color: "#94a3b8",
                  fontSize: 13,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    border: "3px solid #f1f5f9",
                    borderTop: `3px solid ${BAIN_RED}`,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Loading demand data...
                </div>
              ) : growthData ? (
                <GrowthChart
                  data={growthData}
                  height={460}
                  yAxisLabel={kpi}
                  barLabel="Demand"
                />
              ) : (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 200,
                  color: "#94a3b8",
                  fontSize: 13,
                  border: "1px dashed #e2e8f0",
                  borderRadius: 8,
                }}>
                  Select a country to load demand data.
                </div>
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CemNet</p>
            </div>

            {growthData?.cagr && growthData.cagr.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <CagrTable rows={growthData.cagr} label="CAGR Summary" />
              </div>
            )}
          </div>

          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ country, kpi, cutoff_year: cutoffYear }}
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
