// PATH: frontend/app/construction-detail/world-view-map/page.tsx
"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getWorldViewMeta, getWorldViewChoropleth, getWorldViewBubble } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";

// Lazy-load map components (no SSR — Leaflet needs browser)
const WorldChoroplethMap = dynamic(
  () => import("@/components/charts/WorldChoroplethMap"),
  { ssr: false, loading: () => <MapLoader /> }
);
const WorldBubbleMap = dynamic(
  () => import("@/components/charts/WorldBubbleMap"),
  { ssr: false, loading: () => <MapLoader /> }
);

const F = "Arial, Helvetica, sans-serif";

function MapLoader() {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height: 500, gap: 12, color: "#94a3b8", fontSize: 13,
    }}>
      <div style={{
        width: 28, height: 28,
        border: "3px solid #f1f5f9",
        borderTop: `3px solid ${BAIN_RED}`,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      Loading map…
    </div>
  );
}

type ChoroplethRow = { country: string; region: string; value: number; yoy_growth: number | null };
type BubbleRow     = { country: string; region: string; value: number; yoy_growth: number | null; rank: number };

export default function WorldViewMapPage() {
  // ── Meta ──────────────────────────────────────────────────────────────────
  const [years,     setYears]     = useState<number[]>([]);
  const [segments,  setSegments]  = useState<string[]>([]);
  const [newRenOpts,setNewRenOpts]= useState<string[]>([]);
  const [sources,   setSources]   = useState<string[]>([]);

  // ── Filters ────────────────────────────────────────────────────────────────
  const [year,     setYear]    = useState(2024);
  const [segment,  setSegment] = useState("All");
  const [newRen,   setNewRen]  = useState("All");
  const [source,   setSource]  = useState("All");
  const [metric,   setMetric]  = useState("total_value");
  const [topN,     setTopN]    = useState(100);
  const [viewMode, setViewMode]= useState("Choropleth View");

  // ── Data ───────────────────────────────────────────────────────────────────
  const [choroplethData, setChoroplethData] = useState<ChoroplethRow[]>([]);
  const [bubbleData,     setBubbleData]     = useState<BubbleRow[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [exporting,      setExporting]      = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [chartCtx,       setChartCtx]       = useState<Record<string, unknown>>({});

  // ── Load meta ──────────────────────────────────────────────────────────────
  useEffect(() => {
    getWorldViewMeta()
      .then((r) => {
        const d = r.data;
        setYears(d.years);
        setYear(d.years.includes(2024) ? 2024 : d.years.at(-1) ?? 2024);
        setSegments(["All", ...d.segments]);
        setNewRenOpts(["All", ...d.new_ren]);
        setSources(["All", ...d.sources]);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  // ── Load map data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!year) return;
    setLoading(true);
    setError(null);

    const seg = segment !== "All" ? segment : undefined;
    const nr  = newRen  !== "All" ? newRen  : undefined;
    const src = source  !== "All" ? source  : undefined;

    if (viewMode === "Choropleth View") {
      getWorldViewChoropleth({ year, segment: seg, new_ren: nr, source: src, metric })
        .then((r) => {
          setChoroplethData(r.data.data);
          setChartCtx({
            view: "choropleth",
            year, metric, segment, new_ren: newRen, source,
            chart_type: "Choropleth world map — countries shaded by construction activity value",
            countries_shown: r.data.data.length,
            data_description: "Country-level aggregated construction activity values",
          });
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      getWorldViewBubble({ year, segment: seg, new_ren: nr, source: src, top_n: topN })
        .then((r) => {
          setBubbleData(r.data.data);
          setChartCtx({
            view: "bubble",
            year, top_n: topN, segment, new_ren: newRen, source,
            chart_type: "Bubble world map — top countries shown as proportional bubbles",
            countries_shown: r.data.data.length,
          });
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [viewMode, year, segment, newRen, source, metric, topN]);

  // ── CSV export ─────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    if (viewMode === "Choropleth View" && choroplethData.length > 0) {
      const rows = ["Country,Region,Value,YoY Growth",
        ...choroplethData.map((r) =>
          `${r.country},${r.region},${r.value},${r.yoy_growth ?? ""}`)];
      downloadBlob(new Blob([rows.join("\n")], { type: "text/csv" }),
        `world_view_choropleth_${year}.csv`);
    } else if (viewMode === "Bubble View" && bubbleData.length > 0) {
      const rows = ["Rank,Country,Region,Value,YoY Growth",
        ...bubbleData.map((r) =>
          `${r.rank},${r.country},${r.region},${r.value},${r.yoy_growth ?? ""}`)];
      downloadBlob(new Blob([rows.join("\n")], { type: "text/csv" }),
        `world_view_bubble_${year}.csv`);
    }
  };

  const csvDisabled = viewMode === "Choropleth View"
    ? choroplethData.length === 0
    : bubbleData.length === 0;

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="World View Map"
        subtitle="Construction Detail · Global construction activity by country"
      />

      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8,
          fontSize: 13, background: "#fff1f2", color: "#be123c",
          border: "1px solid #fecdd3",
        }}>⚠ {error}</div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Year</FilterLabel>
            <FilterSelect value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y}>{y}</option>)}
            </FilterSelect>
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

          <FilterDivider />

          {/* Choropleth-only filters */}
          {viewMode === "Choropleth View" && (
            <div>
              <FilterLabel>Metric</FilterLabel>
              <FilterSelect value={metric} onChange={(e) => setMetric(e.target.value)}>
                <option value="total_value">Total Value</option>
                <option value="yoy_growth">YoY Growth %</option>
              </FilterSelect>
            </div>
          )}

          {/* Bubble-only filters */}
          {viewMode === "Bubble View" && (
            <div>
              <FilterLabel>Top N countries: <strong>{topN}</strong></FilterLabel>
              <input
                type="range" min={10} max={150} value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                <span>10</span><span>150</span>
              </div>
            </div>
          )}
        </Sidebar>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* View toggle */}
            <div style={{ marginBottom: 12 }}>
              <SegmentedControl
                options={["Choropleth View", "Bubble View"]}
                value={viewMode}
                onChange={setViewMode}
              />
            </div>

            {/* Map card */}
            <div style={{
              background: "#ffffff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              {/* Card header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                    {viewMode === "Choropleth View"
                      ? `Global Construction Activity · ${year}${metric === "yoy_growth" ? " · YoY Growth" : ""}`
                      : `Top ${topN} Countries · ${year}`
                    }
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                    {viewMode === "Choropleth View"
                      ? "Countries shaded by construction activity value"
                      : "Bubble size proportional to construction activity value"
                    }
                  </div>
                </div>
                <ChartActions
                  onCsv={downloadCsv}
                  csvDisabled={csvDisabled}
                />
              </div>

              {/* Map */}
              {loading ? (
                <MapLoader />
              ) : viewMode === "Choropleth View" ? (
                choroplethData.length > 0 ? (
                  <WorldChoroplethMap
                    data={choroplethData}
                    metric={metric}
                    year={year}
                    height={520}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "#94a3b8", fontSize: 13, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
                    No data for selected filters
                  </div>
                )
              ) : (
                bubbleData.length > 0 ? (
                  <WorldBubbleMap
                    data={bubbleData}
                    year={year}
                    height={520}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 400, color: "#94a3b8", fontSize: 13, border: "1px dashed #e2e8f0", borderRadius: 8 }}>
                    No data for selected filters
                  </div>
                )
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: {source !== "All" ? source : "GlobalData / Multiple"}
              </p>
            </div>
          </div>

          {/* ── Chat ──────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{
                year, segment, new_ren: newRen, source, viewMode, metric,
                top_n: topN,
                data_description: "Construction activity data aggregated at country level",
                available_metrics: "total_value (sum of activity), yoy_growth (year-on-year % change)",
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