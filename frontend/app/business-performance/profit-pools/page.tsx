// PATH: frontend/app/business-performance/profit-pools/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterCheckbox, FilterDivider } from "@/components/layout/Sidebar";
import ProfitPoolChart from "@/components/charts/ProfitPoolChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getProfitPoolMeta, getProfitPoolCountries, getProfitPoolChart, exportPptx } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { ProfitPoolRow } from "@/lib/types";

export default function ProfitPoolsPage() {
  const [years,        setYears]        = useState<number[]>([]);
  const [regions,      setRegions]      = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [countries,    setCountries]    = useState<string[]>([]);
  const [year,         setYear]         = useState(2024);
  const [selReg,       setSelReg]       = useState<string[]>([]);
  const [selCty,       setSelCty]       = useState<string[]>([]);
  const [data,         setData]         = useState<ProfitPoolRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [showTable,  setShowTable]  = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [chartCtx,  setChartCtx]  = useState<Record<string, unknown>>({});

  useEffect(() => {
    getProfitPoolMeta().then((r) => {
      setYears(r.data.years);
      setYear(r.data.years.at(-1) ?? 2024);
      setRegions(r.data.regions);
      setAllCountries(r.data.countries);
      setCountries(r.data.countries);
      setSelReg(r.data.regions);
      setSelCty(r.data.countries);
    });
  }, []);

  useEffect(() => {
    if (!regions.length) return;
    let cancelled = false;
    const regionFilter = selReg.length === regions.length ? undefined : selReg;
    getProfitPoolCountries(regionFilter)
      .then((r) => {
        if (cancelled) return;
        const nextCountries = r.data.countries ?? [];
        setCountries(nextCountries);
        setSelCty((prev) => prev.filter((c) => nextCountries.includes(c)));
      })
      .catch((err) => {
        console.error("[PROFIT POOL COUNTRIES] FAILED:", err?.message ?? err);
        if (!cancelled) setCountries(allCountries);
      });

    return () => {
      cancelled = true;
    };
  }, [JSON.stringify(selReg), JSON.stringify(regions), JSON.stringify(allCountries)]);

  useEffect(() => {
    if (!regions.length) return;
    const allRegionsSelected = selReg.length === regions.length;
    const allCountriesSelected = selCty.length === countries.length && countries.length > 0;
    if (!selReg.length || !selCty.length) {
      setLoading(false);
      setData([]);
      setChartCtx({ view: "profit_pool", year, regions: selReg, countries: selCty, data: [] });
      return;
    }
    setLoading(true);
    getProfitPoolChart(
      year,
      allRegionsSelected ? undefined : selReg,
      allCountriesSelected ? undefined : selCty,
    )
      .then((r) => {
        setData(r.data.data);
        setChartCtx({ view: "profit_pool", year, regions: selReg, countries: selCty, data: r.data.data });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, JSON.stringify(selReg), JSON.stringify(selCty), JSON.stringify(regions), JSON.stringify(countries)]);

  const exportPpt = async () => {
    if (!data.length) return;
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      // Category template layout:
      // Row 0 (header): [null, Label1, Label2, ...]  — category names
      // Row 1 (widths): [null, Rev1,   Rev2,   ...]  — revenue = bar width
      // Row 2 (series): ["Series 1", Margin1, ...]   — EBITDA margin = Y value
      const header     = [null,          ...data.map((r) => tc(r.Category))];
      const widthRow   = [null,          ...data.map((r) => tc(Math.round(r.Revenue)))];
      const marginRow  = [tc("Series 1"),...data.map((r) => tc(parseFloat((r.EBITDA_margin * 100).toFixed(2))))];
      const res = await exportPptx({
        template: "category",
        filename: `profit_pool_${year}.pptx`,
        data: [{ name: "CategoryChart", table: [header, widthRow, marginRow] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        `profit_pool_${year}.pptx`,
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const downloadCsv = () => {
    const csv = [
      "Category,Revenue,EBITDA,EBITDA_margin,Revenue_share,is_other",
      ...data.map((r) =>
        `"${r.Category}",${r.Revenue},${r.EBITDA},${(r.EBITDA_margin * 100).toFixed(2)}%,${(r.width * 100).toFixed(2)}%,${r.is_other}`,
      ),
    ].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), `profit_pool_${year}.csv`);
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title="Profit Pool"
        subtitle={`Business Performance · CapIQ · EBITDA Margin by Category · FY ${year}`}
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Year</FilterLabel>
            <FilterSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Region</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 140, overflowY: "auto" }}>
              {regions.map((r) => (
                <FilterCheckbox key={r} label={r}
                  checked={selReg.includes(r)}
                  onChange={(v) => setSelReg(v ? [...selReg, r] : selReg.filter((x) => x !== r))}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Country</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 140, overflowY: "auto" }}>
              {countries.map((c) => (
                <FilterCheckbox key={c} label={c}
                  checked={selCty.includes(c)}
                  onChange={(v) => setSelCty(v ? [...selCty, c] : selCty.filter((x) => x !== c))}
                />
              ))}
            </div>
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Chart card */}
            <div style={{
              background: "#ffffff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
                    Profit Pool
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    EBITDA margin by category · FY {year}
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
                <ProfitPoolChart data={data} />
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CapIQ</p>
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                Note: &quot;Other&quot; combines smaller sectors that are not shown as standalone sectors in the selected view.
              </p>
            </div>

            {/* Data table toggle */}
            {data.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <button
                  onClick={() => setShowTable(!showTable)}
                  style={{
                    background: "none", border: "1px solid #e2e8f0", borderRadius: 7,
                    padding: "7px 14px", fontSize: 12, fontWeight: 600,
                    color: "#475569", cursor: "pointer", fontFamily: "Arial, Helvetica, sans-serif",
                    display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#475569"; }}
                >
                  <span style={{ fontSize: 10 }}>{showTable ? "▲" : "▼"}</span>
                  {showTable ? "Hide" : "Show"} aggregated data
                </button>

                {showTable && (
                  <div style={{
                    marginTop: 8, background: "#ffffff",
                    border: "1px solid #e9ecef", borderRadius: 10,
                    overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif" }}>
                        <thead>
                          <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            {["Category", "Revenue ($mn)", "EBITDA ($mn)", "EBITDA Margin", "Rev Share"].map((h) => (
                              <th key={h} style={{
                                padding: "10px 14px", textAlign: h === "Category" ? "left" : "right",
                                fontSize: 11, fontWeight: 700, color: "#64748b",
                                textTransform: "uppercase", letterSpacing: "0.05em",
                                whiteSpace: "nowrap",
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.map((r, i) => (
                            <tr key={i} style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: i % 2 === 0 ? "#ffffff" : "#fafafa",
                            }}>
                              <td style={{ padding: "9px 14px", fontWeight: 600, color: "#1e293b" }}>{r.Category}</td>
                              <td style={{ padding: "9px 14px", textAlign: "right", color: "#374151" }}>{r.Revenue.toLocaleString()}</td>
                              <td style={{ padding: "9px 14px", textAlign: "right", color: "#374151" }}>{r.EBITDA.toLocaleString()}</td>
                              <td style={{ padding: "9px 14px", textAlign: "right", fontWeight: 700, color: BAIN_RED }}>
                                {(r.EBITDA_margin * 100).toFixed(1)}%
                              </td>
                              <td style={{ padding: "9px 14px", textAlign: "right", color: "#374151" }}>
                                {(r.width * 100).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Chat ──────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ year, regions: selReg, countries: selCty }}
              chartContext={chartCtx}
              dataScope="profit_pool"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
