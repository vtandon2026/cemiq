"use client";
// PATH: frontend/app/esg-and-future-tech/transition-readiness/page.tsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterCheckbox, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import { BAIN_RED } from "@/lib/chartHelpers";
import TransitionMatrixChart from "@/components/charts/TransitionMatrixChart";
import TechAdoptionHeatmap from "@/components/charts/AdoptionHeatmap";
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
    Promise.all([
      apiFetch("/transition-readiness/matrix", { group_by: groupBy, statuses, regions, min_capacity: minCap }),
      apiFetch("/transition-readiness/heatmap", { statuses }),
      apiFetch("/transition-readiness/kpis", { statuses, regions }),
    ]).then(([mat, heat, kpi]) => {
      setMatrixData(mat.data ?? []);
      setHeatmapData(heat.data ?? []);
      setKpis(kpi);
      setChartCtx({
        chart_type: "transition_readiness_matrix", group_by: groupBy,
        filters: { statuses, regions, minCap },
        top_leaders: (mat.data ?? []).filter((r: MatrixRow) => r.readiness_score > 50 && r.carbon_exposure < 50).slice(0, 5).map((r: MatrixRow) => r.name),
        top_risk: (mat.data ?? []).filter((r: MatrixRow) => r.readiness_score < 50 && r.carbon_exposure > 50).slice(0, 5).map((r: MatrixRow) => r.name),
        kpis: kpi,
      });
    }).finally(() => setLoading(false));
  }, [allStatuses, allRegions, selStatuses, selRegions, groupBy, minCap]);

  useEffect(() => { if (allStatuses.length) load(); }, [load, allStatuses]);

  const kpiCards = kpis ? [
    { label: "Future Readiness Score", value: `${kpis.future_readiness_score.toFixed(0)} / 100`, sub: "Composite: dry, alt fuel, CCUS, clay, age", color: "#059669" },
    { label: "Alt Fuel Capacity", value: `${kpis.alt_fuel_pct.toFixed(1)}%`, sub: "% of capacity using alternative fuels", color: "#d97706" },
    { label: "CCUS-Enabled Capacity", value: `${kpis.ccus_pct.toFixed(1)}%`, sub: "% of capacity with carbon capture capability", color: "#7c3aed" },
    { label: "Future-Ready Capacity", value: `${kpis.future_ready_cap.toFixed(0)} Mt`, sub: "Dry + alt fuel + CCUS or clay calcination", color: "#2563eb" },
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
              <div style={{ background: "linear-gradient(135deg,#0f172a,#1e3a5f)", borderRadius: 10, padding: "16px 20px", marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>Executive Insight</div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: 0 }}>
                  Of the <strong style={{ color: "#fff" }}>{kpis.total_capacity.toFixed(0)} Mtpa</strong> of cement capacity analysed,{" "}
                  <strong style={{ color: "#fff" }}>{kpis.future_ready_cap.toFixed(0)} Mtpa</strong> meets the future-ready threshold — plants that are dry-process, use alternative fuels, and have CCUS or clay calcination capability.
                  {" "}Alternative fuel adoption stands at <strong style={{ color: "#fff" }}>{kpis.alt_fuel_pct.toFixed(1)}%</strong> of capacity
                  {kpis.alt_fuel_pct < 15 ? ", representing a significant untapped near-term decarbonization lever" : ", reflecting meaningful progress in fuel switching"}.
                  {" "}CCUS-enabled capacity reaches <strong style={{ color: "#fff" }}>{kpis.ccus_pct.toFixed(1)}%</strong>
                  {kpis.ccus_pct < 5 ? " — nascent but critical for long-term deep decarbonization" : " — gaining traction among leading producers"}.
                  {" "}The overall future readiness score is <strong style={{ color: "#fff" }}>{kpis.future_readiness_score.toFixed(0)} / 100</strong>
                  {kpis.future_readiness_score < 30 ? ", indicating the industry remains in early stages of transition." : kpis.future_readiness_score < 60 ? ", reflecting a sector in active but uneven transition." : ", suggesting meaningful progress toward low-carbon production."}
                </p>
                <p style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.6, margin: "10px 0 0" }}>
                  Methodology · Future Readiness Score = 30% dry-process share + 30% alt fuel adoption + 20% CCUS + 10% clay calcination + 10% newer asset base, normalised 0–100. Future-Ready capacity requires dry-process + alt fuel + (CCUS or clay calcination).
                </p>
              </div>
            )}

            {/* Hero Matrix */}
            <div style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 14 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Transition Readiness Matrix</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Bubble position = carbon exposure (x) vs future readiness (y) · size = total capacity</div>
              </div>
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 480, color: "#94a3b8", fontSize: 13 }}>Loading…</div>
              ) : (
                <TransitionMatrixChart data={matrixData} height={480} />
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: Global Cement & Concrete Tracker, GEM (July 2025)</p>
            </div>

            {/* Heatmap + Alt Fuel */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
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