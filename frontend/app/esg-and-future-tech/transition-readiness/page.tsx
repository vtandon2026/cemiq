"use client";
// PATH: frontend/app/esg-and-future-tech/transition-readiness/page.tsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterCheckbox, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import { BAIN_RED } from "@/lib/chartHelpers";
import TransitionMatrixChart from "@/components/charts/TransitionMatrixChart";
import TechAdoptionHeatmap from "@/components/charts/TechAdoptionHeatmap";
import AltFuelChart from "@/components/charts/AltFuelChart";
import CCUSClayChart from "@/components/charts/CCUSClayChart";
import type { MatrixRow, HeatmapRow, KPIs } from "@/components/charts/transitionTypes";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const F = "Arial, Helvetica, sans-serif";

async function apiFetch(path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method: body !== undefined ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return r.json();
}

export default function TransitionReadinessPage() {
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const [allStatuses, setAllStatuses] = useState<string[]>([]);

  const [selRegions, setSelRegions] = useState<Set<string>>(new Set());
  const [selStatuses, setSelStatuses] = useState<Set<string>>(new Set(["operating"]));
  const [groupBy, setGroupBy] = useState<"company" | "region" | "country">("company");
  const [minCap, setMinCap] = useState(1);

  const [matrixData, setMatrixData] = useState<MatrixRow[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapRow[]>([]);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [loading, setLoading] = useState(false);
  const [chartCtx, setChartCtx] = useState<Record<string, unknown>>({});

  useEffect(() => {
    apiFetch("/transition-readiness/meta")
      .then(m => { setAllRegions(m.regions ?? []); setAllStatuses(m.statuses ?? []); })
      .catch(console.error);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const statuses = selStatuses.size === allStatuses.length ? null : [...selStatuses];
    const regions = selRegions.size === 0 || selRegions.size === allRegions.length ? null : [...selRegions];
    apiFetch("/transition-readiness/all", {
      group_by: groupBy, statuses, regions, min_capacity: minCap,
    }).then((res) => {
      const kpi = res.kpis ?? {};
      setMatrixData(res.matrix ?? []);
      setHeatmapData(res.heatmap ?? []);
      setKpis(kpi);
      const allRows = res.matrix ?? [];
      const resilientLeaders = allRows.filter((r: MatrixRow) => r.readiness_score > 50 && r.carbon_exposure < 50);
      const transformingGiants = allRows.filter((r: MatrixRow) => r.readiness_score > 50 && r.carbon_exposure >= 50);
      const stableButLagging = allRows.filter((r: MatrixRow) => r.readiness_score <= 50 && r.carbon_exposure < 50);
      const transitionRisk = allRows.filter((r: MatrixRow) => r.readiness_score <= 50 && r.carbon_exposure >= 50);

      setChartCtx({
        chart_type: "transition_readiness_matrix",
        description: "Bubble scatter plot — X axis = Carbon Exposure (0-100), Y axis = Future Readiness (0-100), bubble size = total capacity. Four quadrants: Resilient Leaders (low exposure, high readiness), Transforming Giants (high exposure, high readiness), Stable but Lagging (low exposure, low readiness), Transition Risk (high exposure, low readiness).",
        methodology: "Carbon Exposure = 40% wet capacity share + 30% integrated share + 20% non-dry share + 10% old plant share. Future Readiness = 30% dry share + 30% alt fuel + 20% CCUS + 10% clay calcination + 10% new plants. Both normalised 0-100.",
        group_by: groupBy,
        filters: { statuses, regions, minCap },
        kpis: kpi,
        quadrants: {
          resilient_leaders: { count: resilientLeaders.length, top5: resilientLeaders.slice(0, 5).map((r: MatrixRow) => ({ name: r.name, readiness: r.readiness_score, exposure: r.carbon_exposure, capacity: r.total_capacity })) },
          transforming_giants: { count: transformingGiants.length, top5: transformingGiants.slice(0, 5).map((r: MatrixRow) => ({ name: r.name, readiness: r.readiness_score, exposure: r.carbon_exposure, capacity: r.total_capacity })) },
          stable_but_lagging: { count: stableButLagging.length, top5: stableButLagging.slice(0, 5).map((r: MatrixRow) => ({ name: r.name, readiness: r.readiness_score, exposure: r.carbon_exposure, capacity: r.total_capacity })) },
          transition_risk: { count: transitionRisk.length, top5: transitionRisk.slice(0, 5).map((r: MatrixRow) => ({ name: r.name, readiness: r.readiness_score, exposure: r.carbon_exposure, capacity: r.total_capacity })) },
        },
        top_alt_fuel: [...allRows].sort((a: MatrixRow, b: MatrixRow) => b.alt_fuel_pct - a.alt_fuel_pct).slice(0, 5).map((r: MatrixRow) => ({ name: r.name, alt_fuel_pct: r.alt_fuel_pct })),
        top_ccus: [...allRows].sort((a: MatrixRow, b: MatrixRow) => b.ccus_pct - a.ccus_pct).slice(0, 5).map((r: MatrixRow) => ({ name: r.name, ccus_pct: r.ccus_pct })),
        total_entities: allRows.length,
        all_entities: [...allRows].sort((a: MatrixRow, b: MatrixRow) => b.total_capacity - a.total_capacity).slice(0, 50).map((r: MatrixRow) => ({
          name: r.name,
          region: r.region,
          capacity_mt: r.total_capacity,
          carbon_exposure: r.carbon_exposure,
          readiness_score: r.readiness_score,
          wet_pct: r.wet_share,
          dry_pct: r.dry_share,
          alt_fuel_pct: r.alt_fuel_pct,
          ccus_pct: r.ccus_pct,
          clay_pct: r.clay_pct,
          integrated_pct: r.integrated_share,
          new_plant_pct: r.new_plant_pct,
          future_ready_cap: r.future_ready_cap,
        })),
      });
    }).finally(() => setLoading(false));
  }, [allStatuses, allRegions, selStatuses, selRegions, groupBy, minCap]);

  useEffect(() => { if (allStatuses.length) load(); }, [load, allStatuses]);

  const kpiCards = kpis ? [
    { label: "Future Readiness Score", value: `${kpis.future_readiness_score.toFixed(0)} / 100`, sub: "Composite: dry, alt fuel, CCUS, clay, age", color: "#0f172a" },
    { label: "Alt Fuel Capacity", value: `${kpis.alt_fuel_pct.toFixed(1)}%`, sub: "% of capacity using alternative fuels", color: "#E11C2A" },
    { label: "CCUS-Enabled Capacity", value: `${kpis.ccus_pct.toFixed(1)}%`, sub: "% of capacity with carbon capture capability", color: "#E11C2A" },
    { label: "Future-Ready Capacity", value: `${kpis.future_ready_cap.toFixed(0)} Mt`, sub: "Dry + alt fuel + CCUS or clay calcination", color: "#E11C2A" },
  ] : [];

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader title="Transition Readiness" subtitle="ESG & Future Tech · How the industry is responding to the low-carbon transition" />
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <Sidebar title="Filters">
          <div>
            <FilterLabel>View By</FilterLabel>
            <FilterSelect value={groupBy} onChange={e => setGroupBy(e.target.value as "company" | "region" | "country")}>
              <option value="company">Company</option>
              <option value="region">Region</option>
              <option value="country">Country</option>
            </FilterSelect>
          </div>
          <FilterDivider />
          <div>
            <FilterLabel>Operating Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {allStatuses.map(s => (
                <FilterCheckbox key={s} label={s.charAt(0).toUpperCase() + s.slice(1)} checked={selStatuses.has(s)}
                  onChange={v => setSelStatuses(prev => { const n = new Set(prev); v ? n.add(s) : n.delete(s); return n; })} />
              ))}
            </div>
          </div>
          <FilterDivider />
          <div>
            <FilterLabel>Region</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 4 }}>
              {allRegions.map(r => (
                <FilterCheckbox key={r} label={r} checked={selRegions.has(r)}
                  onChange={v => setSelRegions(prev => { const n = new Set(prev); v ? n.add(r) : n.delete(r); return n; })} />
              ))}
            </div>
          </div>
          <FilterDivider />
          <div>
            <FilterLabel>Min Capacity: <strong>{minCap}Mt</strong></FilterLabel>
            <input type="range" min={0} max={20} step={1} value={minCap}
              onChange={e => setMinCap(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>0</span><span>20Mt</span>
            </div>
          </div>
        </Sidebar>

        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* KPI Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
              {kpiCards.map(k => (
                <div key={k.label} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginBottom: 4 }}>{k.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>{k.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.sub}</div>
                </div>
              ))}
            </div>
            {/* Executive Insight */}
            {kpis && (
              <div style={{
                background: "linear-gradient(135deg, #E11C2A 0%, #8B0E18 100%)",
                color: "#fff", border: "1px solid #8B0E18",
                borderRadius: 10, padding: "16px 20px", marginBottom: 16,
                fontFamily: F, fontSize: 12.5, lineHeight: 1.55,
                boxShadow: "0 2px 8px rgba(225,28,42,0.20)",
              }}>
                <div style={{
                  fontSize: 11, color: "rgba(255,255,255,0.85)",
                  fontWeight: 700, letterSpacing: "0.06em", marginBottom: 6,
                }}>
                  EXECUTIVE INSIGHT
                </div>
                <div style={{ color: "#fff" }}>
                  Of the <strong>{kpis.total_capacity.toFixed(0)} Mtpa</strong> of cement capacity analysed,{" "}
                  <strong>{kpis.future_ready_cap.toFixed(0)} Mtpa</strong> meets the future-ready threshold — plants that are dry-process, use alternative fuels, and have CCUS or clay calcination capability.
                  {" "}Alternative fuel adoption stands at <strong>{kpis.alt_fuel_pct.toFixed(1)}%</strong> of capacity
                  {kpis.alt_fuel_pct < 15 ? ", representing a significant untapped near-term decarbonization lever" : ", reflecting meaningful progress in fuel switching"}.
                  {" "}CCUS-enabled capacity reaches <strong>{kpis.ccus_pct.toFixed(1)}%</strong>
                  {kpis.ccus_pct < 5 ? " — nascent but critical for long-term deep decarbonization" : " — gaining traction among leading producers"}.
                  {" "}The overall future readiness score is <strong>{kpis.future_readiness_score.toFixed(0)} / 100</strong>
                  {kpis.future_readiness_score < 30 ? ", indicating the industry remains in early stages of transition." : kpis.future_readiness_score < 60 ? ", reflecting a sector in active but uneven transition." : ", suggesting meaningful progress toward low-carbon production."}
                </div>
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 10.5, fontStyle: "italic",
                  color: "rgba(255,255,255,0.80)",
                  lineHeight: 1.4,
                }}>
                  Methodology · Future Readiness Score = 30% dry-process share + 30% alt fuel adoption + 20% CCUS + 10% clay calcination + 10% newer asset base, normalised 0–100. Future-Ready capacity requires dry-process + alt fuel + (CCUS or clay calcination).
                </div>
              </div>
            )}

            {/* Hero Matrix */}
            <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Transition Readiness Matrix</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Bubble position = carbon exposure (x) vs future readiness (y) · size = total capacity</div>
              </div>
              {loading ? <LoadingSpinner height={480} /> : (
                <TransitionMatrixChart data={matrixData} height={480} />
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: Global Cement & Concrete Tracker, GEM (July 2025)</p>
            </div>

            {/* Heatmap + Alt Fuel */}
            {/* <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Technology Adoption by Region</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>% of capacity enabled per technology</div>
                <TechAdoptionHeatmap data={heatmapData} />
              </div>
              <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Alternative Fuel Adoption</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Top 20 by alt fuel % of capacity</div>
                <AltFuelChart data={matrixData} height={280} />
              </div>
            </div> */}

            {/* Heatmap full width */}
            <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Technology Adoption by Region</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>% of capacity enabled per technology</div>
              <TechAdoptionHeatmap data={heatmapData} />
            </div>
            
            {/* CCUS + Clay */}
            <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>CCUS & Clay Calcination Adoption</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12 }}>Top 15 by combined long-term decarbonization capability</div>
              <CCUSClayChart data={matrixData} height={300} />
            </div>
          </div>

          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ groupBy, selRegions: [...selRegions], selStatuses: [...selStatuses], minCap }}
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

// ── Loading spinner ───────────────────────────────────────────────────────────
function LoadingSpinner({ height = 320 }: { height?: number }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height, gap: 12, color: "#94a3b8", fontSize: 13, fontFamily: F,
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
  );
}