// PATH: frontend/app/stock-valuation/stock-price-overview/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect } from "@/components/layout/Sidebar";
import StockPriceChart from "@/components/charts/StockPriceChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getStockPricesMeta, getStockPricesCompanies, getStockPricesChart, exportPptx } from "@/lib/api";
import { downloadBlob, fmtCagr, BAIN_RED } from "@/lib/chartHelpers";
import type { StockPriceData } from "@/lib/types";

function cagrColor(v: number | null | undefined): string {
  if (v == null) return "#64748b";
  if (v > 0.05)  return "#16a34a";
  if (v > 0)     return "#2d8a4e";
  if (v < -0.02) return BAIN_RED;
  return "#64748b";
}

function cagrBg(v: number | null | undefined): string {
  if (v == null) return "transparent";
  if (v > 0)     return "rgba(22,163,74,0.08)";
  if (v < -0.02) return "rgba(230,0,0,0.07)";
  return "rgba(100,116,139,0.08)";
}

export default function StockPriceOverviewPage() {
  const [years,       setYears]       = useState<number[]>([]);
  const [countries,   setCountries]   = useState<string[]>([]);
  const [companies,   setCompanies]   = useState<string[]>([]);
  const [endYear,     setEndYear]     = useState(2025);
  const [windowYrs,   setWindowYrs]   = useState(1);
  const [country,     setCountry]     = useState("All countries");
  const [mainCo,      setMainCo]      = useState("Holcim AG");
  const [compareCos,  setCompareCos]  = useState<string[]>(["CRH plc"]);
  const [data,        setData]        = useState<StockPriceData | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [chartCtx,    setChartCtx]    = useState<Record<string, unknown>>({});

  useEffect(() => {
    getStockPricesMeta().then((r) => {
      setYears(r.data.years);
      setEndYear(r.data.years.at(-1) ?? 2025);
      setCountries(["All countries", ...r.data.countries]);
      setCompanies(r.data.companies);
      if (r.data.companies.includes("Holcim AG")) setMainCo("Holcim AG");
      else setMainCo(r.data.companies[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (!country) return;
    getStockPricesCompanies(country === "All countries" ? undefined : country).then((r) => {
      setCompanies(r.data.companies);
    });
  }, [country]);

  const allCos = [mainCo, ...compareCos.filter((c) => c !== mainCo)];

  useEffect(() => {
    if (!mainCo || allCos.length === 0) return;
    setLoading(true);
    getStockPricesChart({
      companies: allCos,
      end_year: endYear,
      window_years: windowYrs,
      country: country === "All countries" ? undefined : country,
    })
      .then((r) => {
        setData(r.data);
        setChartCtx({ view: "stock_prices", main_company: mainCo, compare: compareCos, end_year: endYear, window: windowYrs });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [JSON.stringify(allCos), endYear, windowYrs, country]);

  const downloadCsv = () => {
    if (!data) return;
    const rows: string[] = ["Company,Date,Price,Indexed"];
    data.dates.forEach((date, i) => {
      Object.entries(data.series).forEach(([co, vals]) => {
        const idx   = vals[i];
        const price = data.raw_prices[co]?.[i];
        if (idx != null) rows.push(`"${co}",${date},${price ?? ""},${idx}`);
      });
    });
    downloadBlob(
      new Blob([rows.join("\n")], { type: "text/csv" }),
      `stock_prices_${endYear - windowYrs}_${endYear}.csv`,
    );
  };

  const exportPpt = async () => {
    if (!data) return;
    setExporting(true);
    try {
      // Build think-cell table: header row + one row per date
      const companies = Object.keys(data.series);
      const header = ["Date", ...companies];
      const rows: unknown[][] = data.dates.map((date, i) => [
        date,
        ...companies.map((co) => data.series[co]?.[i] ?? null),
      ]);
      const res = await exportPptx({
        template: "stock_price",
        filename: `stock_prices_${endYear - windowYrs}_${endYear}.pptx`,
        data: [{ name: "Stock Price Index", table: [header, ...rows] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        `stock_prices_${endYear - windowYrs}_${endYear}.pptx`,
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title="Indexed Share Price Performance"
        subtitle="Stock & Valuation · CapIQ"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>End year</FilterLabel>
            <FilterSelect value={endYear} onChange={(e) => setEndYear(Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Window (years)</FilterLabel>
            <FilterSelect value={windowYrs} onChange={(e) => setWindowYrs(Number(e.target.value))}>
              {[1, 4, 7, 10].map((w) => <option key={w}>{w}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Country</FilterLabel>
            <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Company to analyse</FilterLabel>
            <FilterSelect value={mainCo} onChange={(e) => setMainCo(e.target.value)}>
              {companies.map((c) => <option key={c}>{c}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Compare companies</FilterLabel>
            <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {companies.filter((c) => c !== mainCo).map((c) => (
                <label key={c} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  fontSize: 12, color: "#374151", cursor: "pointer",
                }}>
                  <input
                    type="checkbox"
                    checked={compareCos.includes(c)}
                    onChange={(e) => setCompareCos(
                      e.target.checked ? [...compareCos, c] : compareCos.filter((x) => x !== c)
                    )}
                    style={{ accentColor: BAIN_RED, width: 13, height: 13 }}
                  />
                  <span style={{ fontSize: 12 }}>{c}</span>
                </label>
              ))}
            </div>
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

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
                    Stock Price Performance
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    Indexed share price · {endYear - windowYrs}–{endYear}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    onPpt={exportPpt}
                    csvDisabled={!data}
                    pptDisabled={!data}
                    pptLoading={exporting}
                  />
                </div>
              </div>
              
              {loading ? (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 260, color: "#94a3b8", fontSize: 13,
                }}>
                  Loading…
                </div>
              ) : data ? (
                <StockPriceChart data={data} mainCompany={mainCo} />
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 260, color: "#94a3b8", fontSize: 13,
                }}>
                  No data
                </div>
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: CapIQ · Data available as of 31/1/2026
              </p>
            </div>

            {/* CAGR table */}
            {data?.cagr && data.cagr.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: "#94a3b8",
                  textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 8,
                  fontFamily: "Arial, Helvetica, sans-serif",
                }}>
                  CAGR Overview · {endYear - windowYrs}–{endYear}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{
                    width: "100%", borderCollapse: "separate", borderSpacing: 0,
                    fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif",
                    border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden",
                  }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {(["Company", "Start Date", "End Date", "Start Price", "End Price", "CAGR"] as const).map((h, i) => (
                          <th key={h} style={{
                            padding: "8px 12px",
                            textAlign: i >= 3 ? "right" : "left",
                            fontWeight: 600, fontSize: 11,
                            color: "#64748b",
                            textTransform: "uppercase" as const, letterSpacing: "0.05em",
                            borderBottom: "1px solid #e2e8f0",
                            borderRight: i < 5 ? "1px solid #f1f5f9" : "none",
                            whiteSpace: "nowrap" as const,
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.cagr.map((r, i) => {
                        const isLast = i === data.cagr.length - 1;
                        const rowBg = i % 2 === 0 ? "#ffffff" : "#fafafa";
                        const border = isLast ? "none" : "1px solid #f1f5f9";
                        const tdBase = { padding: "7px 12px", background: rowBg, borderBottom: border };
                        return (
                          <tr key={i}>
                            <td style={{ ...tdBase, fontWeight: 700, color: "#1e293b", borderRight: "1px solid #f1f5f9" }}>{r.Company}</td>
                            <td style={{ ...tdBase, color: "#64748b", borderRight: "1px solid #f1f5f9", fontSize: 11 }}>{r.start_date}</td>
                            <td style={{ ...tdBase, color: "#64748b", borderRight: "1px solid #f1f5f9", fontSize: 11 }}>{r.end_date}</td>
                            <td style={{ ...tdBase, textAlign: "right" as const, color: "#475569", borderRight: "1px solid #f1f5f9" }}>{r.start_price.toFixed(2)}</td>
                            <td style={{ ...tdBase, textAlign: "right" as const, color: "#475569", borderRight: "1px solid #f1f5f9" }}>{r.end_price.toFixed(2)}</td>
                            <td style={{ ...tdBase, textAlign: "right" as const }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 8px", borderRadius: 20,
                                fontSize: 11, fontWeight: 700,
                                color: cagrColor(r.cagr),
                                background: cagrBg(r.cagr),
                              }}>
                                {fmtCagr(r.cagr)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── Chat ──────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ endYear, windowYrs, country, mainCo, compareCos }}
              chartContext={chartCtx}
              dataScope="stock_prices"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}