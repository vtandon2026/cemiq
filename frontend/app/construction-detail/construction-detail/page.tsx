// PATH: frontend/app/construction-detail/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import MekkoChart from "@/components/charts/MekkoChart";
import GrowthChart from "@/components/charts/GrowthChart";
import CagrTable from "@/components/ui/CagrTable";
import ConstructionCagrTable from "@/components/ui/ConstructionCagrTable";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import {
  getConstructionDetailMeta,
  getConstructionDetailCountries,
  getConstructionDetailMekko,
  getConstructionDetailGrowth,
  exportPptx,
} from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { MekkoRow, GrowthData } from "@/lib/types";

const F = "Arial, Helvetica, sans-serif";

export default function ConstructionDetailPage() {
  // ── Meta ──────────────────────────────────────────────────────────────────
  const [years,     setYears]     = useState<number[]>([]);
  const [regions,   setRegions]   = useState<string[]>([]);
  const [segments,  setSegments]  = useState<string[]>([]);
  const [newRenOpts,setNewRenOpts]= useState<string[]>([]);
  const [sources,   setSources]   = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [year,     setYear]     = useState(2024);
  const [topN,     setTopN]     = useState(10);
  const [region,   setRegion]   = useState("");
  const [country,  setCountry]  = useState("All Countries");
  const [segment,  setSegment]  = useState("All");
  const [newRen,   setNewRen]   = useState("All");
  const [source,   setSource]   = useState("All");
  const [viewMode, setViewMode] = useState("Mekko View");

  // ── Data ───────────────────────────────────────────────────────────────────
  const [mekkoData,  setMekkoData]  = useState<MekkoRow[]>([]);
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [exporting,  setExporting]  = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [chartCtx,   setChartCtx]   = useState<Record<string, unknown>>({});

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getConstructionDetailMeta()
      .then((r) => {
        const d = r.data;
        setYears(d.years);
        setYear(d.years.includes(2024) ? 2024 : d.years.at(-1) ?? 2024);
        setRegions(d.regions);
        setRegion(d.regions[0] ?? "");
        setSegments(["All", ...d.segments]);
        setNewRenOpts(["All", ...d.new_ren]);
        setSources(["All", ...d.sources]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // ── Load countries when region / segment / newRen changes ─────────────────
  useEffect(() => {
    if (!region) return;
    getConstructionDetailCountries(
      region,
      segment !== "All" ? segment : undefined,
      newRen  !== "All" ? newRen  : undefined,
    ).then((r) => {
      setCountries(r.data.countries);
      setCountry("All Countries");
    });
  }, [region, segment, newRen]);

  // ── Load chart data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!region) return;
    setLoading(true);
    setError(null);

    const seg = segment !== "All" ? segment : undefined;
    const nr  = newRen  !== "All" ? newRen  : undefined;
    const src = source  !== "All" ? source  : undefined;

    if (viewMode === "Mekko View") {
      getConstructionDetailMekko({ year, top_n: topN, show_other: true, segment: seg, new_ren: nr, source: src })
        .then((r) => {
          setMekkoData(r.data.data);
          setChartCtx({
            view: "mekko",
            year,
            segment: segment !== "All" ? segment : "All segments",
            new_ren: newRen !== "All" ? newRen : "New and Renovation",
            source: source !== "All" ? source : "All sources (GlobalData, IHS, Euroconstruct)",
            top_n: topN,
            chart_type: "Mekko chart — market share by region and country",
            data_summary: `${r.data.data.length} country segments loaded for ${year}`,
            regions_shown: [...new Set(r.data.data.map((d: { Region: string }) => d.Region))].join(", "),
          });
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      getConstructionDetailGrowth({ region, country, segment: seg, new_ren: nr, source: src })
        .then((r) => {
          const cagrRows = r.data.cagr || [];
          setGrowthData(r.data);
          setChartCtx({
            view: "growth",
            region,
            country: country === "All Countries" ? `All countries in ${region}` : country,
            segment: segment !== "All" ? segment : "All segments",
            new_ren: newRen !== "All" ? newRen : "New and Renovation",
            source: source !== "All" ? source : "All sources combined",
            chart_type: "Bar + line chart — historic bars (pre-2024) and forecast bars (post-2024) with YoY% line",
            years_shown: r.data.years?.join(", "),
            cutoff_year: r.data.cutoff_year ?? 2024,
            cagr_table: {
              description: "CAGR table showing per-source forecasts and weighted average",
              weights: "GlobalData weight=1, IHS weight=2, Euroconstruct weight=2",
              formula: "Weighted CAGR = (sum of weight_i × CAGR_i) / (sum of weights), where each source CAGR = (end/start)^(1/n) - 1",
              rows: (cagrRows as any[]).map((row: any) => ({
                period: row.period,
                start: row.start != null ? row.start.toFixed(3) : "N/A",
                end: row.end != null ? row.end.toFixed(3) : "N/A",
                globaldata_cagr: row.globaldata_cagr != null ? `${(row.globaldata_cagr * 100).toFixed(1)}%` : "N/A",
                ihs_cagr: row.ihs_cagr != null ? `${(row.ihs_cagr * 100).toFixed(1)}%` : "N/A",
                euroconstruct_cagr: row.euroconstruct_cagr != null ? `${(row.euroconstruct_cagr * 100).toFixed(1)}%` : "N/A",
                weighted_avg_cagr: row.weighted_avg_cagr != null ? `${(row.weighted_avg_cagr * 100).toFixed(1)}%` : "N/A",
              })),
            },
          });
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [viewMode, year, topN, region, country, segment, newRen, source]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    if (viewMode === "Mekko View") {
      const csv = ["Region,Country,Value", ...mekkoData.map((r) => `${r.Region},${r.Country},${r.value}`)].join("\n");
      downloadBlob(new Blob([csv], { type: "text/csv" }), `construction_detail_mekko_${year}.csv`);
    } else if (growthData) {
      const rows = growthData.years.map((y) =>
        `${y},${growthData.revenue[String(y)] ?? ""},${growthData.yoy[String(y)] ?? ""}`
      );
      downloadBlob(new Blob([["Year,Value,YoY", ...rows].join("\n")], { type: "text/csv" }), `construction_detail_growth_${region}_${country}.csv`);
    }
  };

  // ── PPT export ─────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      if (viewMode === "Mekko View") {
        const regions_list  = [...new Set(mekkoData.map((r) => r.Region))];
        const countries_list = [...new Set(mekkoData.map((r) => r.Country))];
        const header = [null, ...regions_list.map((r) => tc(r))];
        const rows   = countries_list.map((c) => {
          const row: (ReturnType<typeof tc>)[] = [tc(c)];
          regions_list.forEach((reg) => {
            const match = mekkoData.find((d) => d.Country === c && d.Region === reg);
            row.push(tc(match?.value ?? null));
          });
          return row;
        });
        const res = await exportPptx({
          template: "mekko",
          filename: `construction_detail_mekko_${year}.pptx`,
          data: [{ name: "MekkoChart", table: [header, ...rows] }],
        });
        downloadBlob(res.data as Blob, `construction_detail_mekko_${year}.pptx`);
      } else if (growthData) {
        const allYears = growthData.years;
        const cutoff   = growthData.cutoff_year ?? 2024;
        const header   = [null, ...allYears.map((y) => tc(String(y)))];
        const histRev  = [tc("Historic Value"), ...allYears.map((y) => tc(y <= cutoff ? (growthData.revenue[String(y)] ?? null) : null))];
        const fcstRev  = [tc("Forecast Value"), ...allYears.map((y) => tc(y >  cutoff ? (growthData.revenue[String(y)] ?? null) : null))];
        const histYoy  = [tc("Historic YoY"),   ...allYears.map((y) => {
          if (y > cutoff) return tc(null);
          const v = growthData.yoy[String(y)];
          return tc(v != null ? v * 100 : null);
        })];
        const fcstYoy  = [tc("Forecast YoY"),   ...allYears.map((y) => {
          if (y < cutoff) return tc(null);
          const v = growthData.yoy[String(y)];
          return tc(v != null ? v * 100 : null);
        })];
        const res = await exportPptx({
          template: "growth",
          filename: `construction_detail_growth_${region}_${country}.pptx`,
          data: [{ name: "GrowthChart", table: [header, histRev, fcstRev, histYoy, fcstYoy] }],
        });
        downloadBlob(res.data as Blob, `construction_detail_growth_${region}_${country}.pptx`);
      }
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const csvDisabled = viewMode === "Mekko View" ? mekkoData.length === 0 : !growthData;

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="Construction Detail"
        subtitle="Market Intelligence · Segment-level construction activity by region &amp; country"
      />

      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          fontSize: 13, fontWeight: 500,
          background: "#fff1f2", color: "#be123c", border: "1px solid #fecdd3",
        }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <Sidebar title="Filters">

          {/* Always visible */}
          <div>
            <FilterLabel>Year</FilterLabel>
            <FilterSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Top N countries: <strong>{topN}</strong></FilterLabel>
            <input
              type="range" min={3} max={25} value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>3</span><span>25</span>
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Segment</FilterLabel>
            <FilterSelect value={segment} onChange={(e) => setSegment(e.target.value)}>
              {segments.map((s) => <option key={s}>{s}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>New / Renovation</FilterLabel>
            <FilterSelect value={newRen} onChange={(e) => setNewRen(e.target.value)}>
              {newRenOpts.map((n) => <option key={n}>{n}</option>)}
            </FilterSelect>
          </div>

          <div>
            <FilterLabel>Source</FilterLabel>
            <FilterSelect value={source} onChange={(e) => setSource(e.target.value)}>
              {sources.map((s) => <option key={s}>{s}</option>)}
            </FilterSelect>
          </div>

          {/* Growth-only filters */}
          {viewMode === "Growth View" && (
            <>
              <FilterDivider />
              <div>
                <FilterLabel>Region</FilterLabel>
                <FilterSelect value={region} onChange={(e) => setRegion(e.target.value)}>
                  {regions.map((r) => <option key={r}>{r}</option>)}
                </FilterSelect>
              </div>
              <div>
                <FilterLabel>Country</FilterLabel>
                <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option>All Countries</option>
                  {countries.map((c) => <option key={c}>{c}</option>)}
                </FilterSelect>
              </div>
            </>
          )}
        </Sidebar>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <SegmentedControl
                options={["Mekko View", "Growth View"]}
                value={viewMode}
                onChange={setViewMode}
              />
              <div style={{ marginLeft: "auto" }}>
                <ChartActions
                  onCsv={downloadCsv}
                  csvDisabled={csvDisabled}
                  showPpt
                  onPpt={exportPpt}
                  pptDisabled={csvDisabled}
                  pptLoading={exporting}
                />
              </div>
            </div>

            {/* Chart card */}
            <div style={{
              background: "#ffffff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                    {viewMode === "Mekko View"
                      ? `Construction Detail · ${year}${segment !== "All" ? ` · ${segment}` : ""}${newRen !== "All" ? ` · ${newRen}` : ""}`
                      : `${country !== "All Countries" ? country : region} · Construction Detail`
                    }
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                    {viewMode === "Mekko View"
                      ? "Market share by region · activity value"
                      : "YoY growth · Historic & Forecast"
                    }
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 280, gap: 12, color: "#94a3b8", fontSize: 13 }}>
                  <div style={{
                    width: 28, height: 28,
                    border: "3px solid #f1f5f9",
                    borderTop: `3px solid ${BAIN_RED}`,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  Loading…
                </div>
              ) : viewMode === "Mekko View" ? (
                mekkoData.length > 0 ? (
                  <MekkoChart data={mekkoData} year={year} height={560} />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                    No data available for selected filters.
                  </div>
                )
              ) : (
                growthData ? (
                  <GrowthChart data={growthData} height={460} yAxisLabel="Value" barLabel="Activity" />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                    No data available
                  </div>
                )
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: {source !== "All" ? source : "GlobalData / Multiple"}
              </p>
            </div>

            {/* CAGR table */}
            {viewMode === "Growth View" && growthData?.cagr && (
              <div style={{ marginTop: 16 }}>
                <ConstructionCagrTable
                  rows={growthData.cagr as any}
                  label="CAGR Summary"
                />
              </div>
            )}
          </div>

          {/* ── Chat ──────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{
                year,
                region,
                country,
                segment: segment !== "All" ? segment : "All segments",
                new_ren: newRen !== "All" ? newRen : "All (New + Renovation)",
                source: source !== "All" ? source : "All sources (GlobalData, IHS, Euroconstruct)",
                viewMode,
                top_n: topN,
                available_regions: regions.join(", "),
                available_segments: segments.filter(s => s !== "All").join(", "),
                available_sources: sources.filter(s => s !== "All").join(", "),
                data_description: "Construction activity data with columns: Region, Country, Segment, New/Ren, Source, yearly values (2019-2029)",
                cagr_weights: "GlobalData=1, IHS=2, Euroconstruct=2. Weighted CAGR = weighted average of per-source CAGRs by these weights.",
              }}
              chartContext={chartCtx}
              dataScope="construction_detail"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}