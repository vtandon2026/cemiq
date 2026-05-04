"use client";
// PATH: frontend/app/cement-specific/capacity-concentration/page.tsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, {
  FilterLabel, FilterSelect, FilterCheckbox, FilterDivider,
} from "@/components/layout/Sidebar";
import CapacityConcentrationChart, {
  type ConcentrationRow,
} from "@/components/charts/CapacityConcentrationChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { downloadBlob } from "@/lib/chartHelpers";
import { exportPptx } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchMeta(): Promise<{ statuses: string[]; countries: string[] }> {
  const r = await fetch(`${BASE}/cement-specific/capacity-concentration/meta`);
  return r.json();
}

async function fetchChart(body: {
  statuses: string[] | null;
  countries: string[] | null;
  top_n_countries: number;
}): Promise<{ data: ConcentrationRow[] }> {
  const r = await fetch(`${BASE}/cement-specific/capacity-concentration/chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const DEFAULT_COUNTRIES = [
  "Nigeria", "Australia", "Algeria", "Japan", "Thailand",
  "Indonesia", "Mexico", "Canada", "France", "United Kingdom",
  "Italy", "Poland", "Brazil", "Spain", "Germany",
  "Egypt", "India", "United States",
];

export default function CapacityConcentrationPage() {
  // Meta
  const [allStatuses, setAllStatuses]   = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [topN, setTopN]                         = useState(10);
  const [customCountries, setCustomCountries]   = useState<string[]>(DEFAULT_COUNTRIES);
  const [addCountry, setAddCountry]             = useState("");

  // Data
  const [chartData, setChartData] = useState<ConcentrationRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chartCtx, setChartCtx]  = useState<Record<string, unknown>>({});
  const [showTable, setShowTable] = useState(false);

  // ── Load meta once ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchMeta()
      .then(({ statuses, countries }) => {
        const s = statuses ?? [];
        const c = countries ?? [];
        setAllStatuses(s);
        setAllCountries(c);
        const def = s.includes("operating") ? new Set(["operating"]) : new Set(s);
        setSelectedStatuses(def);
      })
      .catch(err => console.error("Failed to load meta:", err));
  }, []);

  // ── Fetch chart data whenever filters change ───────────────────────────────
  const load = useCallback(() => {
    if (!allStatuses.length) return;
    setLoading(true);
    const statuses = selectedStatuses.size === allStatuses.length
      ? null
      : [...selectedStatuses];
    const countries = customCountries.length ? customCountries : null;
    fetchChart({ statuses, countries, top_n_countries: topN })
      .then(res => {
        setChartData(res.data);
        const highest = res.data.length ? res.data.reduce((best, r) => r.top3_share > best.top3_share ? r : best, res.data[0]) : null;
        const largest = res.data.length ? res.data.reduce((best, r) => r.total_capacity > best.total_capacity ? r : best, res.data[0]) : null;
        setChartCtx({
          chart_type: "mekko_100pct",
          chart_title: "Top 3 Share of Local Production Capacity",
          data_scope: "cement_specific",
          bar_color_top3: "#CC0000",
          bar_color_other: "#C8C8C8",
          x_axis: "Countries",
          y_axis: "Top 3 share (%)",
          bar_width_metric: "Total capacity (Mt)",
          filters: { statuses, countries, topN },
          highest_concentration: highest,
          largest_capacity: largest,
          all_countries_data: res.data.map(r => ({
            country: r.country,
            total_capacity_mt: r.total_capacity,
            top3_share_pct: r.top3_share,
            other_share_pct: r.other_share,
            top3_owners: r.top3_owners.map(o => o.owner).join(", "),
          })),
        });
      })
      .finally(() => setLoading(false));
  }, [allStatuses, selectedStatuses, customCountries, topN]);

  useEffect(() => { load(); }, [load]);

  // ── Toggle status checkbox ─────────────────────────────────────────────────
  const toggleStatus = (s: string, checked: boolean) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      checked ? next.add(s) : next.delete(s);
      return next;
    });
  };

  // ── Country management ─────────────────────────────────────────────────────
  const addCustomCountry = () => {
    if (addCountry && !customCountries.includes(addCountry)) {
      setCustomCountries(prev => [...prev, addCountry]);
    }
    setAddCountry("");
  };

  const removeCountry = (c: string) =>
    setCustomCountries(prev => prev.filter(x => x !== c));

  // ── PPT export ─────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    if (!chartData.length) return;
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      const sorted    = [...chartData].sort((a, b) => b.top3_share - a.top3_share);
      const header    = [null, ...sorted.map(r => ({ string: r.country }))];
      // Send absolute capacity values — think-cell computes width + % automatically
      // Template has 3 series; we use Series 1 = Top 3, Series 2 = Other, Series 3 = null
      const top3Row   = [{ string: "Top 3" }, ...sorted.map(r => ({ number: r.top3_capacity }))];
      const otherRow  = [{ string: "Other" }, ...sorted.map(r => ({ number: parseFloat((r.total_capacity - r.top3_capacity).toFixed(2)) }))];
      const series3   = [{ string: "" },      ...sorted.map(() => null)];

      const res = await exportPptx({
        template: "mekko_rms",
        filename: "capacity_concentration.pptx",
        data: [{ name: "MekkoChart", table: [header, top3Row, otherRow, series3] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        "capacity_concentration.pptx",
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // ── CSV download ───────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const header = "Country,Total Capacity (Mt),Top3 Capacity (Mt),Top3 Share (%),Other Share (%),Top3 Owner 1,Top3 Owner 2,Top3 Owner 3";
    const rows = chartData.map(r => {
      const owners = r.top3_owners.map(o => o.owner);
      return `${r.country},${r.total_capacity},${r.top3_capacity},${r.top3_share},${r.other_share},${owners[0] ?? ""},${owners[1] ?? ""},${owners[2] ?? ""}`;
    });
    downloadBlob(
      new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
      "capacity_concentration.csv",
    );
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title="Top 3 Share of Local Production Capacity"
        subtitle="Cement Analytics · GEM Tracker · Capacity Concentration by Country"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <Sidebar title="Filters">

          {/* Operating status */}
          <div>
            <FilterLabel>Operating Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {allStatuses.map(s => (
                <FilterCheckbox
                  key={s}
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  checked={selectedStatuses.has(s)}
                  onChange={v => toggleStatus(s, v)}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          {/* Top N (only when not using custom country list) */}
          {customCountries.length === 0 && (
            <div>
              <FilterLabel>Top Countries: <strong>{topN}</strong></FilterLabel>
              <input
                type="range" min={5} max={50} value={topN}
                onChange={e => setTopN(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--bain-red)", marginTop: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                <span>5</span><span>50</span>
              </div>
            </div>
          )}

          <FilterDivider />

          {/* Country picker */}
          <div>
            <FilterLabel>Countries</FilterLabel>

            {/* Tag box */}
            <div style={{
              minHeight: 48, maxHeight: 130, overflowY: "auto",
              border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "4px 6px", marginTop: 4, marginBottom: 6,
              display: "flex", flexWrap: "wrap", gap: 4,
              background: "#fafafa",
            }}>
              {customCountries.length === 0 && (
                <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>
                  Showing top {topN} by Top-3 share
                </span>
              )}
              {customCountries.map(c => (
                <span key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 4, padding: "2px 5px",
                  fontSize: 10, color: "#dc2626", fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                  {c}
                  <button
                    onClick={() => removeCountry(c)}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, marginTop: 1 }}
                  >×</button>
                </span>
              ))}
            </div>

            {/* Add dropdown */}
            <div style={{ display: "flex", gap: 4 }}>
              <FilterSelect
                value={addCountry}
                onChange={e => setAddCountry(e.target.value)}
                style={{ flex: 1 }}
              >
                <option value="">Add country…</option>
                {allCountries
                  .filter(c => !customCountries.includes(c))
                  .map(c => <option key={c}>{c}</option>)}
              </FilterSelect>
              <button
                onClick={addCustomCountry}
                disabled={!addCountry}
                style={{
                  padding: "6px 9px", fontSize: 12, fontWeight: 700,
                  background: addCountry ? "#dc2626" : "#e2e8f0",
                  color: addCountry ? "#fff" : "#94a3b8",
                  border: "none", borderRadius: 6,
                  cursor: addCountry ? "pointer" : "default",
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >+</button>
            </div>

            {customCountries.length > 0 && (
              <button
                onClick={() => setCustomCountries([])}
                style={{ marginTop: 6, fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Chart card */}
            <div style={{
              background: "#ffffff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    Top 3 Producers Share of Local Capacity
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {customCountries.length > 0
                      ? `${customCountries.length} selected countries`
                      : `Top ${topN} countries by Top-3 share`}
                    {" · "}
                    {selectedStatuses.size === allStatuses.length
                      ? "All statuses"
                      : [...selectedStatuses].join(", ")}
                  </div>
                </div>
                <ChartActions
                  onCsv={downloadCsv}
                  csvDisabled={chartData.length === 0}
                  showPpt={true}
                  onPpt={exportPpt}
                  pptDisabled={chartData.length === 0}
                  pptLoading={exporting}
                />
              </div>

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                <CapacityConcentrationChart data={chartData} />
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: Global Cement &amp; Concrete Tracker, GEM (July 2025)
              </p>
            </div>

            {/* Collapsible data table */}
            <div style={{ marginTop: 12, background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <button
                onClick={() => setShowTable(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <span>Data shown ({chartData.length} countries)</span>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <>
                  {/* CSV download */}
                  <div style={{ padding: "6px 16px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        const headers = ["Country", "Total Capacity (Mt)", "Top 3 Share (%)", "Top 3 Capacity (Mt)", "Top 3 Owner 1", "Top 3 Owner 2", "Top 3 Owner 3"];
                        const rows = chartData.map(row => {
                          const owners = row.top3_owners.map(o => o.owner);
                          return [row.country, row.total_capacity.toFixed(1), row.top3_share.toFixed(1), row.top3_capacity.toFixed(1), owners[0] ?? "", owners[1] ?? "", owners[2] ?? ""];
                        });
                        const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "capacity_concentration_data.csv"; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: 10, color: "#475569", background: "#f8fafc",
                        border: "1px solid #e2e8f0", borderRadius: 5,
                        padding: "3px 8px", cursor: "pointer",
                        fontFamily: "Arial, Helvetica, sans-serif",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#dc2626"; e.currentTarget.style.color = "#dc2626"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download CSV
                    </button>
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", borderTop: "1px solid #f1f5f9" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          {["Country", "Total Capacity (Mt)", "Top 3 Share", "Top 3 Capacity (Mt)", "Top 3 Owners"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((row, i) => (
                          <tr key={row.country} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{row.country}</td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{row.total_capacity.toFixed(1)}</td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                {row.top3_share.toFixed(1)}%
                              </span>
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{row.top3_capacity.toFixed(1)}</td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{row.top3_owners.map(o => o.owner).join(" · ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

          </div>

          {/* ── Chat ───────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ statuses: [...selectedStatuses], topN, customCountries }}
              chartContext={chartCtx}
              dataScope="cement_specific"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}