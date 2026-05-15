"use client";
import React from "react";
// PATH: frontend/app/cement-specific/company-capacity/page.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, {
  FilterLabel, FilterSelect, FilterCheckbox, FilterDivider,
} from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { exportPptx } from "@/lib/api";
import CompanyCapacityChart from "@/components/charts/CompanyCapacityChart";
import type { CompanyRow } from "@/components/charts/CompanyCapacityChart";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const F = "Arial, Helvetica, sans-serif";

interface CountryBreakdown {
  country: string;
  capacity: number;
  plants: number;
}

async function apiFetch(path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CompanyCapacityPage() {
  const [allStatuses,  setAllStatuses]  = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);

  const [selectedStatuses,  setSelectedStatuses]  = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [addCountry,        setAddCountry]        = useState("");
  const [topN,              setTopN]              = useState(20);
  const [minCapacity,       setMinCapacity]       = useState(0);

  const [chartData,    setChartData]    = useState<CompanyRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [chartCtx,     setChartCtx]     = useState<Record<string, unknown>>({});
  const [showTable,    setShowTable]    = useState(false);
  const [expanded,     setExpanded]     = useState<string | null>(null);
  const [breakdown,    setBreakdown]    = useState<CountryBreakdown[]>([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);
  const [exporting, setExporting] = useState(false);

  // ── Meta ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/cement-specific/company-capacity/meta")
      .then(m => {
        setAllStatuses(m.statuses ?? []);
        setAllCountries(m.countries ?? []);
        const s = (m.statuses ?? []) as string[];
        const def = s.includes("operating") ? new Set<string>(["operating"]) : new Set<string>(s);
        setSelectedStatuses(def);
      })
      .catch(console.error);
  }, []);

  // ── Load chart ───────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    if (!allStatuses.length) return;
    setLoading(true);
    const statuses  = selectedStatuses.size === allStatuses.length ? null : [...selectedStatuses];
    const countries = selectedCountries.length ? selectedCountries : null;
    apiFetch("/cement-specific/company-capacity/chart", { statuses, countries, top_n: topN, min_capacity: minCapacity })
      .then(res => {
        setChartData(res.data ?? []);
        const top = res.data?.[0];
        const allCompanies = res.data ?? [];
        const totalCap = allCompanies.reduce((s: number, r: CompanyRow) => s + r.total_capacity, 0);
        setChartCtx({
          chart_type: "bar",
          chart_title: "Cement Capacity by Company",
          description: "Bar chart — companies ranked by total cement capacity (Mt). Market share = company capacity / total shown capacity.",
          filters: { statuses, countries, topN, minCapacity },
          top_company: top ? { company: top.company, capacity: top.total_capacity, share: `${top.market_share}%`, countries: top.country_count } : null,
          total_companies: allCompanies.length,
          total_capacity_mt: parseFloat(totalCap.toFixed(1)),
          top3_share_pct: parseFloat((allCompanies.slice(0, 3).reduce((s: number, r: CompanyRow) => s + r.total_capacity, 0) / (totalCap || 1) * 100).toFixed(1)),
          top_10: allCompanies.slice(0, 10).map((r: CompanyRow) => ({
            rank: r.rank,
            company: r.company,
            capacity_mt: r.total_capacity,
            market_share_pct: r.market_share,
            plant_count: r.plant_count,
            country_count: r.country_count,
            countries: r.countries.slice(0, 5),
          })),
          all_companies: allCompanies.slice(0, 50).map((r: CompanyRow) => ({
            rank: r.rank,
            company: r.company,
            capacity_mt: r.total_capacity,
            market_share_pct: r.market_share,
            plant_count: r.plant_count,
            country_count: r.country_count,
          })),
        });
      })
      .finally(() => setLoading(false));
  }, [allStatuses, selectedStatuses, selectedCountries, topN, minCapacity]);

  useEffect(() => { load(); }, [load]);

  // ── Company detail expand ────────────────────────────────────────────────────
  const handleExpand = (company: string) => {
    if (expanded === company) { setExpanded(null); setBreakdown([]); return; }
    setExpanded(company);
    setLoadingBreakdown(true);
    const statuses = selectedStatuses.size === allStatuses.length ? null : [...selectedStatuses];
    apiFetch("/cement-specific/company-capacity/detail", { company, statuses })
      .then(res => setBreakdown(res.data ?? []))
      .finally(() => setLoadingBreakdown(false));
  };

  // ── PPT export ──────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    if (!chartData.length) return;
    setExporting(true);
    try {
      const sorted = [...chartData].sort((a, b) => b.total_capacity - a.total_capacity);
      const header  = [null, ...sorted.map(r => ({ string: r.company }))];
      const capRow  = [{ string: "Capacity (Mt)" }, ...sorted.map(r => ({ number: parseFloat(r.total_capacity.toFixed(1)) }))];
      const shareRow = [{ string: "Market Share (%)" }, ...sorted.map(r => ({ number: parseFloat(r.market_share.toFixed(1)) }))];
      const res = await exportPptx({
        template: "bar",
        filename: "company_capacity.pptx",
        data: [{ name: "BarChart", table: [header, capRow, shareRow] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        "company_capacity.pptx",
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // ── CSV ─────────────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const header = "Rank,Company,Total Capacity (Mt),Plant Count,Market Share (%),Countries,Country Count";
    const rows = chartData.map(r =>
      `${r.rank},"${r.company}",${r.total_capacity},${r.plant_count},${r.market_share},"${r.countries.join("; ")}",${r.country_count}`
    );
    downloadBlob(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), "company_capacity.csv");
  };

  // ── KPIs ────────────────────────────────────────────────────────────────────
  const totalCap  = chartData.reduce((s, r) => s + r.total_capacity, 0);
  const top3Share = chartData.slice(0, 3).reduce((s, r) => s + r.total_capacity, 0) / (totalCap || 1) * 100;

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="Capacity by Company"
        subtitle="Cement Analytics · GEM Tracker · Production Capacity by Producer"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Operating Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {allStatuses.map(s => (
                <FilterCheckbox key={s}
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  checked={selectedStatuses.has(s)}
                  onChange={v => {
                    setSelectedStatuses(prev => {
                      const next = new Set(prev);
                      v ? next.add(s) : next.delete(s);
                      return next;
                    });
                  }}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Top N Companies: <strong>{topN}</strong></FilterLabel>
            <input type="range" min={5} max={50} value={topN}
              onChange={e => setTopN(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>5</span><span>50</span>
            </div>
          </div>

          <div>
            <FilterLabel>Min Capacity: <strong>{minCapacity}Mt</strong></FilterLabel>
            <input type="range" min={0} max={100} step={5} value={minCapacity}
              onChange={e => setMinCapacity(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>0</span><span>100Mt</span>
            </div>
          </div>

          <FilterDivider />

          {/* Country filter */}
          <div>
            <FilterLabel>Filter by Country</FilterLabel>
            <div style={{
              minHeight: 36, maxHeight: 120, overflowY: "auto",
              border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "4px 6px", marginTop: 4, marginBottom: 6,
              display: "flex", flexWrap: "wrap", gap: 4, background: "#fafafa",
            }}>
              {selectedCountries.length === 0 && (
                <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>All countries</span>
              )}
              {selectedCountries.map(c => (
                <span key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 4, padding: "2px 5px",
                  fontSize: 10, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap",
                }}>
                  {c}
                  <button onClick={() => setSelectedCountries(p => p.filter(x => x !== c))}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <FilterSelect value={addCountry} onChange={e => setAddCountry(e.target.value)} style={{ flex: 1 }}>
                <option value="">Add country…</option>
                {allCountries.filter(c => !selectedCountries.includes(c)).map(c => <option key={c}>{c}</option>)}
              </FilterSelect>
              <button onClick={() => { if (addCountry) { setSelectedCountries(p => [...p, addCountry]); setAddCountry(""); } }}
                disabled={!addCountry}
                style={{ padding: "6px 9px", fontSize: 12, fontWeight: 700, background: addCountry ? "#dc2626" : "#e2e8f0", color: addCountry ? "#fff" : "#94a3b8", border: "none", borderRadius: 6, cursor: addCountry ? "pointer" : "default", flexShrink: 0 }}>+</button>
            </div>
            {selectedCountries.length > 0 && (
              <button onClick={() => setSelectedCountries([])}
                style={{ marginTop: 6, fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Clear all
              </button>
            )}
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Companies Shown", value: String(chartData.length),   sub: `Top ${topN} by cement capacity`,              color: "#E11C2A" },
                { label: "Total Capacity",  value: `${totalCap.toFixed(0)} Mt`, sub: "Combined capacity of shown companies",        color: "#2563eb" },
                { label: "Top 3 Share",     value: `${top3Share.toFixed(1)}%`,  sub: "% of total held by top 3 producers",         color: "#059669" },
              ].map(k => (
                <div key={k.label} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Chart card */}
            <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    Cement Capacity by Company — Top {topN}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {selectedStatuses.size === allStatuses.length ? "All statuses" : [...selectedStatuses].join(", ")}
                    {selectedCountries.length > 0 && ` · ${selectedCountries.length} countries`}
                    {minCapacity > 0 && ` · Min ${minCapacity}Mt`}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#94a3b8", fontSize: 13 }}>Loading…</div>
              ) : (
                <CompanyCapacityChart data={chartData} height={460} />
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: Global Cement &amp; Concrete Tracker, GEM (July 2025)
              </p>
            </div>

            {/* Company table */}
            <div style={{ marginTop: 12, background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <button onClick={() => setShowTable(v => !v)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: F,
              }}>
                <span>Company details ({chartData.length} companies)</span>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <div style={{ borderTop: "1px solid #f1f5f9" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: F }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["#", "Company", "Capacity (Mt)", "Plants", "Share", "Countries", ""].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row, i) => (
                        <React.Fragment key={row.company}>
                          <tr style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9", color: "#94a3b8", fontWeight: 600 }}>{row.rank}</td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9", fontWeight: 700, color: "#1e293b", whiteSpace: "nowrap" }}>
                              {i < 3 && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: BAIN_RED, marginRight: 6 }} />}
                              {row.company}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9", color: "#374151", textAlign: "right", fontWeight: 600 }}>{row.total_capacity.toFixed(1)}</td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{row.plant_count}</td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9" }}>
                              <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontSize: 10 }}>{row.market_share}%</span>
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9", color: "#475569" }}>{row.country_count} countries</td>
                            <td style={{ padding: "5px 10px", borderBottom: expanded === row.company ? "none" : "1px solid #f1f5f9" }}>
                              <button onClick={() => handleExpand(row.company)}
                                style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer", color: "#64748b" }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}>
                                {expanded === row.company ? "▲ Hide" : "▼ Detail"}
                              </button>
                            </td>
                          </tr>
                          {expanded === row.company && (
                            <tr style={{ background: "#fafafa" }}>
                              <td colSpan={7} style={{ padding: "8px 16px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                {loadingBreakdown ? (
                                  <span style={{ fontSize: 11, color: "#94a3b8" }}>Loading breakdown…</span>
                                ) : (
                                  <div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", marginBottom: 6 }}>Capacity by country — {row.company}</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                      {breakdown.map(b => (
                                        <div key={b.country} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 11 }}>
                                          <span style={{ fontWeight: 600, color: "#1e293b" }}>{b.country}</span>
                                          <span style={{ color: "#94a3b8", marginLeft: 6 }}>{b.capacity.toFixed(1)} Mt</span>
                                          <span style={{ color: "#cbd5e1", marginLeft: 4 }}>· {b.plants} plants</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Chat ──────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ statuses: [...selectedStatuses], selectedCountries, topN, minCapacity }}
              chartContext={chartCtx}
              dataScope="company_capacity"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}