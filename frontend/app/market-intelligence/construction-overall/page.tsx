// PATH: frontend/app/market-intelligence/construction-overall/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import MekkoChart from "@/components/charts/MekkoChart";
import GrowthChart from "@/components/charts/GrowthChart";
import CagrTable from "@/components/ui/CagrTable";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getFlatFileMeta, getFlatFileRegions, getFlatFileCountries, getMekkoData, getGrowthData, exportPptx } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { MekkoRow, GrowthData } from "@/lib/types";

const CATEGORY = "Construction overall";
const SOURCE = "GlobalData";

export default function ConstructionOverallPage() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState(2024);
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("All Countries");
  const [topN, setTopN] = useState(10);
  const [viewMode, setViewMode] = useState("Mekko View");
  const [mekkoData, setMekkoData] = useState<MekkoRow[]>([]);
  const [growthData, setGrowthData] = useState<GrowthData | null>(null);
  const [unit, setUnit] = useState("$ Mn");
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartCtx, setChartCtx] = useState<Record<string, unknown>>({});

  useEffect(() => {
    getFlatFileMeta()
      .then((r) => {
        setYears(r.data.years);
        const idx = Math.max(0, r.data.years.length - 4);
        setYear(r.data.years[idx] ?? r.data.years.at(-1) ?? 2024);
      })
      .catch((e) => setError(e.message));

    getFlatFileRegions(CATEGORY)
      .then((r) => {
        setRegions(r.data.regions);
        setRegion(r.data.regions[0] ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!region) return;
    getFlatFileCountries(CATEGORY, region).then((r) => {
      setCountries(r.data.countries);
      setCountry("All Countries");
    });
  }, [region]);

  useEffect(() => {
    if (viewMode === "Mekko View") {
      setLoading(true);
      setError(null);
      getMekkoData(CATEGORY, year, topN)
        .then((r) => {
          setMekkoData(r.data.data);
          setUnit(r.data.unit);
          setChartCtx({ view: "mekko", category: CATEGORY, year, unit: r.data.unit });
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    } else {
      if (!region) return;
      setLoading(true);
      setError(null);
      getGrowthData(CATEGORY, region, country)
        .then((r) => {
          setGrowthData(r.data);
          setChartCtx({ view: "growth", category: CATEGORY, region, country });
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }
  }, [viewMode, year, topN, region, country]);

  const downloadCsv = () => {
    if (viewMode === "Mekko View") {
      const csv = ["Region,Country,Value", ...mekkoData.map((r) => `${r.Region},${r.Country},${r.value}`)].join("\n");
      downloadBlob(new Blob([csv], { type: "text/csv" }), `mekko_${CATEGORY}_${year}.csv`);
    } else if (growthData) {
      const rows = growthData.years.map((y) => `${y},${growthData.revenue[String(y)] ?? ""},${growthData.yoy[String(y)] ?? ""}`);
      downloadBlob(new Blob([["Year,Revenue,YoY", ...rows].join("\n")], { type: "text/csv" }), `growth_${region}_${country}.csv`);
    }
  };

  const exportPpt = async () => {
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      if (viewMode === "Mekko View") {
        // Mekko: regions as columns, countries as rows
        const regions_list = [...new Set(mekkoData.map((r) => r.Region))];
        const countries_list = [...new Set(mekkoData.map((r) => r.Country))];
        const header = [null, ...regions_list.map((r) => tc(r))];
        const rows = countries_list.map((c) => {
          const row: (ReturnType<typeof tc>)[] = [tc(c)];
          regions_list.forEach((reg) => {
            const match = mekkoData.find((d) => d.Country === c && d.Region === reg);
            row.push(tc(match?.value ?? null));
          });
          return row;
        });
        const res = await exportPptx({
          template: "mekko",
          filename: `mekko_${CATEGORY}_${year}.pptx`,
          data: [{ name: "MekkoChart", table: [header, ...rows] }],
        });
        downloadBlob(new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }), `mekko_${CATEGORY}_${year}.pptx`);
      } else if (growthData) {
        const allYears = growthData.years;
        const cutoff = (growthData as { cutoff_year?: number }).cutoff_year ?? 2024;
        const header = [null, ...allYears.map((y) => tc(String(y)))];
        const histRev = [tc("Historic Revenue"), ...allYears.map((y) => tc(y <= cutoff ? (growthData.revenue[String(y)] ?? null) : null))];
        const fcstRev = [tc("Forecast Revenue"), ...allYears.map((y) => tc(y > cutoff ? (growthData.revenue[String(y)] ?? null) : null))];
        const histYoy = [tc("Historic YoY"), ...allYears.map((y) => {
          if (y > cutoff) return tc(null);
          const v = growthData.yoy[String(y)];
          return tc(v != null ? v * 100 : null);
        })];
        const fcstYoy = [tc("Forecast YoY"), ...allYears.map((y) => {
          if (y < cutoff) return tc(null);
          const v = growthData.yoy[String(y)];
          return tc(v != null ? v * 100 : null);
        })];
        const res = await exportPptx({
          template: "growth",
          filename: `growth_${CATEGORY}_${country}.pptx`,
          data: [{ name: "GrowthChart", table: [header, histRev, fcstRev, histYoy, fcstYoy] }],
        });
        downloadBlob(new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }), `growth_export.pptx`);
      }
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  const filters = { year, category: CATEGORY, viewMode, region, country, topN };
  const csvDisabled = viewMode === "Mekko View" ? mekkoData.length === 0 : !growthData;
  const pptDisabled = csvDisabled;

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title={`${CATEGORY} Revenue`}
        subtitle={`Market Intelligence · ${SOURCE} · ${year} · ${unit}`}
      />

      {error && (
        <div style={{
          marginBottom: 16, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          fontWeight: 500, background: "#fff1f2", color: "#be123c",
          border: "1px solid #fecdd3",
        }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────── */}
        <Sidebar title="Filters">
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

        {/* ── Main content ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <SegmentedControl
                options={["Mekko View", "Growth View"]}
                value={viewMode}
                onChange={setViewMode}
              />
            </div>

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
                    {country && country !== "All" ? `${country} — ` : region && region !== "All" ? `${region} — ` : ""}{CATEGORY}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    {viewMode === "Mekko View" ? `Market share by region · ${year}` : "YoY revenue growth · Historic & Forecast"}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    csvDisabled={csvDisabled}
                    showPpt={true}
                    onPpt={exportPpt}
                    pptDisabled={pptDisabled}
                    pptLoading={exporting}
                  />
                </div>
              </div>
              
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : viewMode === "Mekko View" ? (
                <>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>
                    {mekkoData.length} segments loaded
                  </div>
                  <MekkoChart data={mekkoData} year={year} height={620} />
                </>
              ) : (
                growthData ? <GrowthChart data={growthData} /> : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                    No data available
                  </div>
                )
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: {SOURCE}</p>
            </div>

            {viewMode === "Growth View" && growthData?.cagr && (
              <div style={{ marginTop: 16 }}>
                <CagrTable rows={growthData.cagr} />
              </div>
            )}
          </div>

          {/* ── Chat ──────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={filters}
              chartContext={chartCtx}
              dataScope="flat_file"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}