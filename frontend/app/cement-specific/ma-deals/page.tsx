"use client";
// PATH: frontend/app/cement-specific/ma-deals/page.tsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, {
  FilterLabel, FilterCheckbox, FilterDivider,
} from "@/components/layout/Sidebar";
import MaDealsChart, { type MaDealRow } from "@/components/charts/MaDealsChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import { exportPptx } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Meta {
  year_min: number; year_max: number;
  deal_regions: string[]; target_regions: string[];
  deal_statuses: string[]; deal_techniques: string[];
  value_min: number; value_max: number;
}

interface TableRow {
  "GIB Deal #": string;
  Acquiror: string;
  Divestor: string;
  "Target Region (Primary)": string;
  "Deal Value USD (m)": number | null;
  "Deal Status": string;
  "Deal Technique": string;
  "Pricing/Completion Date": string;
}

async function apiFetch(path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export default function MaDealsPage() {
  // Meta
  const [meta, setMeta] = useState<Meta | null>(null);

  // Filters
  const [yearMin, setYearMin]               = useState(1997);
  const [yearMax, setYearMax]               = useState(2024);
  const [selRegions, setSelRegions]         = useState<Set<string>>(new Set());
  const [selTargetRegs, setSelTargetRegs]   = useState<Set<string>>(new Set());
  const [selStatuses, setSelStatuses]       = useState<Set<string>>(new Set());
  const [selTechniques, setSelTechniques]   = useState<Set<string>>(new Set());
  const [minValue, setMinValue]             = useState(0);

  // Data
  const [chartData, setChartData]   = useState<MaDealRow[]>([]);
  const [tableData, setTableData]   = useState<TableRow[]>([]);
  const [loading, setLoading]       = useState(false);
  const [exporting, setExporting]   = useState(false);
  const [showTable, setShowTable]   = useState(false);
  const [chartCtx, setChartCtx]     = useState<Record<string, unknown>>({});

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    apiFetch("/cement-specific/ma-deals/meta").then((m: Meta) => {
      setMeta(m);
      setYearMin(m.year_min);
      setYearMax(m.year_max);
      setSelRegions(new Set(m.deal_regions));
      setSelTargetRegs(new Set(m.target_regions));
      setSelStatuses(new Set(m.deal_statuses));
      setSelTechniques(new Set(m.deal_techniques));
      setMinValue(0);
    }).catch(err => console.error("Failed to load meta:", err));
  }, []);

  // ── Build request body ─────────────────────────────────────────────────────
  const buildBody = useCallback(() => {
    if (!meta) return null;
    return {
      year_min:        yearMin,
      year_max:        yearMax,
      deal_regions:    selRegions.size === meta.deal_regions.length ? null : [...selRegions],
      target_regions:  selTargetRegs.size === meta.target_regions.length ? null : [...selTargetRegs],
      deal_statuses:   selStatuses.size === meta.deal_statuses.length ? null : [...selStatuses],
      deal_techniques: selTechniques.size === meta.deal_techniques.length ? null : [...selTechniques],
      min_deal_value:  minValue > 0 ? minValue : null,
    };
  }, [meta, yearMin, yearMax, selRegions, selTargetRegs, selStatuses, selTechniques, minValue]);

  // ── Fetch chart data ───────────────────────────────────────────────────────
  const load = useCallback(() => {
    const body = buildBody();
    if (!body) return;
    setLoading(true);
    apiFetch("/cement-specific/ma-deals/chart", body)
      .then((res: { data: MaDealRow[] }) => {
        setChartData(res.data);
        const sorted = [...res.data].sort((a, b) => a.year - b.year);
        const highestVal = sorted.length ? sorted.reduce((best, d) => (d.deal_value_b ?? 0) > (best.deal_value_b ?? 0) ? d : best, sorted[0]) : null;
        const highestCnt = sorted.length ? sorted.reduce((best, d) => d.deal_count > best.deal_count ? d : best, sorted[0]) : null;
        setChartCtx({
          chart_type: "bar_line",
          chart_title: "Cement Industry M&A Activity",
          data_scope: "ma_deals",
          filters: body,
          bar_series: { name: "Deal Value ($B)", color: "#1A1A1A" },
          line_series: { name: "Deal Count", color: "#E11C2A" },
          x_axis: "Year",
          y_axis_left: "Total deal value ($B)",
          y_axis_right: "Total deal count",
          total_deal_value_b: res.data.reduce((s, d) => s + (d.deal_value_b ?? 0), 0).toFixed(1),
          total_deal_count: res.data.reduce((s, d) => s + d.deal_count, 0),
          year_range: [body.year_min, body.year_max],
          all_years_data: sorted.map(d => ({
            year: d.year,
            deal_value_b: d.deal_value_b,
            deal_count: d.deal_count,
          })),
          highest_value_year: highestVal,
          highest_count_year: highestCnt,
        });
      })
      .finally(() => setLoading(false));
  }, [buildBody]);

  useEffect(() => { load(); }, [load]);

  // ── Fetch table data when opened ───────────────────────────────────────────
  useEffect(() => {
    if (!showTable) return;
    const body = buildBody();
    if (!body) return;
    apiFetch("/cement-specific/ma-deals/table", body)
      .then((res: { data: TableRow[] }) => setTableData(res.data));
  }, [showTable, buildBody]);

  // ── Toggle helpers ─────────────────────────────────────────────────────────
  const toggle = (set: Set<string>, val: string, checked: boolean): Set<string> => {
    const next = new Set(set);
    checked ? next.add(val) : next.delete(val);
    return next;
  };

  // ── CSV ────────────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const header = "Year,Deal Value ($B),Deal Count";
    const rows = chartData.map(d => `${d.year},${d.deal_value_b ?? ""},${d.deal_count}`);
    downloadBlob(new Blob([[header, ...rows].join("\n")], { type: "text/csv" }), "ma_deals.csv");
  };

  // ── PPT export ─────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    if (!chartData.length) return;
    setExporting(true);
    try {
      // Template: dual-axis bar+line
      // Row 0 (header)       : null | year1 | year2 | ...
      // Row 1 (Deal Value)   : {string: "Deal value"} | {number: val_b} | ...
      // Row 2 (Deal Count)   : {string: "Deal count"} | {number: count} | ...
      const sorted  = [...chartData].sort((a, b) => a.year - b.year);
      const header  = [null, ...sorted.map(d => ({ string: String(d.year) }))];
      const valRow  = [{ string: "Deal value" },  ...sorted.map(d => ({ number: d.deal_value_b ?? 0 }))];
      const cntRow  = [{ string: "Deal count" },  ...sorted.map(d => ({ number: d.deal_count }))];

      const res = await exportPptx({
        template: "ma",
        filename: "ma_deals.pptx",
        data: [{ name: "GrowthChart", table: [header, valRow, cntRow] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        "ma_deals.pptx",
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const totalDeals  = chartData.reduce((s, d) => s + d.deal_count, 0);
  const totalValue  = chartData.reduce((s, d) => s + (d.deal_value_b ?? 0), 0);

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title="Cement Industry M&A Activity"
        subtitle="Cement Specific · Dealogic · Deal Value & Count by Year"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <Sidebar title="Filters">

          {/* Year range */}
          <div>
            <FilterLabel>Year Range</FilterLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <input type="number" value={yearMin} min={meta?.year_min} max={yearMax}
                onChange={e => setYearMin(Number(e.target.value))}
                style={{ width: 60, padding: "4px 6px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 5, fontFamily: "Arial, Helvetica, sans-serif" }} />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
              <input type="number" value={yearMax} min={yearMin} max={meta?.year_max}
                onChange={e => setYearMax(Number(e.target.value))}
                style={{ width: 60, padding: "4px 6px", fontSize: 11, border: "1px solid #e2e8f0", borderRadius: 5, fontFamily: "Arial, Helvetica, sans-serif" }} />
            </div>
          </div>

          <FilterDivider />

          {/* Min Deal Value */}
          <div>
            <FilterLabel>Min Deal Value: <strong>${minValue}M</strong></FilterLabel>
            <input type="range" min={0} max={meta ? Math.min(meta.value_max, 5000) : 5000}
              step={50} value={minValue}
              onChange={e => setMinValue(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>$0</span><span>$5,000M</span>
            </div>
          </div>

          <FilterDivider />

          {/* Deal Status */}
          <div>
            <FilterLabel>Deal Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {meta?.deal_statuses.map(s => (
                <FilterCheckbox key={s} label={s} checked={selStatuses.has(s)}
                  onChange={v => setSelStatuses(toggle(selStatuses, s, v))} />
              ))}
            </div>
          </div>

          <FilterDivider />

          {/* Deal Technique */}
          <div>
            <FilterLabel>Deal Technique</FilterLabel>
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {meta?.deal_techniques.map(t => (
                <FilterCheckbox key={t} label={t} checked={selTechniques.has(t)}
                  onChange={v => setSelTechniques(toggle(selTechniques, t, v))} />
              ))}
            </div>
          </div>

          <FilterDivider />

          {/* Deal Region */}
          <div>
            <FilterLabel>Deal Region</FilterLabel>
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {meta?.deal_regions.map(r => (
                <FilterCheckbox key={r} label={r} checked={selRegions.has(r)}
                  onChange={v => setSelRegions(toggle(selRegions, r, v))} />
              ))}
            </div>
          </div>

          <FilterDivider />

          {/* Target Region */}
          <div>
            <FilterLabel>Target Region</FilterLabel>
            <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {meta?.target_regions.map(r => (
                <FilterCheckbox key={r} label={r} checked={selTargetRegs.has(r)}
                  onChange={v => setSelTargetRegs(toggle(selTargetRegs, r, v))} />
              ))}
            </div>
          </div>

        </Sidebar>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Summary KPI strip */}
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              {[
                { label: "Total Deals", value: totalDeals.toLocaleString() },
                { label: "Total Value", value: `$${totalValue.toFixed(1)}B` },
                { label: "Years", value: `${yearMin} – ${yearMax}` },
              ].map(kpi => (
                <div key={kpi.label} style={{
                  background: "#fff", border: "1px solid #e9ecef", borderRadius: 8,
                  padding: "8px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                  flex: 1, textAlign: "center",
                }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>{kpi.value}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{kpi.label}</div>
                </div>
              ))}
            </div>

            {/* Chart card */}
            <div style={{
              background: "#ffffff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    Total Cement Market — Deal Value &amp; Count
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    Deal value ($B) · Deal count · {yearMin}–{yearMax}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                <MaDealsChart data={chartData} height={420} />
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: Dealogic
              </p>
            </div>

            {/* Collapsible data table */}
            <div style={{ marginTop: 12, background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <button onClick={() => setShowTable(v => !v)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "Arial, Helvetica, sans-serif",
              }}>
                <span>
                  Deal details
                  {showTable && tableData.length > 0
                    ? ` (${tableData.length} deals)`
                    : ` · ${totalDeals.toLocaleString()} total deals`}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <>
                  {/* CSV download button */}
                  <div style={{ padding: "6px 16px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      onClick={() => {
                        const headers = ["Year", "Acquiror", "Divestor", "Target Region", "Value ($M)", "Status", "Technique"];
                        const rows = tableData.map(row => [
                          row["Pricing/Completion Date"]?.slice(0, 10) ?? "",
                          row["Acquiror"] ?? "",
                          row["Divestor"] ?? "",
                          row["Target Region (Primary)"] ?? "",
                          row["Deal Value USD (m)"] ?? "",
                          row["Deal Status"] ?? "",
                          row["Deal Technique"] ?? "",
                        ]);
                        const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))].join("\n");
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a"); a.href = url; a.download = "ma_deals_data.csv"; a.click();
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
                          {["Year", "Acquiror", "Divestor", "Target Region", "Value ($M)", "Status", "Technique"].map(h => (
                            <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", whiteSpace: "nowrap" }}>
                              {row["Pricing/Completion Date"]?.slice(0, 10)}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#1e293b", fontWeight: 600, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row["Acquiror"]}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {row["Divestor"]}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569", whiteSpace: "nowrap" }}>
                              {row["Target Region (Primary)"]}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right", whiteSpace: "nowrap" }}>
                              {row["Deal Value USD (m)"] != null ? `${Number(row["Deal Value USD (m)"]).toLocaleString()}` : "—"}
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9" }}>
                              <span style={{
                                background: row["Deal Status"] === "Completed" ? "#f0fdf4" : "#fff7ed",
                                color: row["Deal Status"] === "Completed" ? "#16a34a" : "#ea580c",
                                padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 600,
                              }}>
                                {row["Deal Status"]}
                              </span>
                            </td>
                            <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569", whiteSpace: "nowrap" }}>
                              {row["Deal Technique"]}
                            </td>
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
              currentFilters={{ yearMin, yearMax, selRegions: [...selRegions], selStatuses: [...selStatuses], minValue }}
              chartContext={chartCtx}
              dataScope="ma_deals"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}