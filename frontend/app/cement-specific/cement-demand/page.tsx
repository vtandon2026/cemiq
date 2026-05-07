"use client";
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import GrowthChart from "@/components/charts/GrowthChart";
import CagrTable from "@/components/ui/CagrTable";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import SegmentedControl from "@/components/ui/SegmentedControl";
import {
  getCementDemandMeta, getCementDemandGrowth,
  getTradeMeta, getTradeGrowth, exportPptx,
} from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { GrowthData } from "@/lib/types";
 
const F = "Arial, Helvetica, sans-serif";
const DEFAULT_KPI  = "Consumption (Mt)";
const TRADE_KPIS   = ["Export", "Import"];
const HIST_START   = 2009;
const HIST_END     = 2024;
const FC_START     = 2025;
const FC_END       = 2029;
 
// ── Display-layer KPI rename ──────────────────────────────────────────────────
// The backend's global_cement_metrics.xlsx exposes "Export (Mt)" / "Import (Mt)"
// as columns. We display them as plain "Export" / "Import" but never send those
// short names back to the global-cement endpoint — trade KPIs always route to
// the trademad endpoint via getTradeGrowth instead.
const KPI_DISPLAY_OVERRIDES: Record<string, string> = {
  "Export (Mt)": "Export",
  "Import (Mt)": "Import",
};
const displayKpi = (raw: string) => KPI_DISPLAY_OVERRIDES[raw] ?? raw;
 
// ── KPI → trade direction ─────────────────────────────────────────────────────
const kpiToDirection = (kpi: string): "export" | "import" | null => {
  if (kpi === "Export") return "export";
  if (kpi === "Import") return "import";
  return null;
};
 
// ── PPT table builders ────────────────────────────────────────────────────────
const ts = (s: string) => ({ string: s });
const tcPct = (v: number | null) => v == null ? null : { number: parseFloat((v * 100).toFixed(4)) };
const tcRaw = (v: number | null | undefined) => v == null ? null : { number: v };
const tcRawPct2 = (v: number | null | undefined) => v == null ? null : { number: parseFloat((v * 100).toFixed(2)) };
 
// Standard growth template (CemNet demand): Historical / Forecast YoY split
function buildGrowthTable(data: GrowthData, title: string) {
  const slideYears: number[] = [];
  for (let y = HIST_START; y <= FC_END; y++) slideYears.push(y);
  const yoyByYear: Record<number, number | null> = {};
  data.years.forEach(y => { yoyByYear[y] = data.yoy[String(y)] ?? null; });
  const header  = [null, ...slideYears.map(y => ts(String(y)))];
  const histRow = [ts(`Historical (${HIST_START}–${HIST_END})`),
    ...slideYears.map(y => y >= HIST_START && y <= HIST_END ? tcPct(yoyByYear[y] ?? null) : null)];
  const fcRow   = [ts(`Forecast (${FC_START}–${FC_END})`),
    ...slideYears.map(y => y >= FC_START && y <= FC_END ? tcPct(yoyByYear[y] ?? null) : null)];
  return [
    { name: "GrowthChart", table: [header, histRow, fcRow] },
    { name: "ChartTitle",  table: [[ts(title)]] },
  ];
}
 
// Trade template (Trademad export/import): Historic Revenue (raw) + Historic YoY (×100, 2dp)
// Year range is taken directly from data.years (i.e. whatever the chart is showing).
function buildTradeTable(data: GrowthData) {
  const slideYears = data.years.slice().sort((a, b) => a - b);
  const header     = [null, ...slideYears.map(y => ts(String(y)))];
  const revRow     = [ts("Historic Revenue"),
    ...slideYears.map(y => tcRaw(data.revenue[String(y)]))];
  const yoyRow     = [ts("Historic YoY"),
    ...slideYears.map(y => tcRawPct2(data.yoy[String(y)]))];
  return [
    { name: "GrowthChart", table: [header, revRow, yoyRow] },
  ];
}
 
export default function CementDemandPage() {
  // ── Demand (global cement) state ───────────────────────────────────────────
  const [countries, setCountries]   = useState<string[]>([]);
  const [kpis, setKpis]             = useState<string[]>([]);
  const [country, setCountry]       = useState("United States");
  const [kpi, setKpi]               = useState(DEFAULT_KPI);
  const [cutoffYear, setCutoffYear] = useState(2024);
 
  // ── Trade state ────────────────────────────────────────────────────────────
  const [tradeMeasure, setTradeMeasure]     = useState<"volume" | "value">("volume");
  const [tradeCountries, setTradeCountries] = useState<string[]>([]);
 
  // ── Shared data state ──────────────────────────────────────────────────────
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [loading, setLoading]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [chartCtx, setChartCtx]     = useState<Record<string, unknown>>({});
 
  const isTradeKpi = TRADE_KPIS.includes(kpi);
  const direction  = kpiToDirection(kpi);
 
  // ── Load demand meta ───────────────────────────────────────────────────────
  useEffect(() => {
    getCementDemandMeta().then(r => {
      // Apply display rename: "Export (Mt)" → "Export", "Import (Mt)" → "Import"
      const rawKpis = r.data.kpis;
      const renamedKpis = rawKpis.map(displayKpi);
 
      // Ensure both trade KPIs are present (in case backend doesn't expose them)
      const tradeOnly = TRADE_KPIS.filter(t => !renamedKpis.includes(t));
      const allKpis = [...renamedKpis, ...tradeOnly];
 
      setCountries(r.data.countries);
      setKpis(allKpis);
 
      const defaultDisplay = displayKpi(DEFAULT_KPI);
      setKpi(allKpis.includes(defaultDisplay) ? defaultDisplay : allKpis[0] ?? "");
 
      if (!r.data.countries.includes("United States"))
        setCountry(r.data.countries[0] ?? "");
    }).catch((e: Error) => setError(e.message));
  }, []);
 
  // ── Load trade countries when KPI switches to trade ────────────────────────
  useEffect(() => {
    if (!direction) return;
    getTradeMeta(direction, tradeMeasure).then(r => {
      setTradeCountries(r.data.countries);
      // Switch country to first available if current not in trade list
      if (!r.data.countries.includes(country))
        setCountry(r.data.countries[0] ?? "");
    }).catch((e: Error) => setError(e.message));
  }, [direction, tradeMeasure]);
 
  // ── Fetch data ─────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (!country || !kpi) return;
    setLoading(true);
    setError(null);
 
    if (isTradeKpi && direction) {
      getTradeGrowth({
        direction,
        measure: tradeMeasure,
        country,
        year_min: 2006,
        year_max: 2025,
        cutoff_year: cutoffYear,
      }).then(r => {
        setGrowthData(r.data);
        setChartCtx({
          chart_type: "growth",
          kpi, country, direction, measure: tradeMeasure, cutoff_year: cutoffYear,
          data_scope: "trade",
          all_years_data: r.data.years.map(y => ({
            year: y,
            value: r.data.revenue[String(y)],
            yoy: r.data.yoy[String(y)],
          })),
        });
        setLoading(false);
      }).catch((e: Error) => { setError(e.message); setLoading(false); });
    } else {
      getCementDemandGrowth({ country, kpi, cutoff_year: cutoffYear }).then(r => {
        setGrowthData(r.data);
        setChartCtx({
          chart_type: "growth",
          kpi, country, cutoff_year: cutoffYear,
          data_scope: "global_cement",
          all_years_data: r.data.years.map(y => ({
            year: y,
            value: r.data.revenue[String(y)],
            yoy: r.data.yoy[String(y)],
          })),
        });
        setLoading(false);
      }).catch((e: Error) => { setError(e.message); setLoading(false); });
    }
  }, [country, kpi, cutoffYear, isTradeKpi, direction, tradeMeasure]);
 
  useEffect(() => { load(); }, [load]);
 
  // ── Downloads ──────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    if (!growthData) return;
    const rows = Object.entries(growthData.revenue).map(([yr, v]) => `${yr},${v ?? ""}`).join("\n");
    const blob = new Blob([`Year,Value\n${rows}`], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `cement_${kpi.toLowerCase().replace(/\s/g, "_")}_${country}.csv`;
    a.click();
  };
 
  const downloadPpt = async () => {
    if (!growthData) return;
    setExporting(true);
    try {
      const title = `${country} — ${kpi}${isTradeKpi ? ` (${tradeMeasure})` : ""} (YoY Growth)`;
      const data  = isTradeKpi ? buildTradeTable(growthData) : buildGrowthTable(growthData, title);
      const template = isTradeKpi ? "trade" : "growth";
      const res   = await exportPptx({ template, data, filename: `cement_demand_${country}.pptx` });
      downloadBlob(res.data as Blob, `cement_demand_${country}.pptx`);
    } catch (e) {
      alert(`PPT export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(false);
    }
  };
 
  // ── Country list to show ───────────────────────────────────────────────────
  const countryList = isTradeKpi ? tradeCountries : countries;
 
  // ── Unit label ─────────────────────────────────────────────────────────────
  const unitLabel = isTradeKpi
    ? (tradeMeasure === "volume" ? "Tons" : "USD")
    : kpi;
 
  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="Cement Demand - Growth View"
        subtitle={`Market Intelligence · ${isTradeKpi ? "Trade Data (Trademad)" : "Demand (CemNet)"}`}
      />
 
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <Sidebar title="Filters">
 
          {/* Country */}
          <div>
            <FilterLabel>Country</FilterLabel>
            <FilterSelect value={country} onChange={e => setCountry(e.target.value)}>
              {countryList.map(c => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>
 
          {/* KPI */}
          <div>
            <FilterLabel>KPI / Metric</FilterLabel>
            <FilterSelect value={kpi} onChange={e => setKpi(e.target.value)}>
              {kpis.map(k => <option key={k}>{k}</option>)}
            </FilterSelect>
          </div>
 
          {/* Volume / Value toggle — only for trade KPIs */}
          {isTradeKpi && (
            <>
              <FilterDivider />
              <div>
                <FilterLabel>Data Type</FilterLabel>
                <div style={{ marginTop: 6, display: "flex", gap: 4 }}>
                  {(["Volume (Tons)", "Value (USD thousand)"] as const).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setTradeMeasure(opt === "Volume (Tons)" ? "volume" : "value")}
                      style={{
                        flex: 1, padding: "5px 4px", fontSize: 10, fontWeight: 600,
                        border: "1px solid",
                        borderColor: (tradeMeasure === "volume" ? opt === "Volume (Tons)" : opt === "Value (USD thousand)") ? "var(--bain-red)" : "#e2e8f0",
                        borderRadius: 6, cursor: "pointer", fontFamily: F,
                        background: (tradeMeasure === "volume" ? opt === "Volume (Tons)" : opt === "Value (USD thousand)") ? "#fff1f1" : "#fff",
                        color: (tradeMeasure === "volume" ? opt === "Volume (Tons)" : opt === "Value (USD thousand)") ? "var(--bain-red)" : "#475569",
                        transition: "all 0.15s",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
 
          <FilterDivider />
 
          {/* Cutoff year */}
          <div>
            <FilterLabel>Cutoff Year</FilterLabel>
            <FilterSelect value={String(cutoffYear)} onChange={e => setCutoffYear(Number(e.target.value))}>
              {[2022, 2023, 2024, 2025].map(y => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>
        </Sidebar>
 
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, padding: "10px 14px",
                color: "#b91c1c", fontSize: 13, fontFamily: F, marginBottom: 12,
              }}>
                {error}
              </div>
            )}
 
            <div style={{
              background: "#fff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                    {kpi}{isTradeKpi ? ` · ${tradeMeasure === "volume" ? "Volume (Tons)" : "Value (USD thousand)"}` : ""} — {country}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                    {isTradeKpi ? "Source: Trademad" : `Forecast to ${cutoffYear} · Source: CemNet`}
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
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  height: 300, gap: 12, color: "#94a3b8", fontSize: 13,
                }}>
                  <div style={{
                    width: 28, height: 28,
                    border: "3px solid #f1f5f9",
                    borderTop: `3px solid ${BAIN_RED}`,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Loading data…
                </div>
              ) : growthData ? (
                <GrowthChart
                  data={growthData}
                  height={460}
                  yAxisLabel={unitLabel}
                  barLabel={isTradeKpi ? kpi : "Demand"}
                />
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 200, color: "#94a3b8", fontSize: 13,
                  border: "1px dashed #e2e8f0", borderRadius: 8,
                }}>
                  Select a country to load data.
                </div>
              )}
 
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                {isTradeKpi ? "Source: Trademad" : "Source: CemNet"}
              </p>
            </div>
 
            {growthData?.cagr && growthData.cagr.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <CagrTable rows={growthData.cagr} label="CAGR Summary" />
              </div>
            )}
          </div>
 
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ country, kpi, cutoff_year: cutoffYear, trade_measure: isTradeKpi ? tradeMeasure : undefined }}
              chartContext={chartCtx}
              dataScope={isTradeKpi ? "trade" : "global_cement"}
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
 