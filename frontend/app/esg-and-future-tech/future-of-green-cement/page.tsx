// PATH: frontend/app/esg-and-future-tech/future-of-green-cement/page.tsx
"use client";
import React, { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import MultiSelect from "@/components/ui/MultiSelect";
import SegmentedControl from "@/components/ui/SegmentedControl";
import GreenTechMap from "@/components/charts/GreenTechMap";
import ClinkerVsTechScatter from "@/components/charts/ClinkerVsTechScatter";
import FutureCapacityMixBar from "@/components/charts/FutureCapacityMixBar";
import TechAdoptionHeatmap from "@/components/charts/AdoptionHeatmap";
import {
  getGreenMeta, getGreenCompanies, getGreenKpis, getGreenMap,
  getGreenScatter, getGreenCapacityMix, getGreenHeatmap,
} from "@/lib/api";
import type { GreenFilterPayload } from "@/lib/api";
import { BAIN_RED } from "@/lib/chartHelpers";
import type {
  GreenMeta, GreenKpis, GreenMapData, GreenScatterData,
  GreenCapacityMixData, GreenHeatmapData,
} from "@/lib/types";

const F = "Arial, Helvetica, sans-serif";

// ── KPI tile ──────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, suffix, accent, sublabel,
}: {
  label: string; value: string; suffix?: string;
  accent?: "future" | "neutral"; sublabel?: string;
}) {
  const accentColor =
    accent === "future" ? BAIN_RED :
      accent === "neutral" ? "#0f172a" : "#0f172a";
  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: "#fff", border: "1px solid #e9ecef",
      borderRadius: 10, padding: 14,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{
        fontSize: 11, color: "#64748b",
        fontWeight: 500, fontFamily: F,
        textTransform: "uppercase", letterSpacing: "0.04em",
        lineHeight: 1.3,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
        minHeight: 28,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: accentColor, fontFamily: F,
        display: "flex", alignItems: "baseline", gap: 4,
      }}>
        {value}
        {suffix && (
          <span style={{ fontSize: 13, fontWeight: 500, color: "#94a3b8" }}>{suffix}</span>
        )}
      </div>
      {sublabel && (
        <div style={{ fontSize: 10.5, color: "#94a3b8", fontFamily: F }}>{sublabel}</div>
      )}
    </div>
  );
}

const fmtNum = (v: number | null | undefined, dec = 1) =>
  v == null ? "—" : v.toLocaleString(undefined, { minimumFractionDigits: dec, maximumFractionDigits: dec });

// ── Chart card wrapper ────────────────────────────────────────────────────────
function ChartCard({
  title, subtitle, children, right,
}: {
  title: string; subtitle?: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e9ecef",
      borderRadius: 10, padding: 16,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "flex-start", marginBottom: 12, gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
      {children}
      <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: F }}>
        Source: GEM Global Cement &amp; Concrete Tracker (July 2025)
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function FutureOfGreenCementPage() {
  const [meta, setMeta] = useState<GreenMeta | null>(null);

  // Filters
  const [regions, setRegions] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  const [techTypes, setTechTypes] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);

  // Scoped companies dropdown
  const [scopedCompanies, setScopedCompanies] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Chart-level toggles
  const [scatterGroupBy, setScatterGroupBy] = useState<"company" | "region">("region");
  const [mixGroupBy, setMixGroupBy] = useState<"region" | "company">("region");

  // Data
  const [kpis, setKpis] = useState<GreenKpis | null>(null);
  const [mapData, setMapData] = useState<GreenMapData | null>(null);
  const [scatterData, setScatterData] = useState<GreenScatterData | null>(null);
  const [mixData, setMixData] = useState<GreenCapacityMixData | null>(null);
  const [heatmapData, setHeatmapData] = useState<GreenHeatmapData | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load meta once ─────────────────────────────────────────────────────────
  useEffect(() => {
    getGreenMeta()
      .then(r => setMeta(r.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  // ── Country options scoped to selected regions ────────────────────────────
  // The country dropdown only shows countries whose region is in the active
  // region filter. When all regions are selected (or none), show all countries.
  const scopedCountries = useMemo(() => {
    const all = meta?.countries ?? [];
    if (!regions.length) return all;
    const map = meta?.country_to_region ?? {};
    const allowed = new Set(regions);
    return all.filter(c => allowed.has(map[c]));
  }, [meta, regions]);

  // When regions change, drop selected countries that no longer belong to
  // any selected region. (Otherwise filters silently include hidden countries.)
  useEffect(() => {
    if (!meta || !regions.length) return;
    const map = meta.country_to_region ?? {};
    const allowed = new Set(regions);
    setCountries(prev => prev.filter(c => allowed.has(map[c])));
  }, [regions, meta]);

  // ── Refetch scoped companies on region/country change ─────────────────────
  useEffect(() => {
    setCompaniesLoading(true);
    getGreenCompanies(
      regions.length ? regions : null,
      countries.length ? countries : null,
    )
      .then(r => {
        const allowed = new Set(r.data.companies);
        setScopedCompanies(r.data.companies);
        setCompanies(prev => prev.filter(c => allowed.has(c)));
        setCompaniesLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setCompaniesLoading(false); });
  }, [regions, countries]);

  // ── Build payloads ─────────────────────────────────────────────────────────
  // basePayload: hard filters for KPIs, hero map, executive insight strip.
  // These narrow strictly to whatever the user selected.
  const basePayload = useMemo(() => ({
    regions: regions.length ? regions : null,
    countries: countries.length ? countries : null,
    companies: companies.length ? companies : null,
    statuses: statuses.length ? statuses : null,
    tech_types: techTypes.length ? techTypes : null,
  }), [regions, countries, companies, statuses, techTypes]);

  // The three analysis charts use a hybrid filter+widening+highlight model:
  //
  //   ▸ Region selection         → hard scope (only that region's plants)
  //   ▸ Country selection        → widens to country's parent region for
  //                                Region tab + Heatmap (country highlighted);
  //                                hard filter for Company tab
  //   ▸ Company selection        → widens to company's parent region;
  //                                highlights on Company tab; for Region tab
  //                                and Heatmap, only the data scope is widened
  //                                (no highlight there — highlight only makes
  //                                sense on the axis that lists the entity)
  //   ▸ Country + Company        → Country wins for Company tab (hard filter);
  //                                widening still applies for Region tab/Heatmap
  //
  // Status & TechType are always hard filters across all charts.
  const country_to_region = meta?.country_to_region ?? {};
  const company_to_region = meta?.company_to_region ?? {};

  // Effective region scope for analysis charts — explicit Region wins; else
  // derive from selected Countries; else from selected Companies; else null.
  const widenedRegions = useMemo<string[] | null>(() => {
    if (regions.length) return regions;
    const fromCountries = countries.map(c => country_to_region[c]).filter(Boolean);
    if (fromCountries.length) return Array.from(new Set(fromCountries));
    const fromCompanies = companies.map(c => company_to_region[c]).filter(Boolean);
    if (fromCompanies.length) return Array.from(new Set(fromCompanies));
    return null;
  }, [regions, countries, companies, country_to_region, company_to_region]);

  // Map payload — separate from basePayload because we want widen-and-highlight
  // behavior on Company filter:
  //   • Company alone           → hard filter (only that company's plants)
  //   • Country + Company       → show all plants in country, highlight company's
  //   • Region + Company        → show all plants in region, highlight company's
  //   • All other states        → hard filter (current basePayload behavior)
  const mapPayload = useMemo<GreenFilterPayload>(() => {
    const hasOtherScope = regions.length > 0 || countries.length > 0;
    const widenForCompany = companies.length > 0 && hasOtherScope;

    return {
      regions: regions.length ? regions : null,
      countries: countries.length ? countries : null,
      // When widening for company: drop company from the data filter so the
      // backend returns all plants in the broader scope; pass the company
      // name as highlight_companies instead. Otherwise keep it as a hard filter.
      companies: widenForCompany ? null : (companies.length ? companies : null),
      statuses: statuses.length ? statuses : null,
      tech_types: techTypes.length ? techTypes : null,
      highlight_companies: widenForCompany ? companies : null,
    };
  }, [regions, countries, companies, statuses, techTypes]);

  // Payload for the Scatter chart, depending on which tab is active.
  const scatterPayload = useMemo<GreenFilterPayload>(() => {
    const payload: GreenFilterPayload = scatterGroupBy === "company" ? {
      // Company tab: Country acts as a hard filter; Company highlights.
      regions: widenedRegions,
      countries: countries.length ? countries : null,
      companies: null,
      statuses: statuses.length ? statuses : null,
      tech_types: techTypes.length ? techTypes : null,
      highlight_countries: null,
      highlight_companies: companies.length ? companies : null,
      group_by: "company",
    } : {
      // Region tab: shows ALL countries in the (widened) region scope. Country
      // is rendered as a highlight only. Company has NO effect on this tab —
      // it doesn't filter data, doesn't highlight anything (companies aren't
      // shown here). This keeps the Region tab a stable comparative view of
      // sibling countries regardless of company selection.
      regions: widenedRegions,
      countries: null,
      companies: null,
      statuses: statuses.length ? statuses : null,
      tech_types: techTypes.length ? techTypes : null,
      highlight_countries: countries.length ? countries : null,
      highlight_companies: null,
      group_by: "region",
    };
    // TEMPORARY: Remove after verifying filter behavior
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-console
      console.log("[scatterPayload]", JSON.stringify(payload));
    }
    return payload;
  }, [scatterGroupBy, widenedRegions, countries, companies, statuses, techTypes]);

  // Payload for the Capacity Mix chart — same logic as scatter.
  const mixPayload = useMemo<GreenFilterPayload>(() => {
    if (mixGroupBy === "company") {
      return {
        regions: widenedRegions,
        countries: countries.length ? countries : null,
        companies: null,
        statuses: statuses.length ? statuses : null,
        tech_types: techTypes.length ? techTypes : null,
        highlight_countries: null,
        highlight_companies: companies.length ? companies : null,
        group_by: "company",
        top_n: 9999,   // explicit: never apply backend top-N cap
      };
    }
    return {
      // Region tab: shows ALL countries in the (widened) region scope.
      // Company has no effect on this tab. Country is rendered as a highlight only.
      regions: widenedRegions,
      countries: null,
      companies: null,
      statuses: statuses.length ? statuses : null,
      tech_types: techTypes.length ? techTypes : null,
      highlight_countries: countries.length ? countries : null,
      highlight_companies: null,
      group_by: "region",
      top_n: 9999,
    };
  }, [mixGroupBy, widenedRegions, countries, companies, statuses, techTypes]);

  // Payload for the Heatmap — same as Region tab logic (columns are regions
  // or countries, never companies, so Company filter has no effect here).
  const heatmapPayload = useMemo<GreenFilterPayload>(() => ({
    regions: widenedRegions,
    countries: null,
    companies: null,
    statuses: statuses.length ? statuses : null,
    tech_types: techTypes.length ? techTypes : null,
    highlight_countries: countries.length ? countries : null,
    highlight_companies: null,
  }), [widenedRegions, countries, statuses, techTypes]);

  // Compact scope label for the executive insight strip.
  // Prefers the narrowest active filter that still reads naturally.
  const scopeLabel = useMemo(() => {
    if (countries.length === 1) return countries[0];
    if (countries.length > 1) return `${countries.length} countries`;
    if (regions.length === 1) return regions[0];
    if (regions.length > 1) return `${regions.length} regions`;
    return "all regions";
  }, [regions, countries]);

  // ── Load all data on filter change ─────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getGreenKpis(basePayload),
      getGreenMap(mapPayload),
      getGreenScatter(scatterPayload),
      getGreenCapacityMix(mixPayload),
      getGreenHeatmap(heatmapPayload),
    ])
      .then(([k, m, s, mix, h]) => {
        setKpis(k.data);
        setMapData(m.data);
        setScatterData(s.data);
        setMixData(mix.data);
        setHeatmapData(h.data);
        // TEMPORARY DIAG: confirm what backend returned for scatter + mix
        if (typeof window !== "undefined") {
          // eslint-disable-next-line no-console
          console.log("[scatter response]", {
            count: s.data.data.length,
            group_by: s.data.group_by,
            unique_regions: Array.from(new Set(s.data.data.map(r => r.region))),
            first_3: s.data.data.slice(0, 3),
          });
          // eslint-disable-next-line no-console
          console.log("[mix response]", {
            count: mix.data.data.length,
            group_by: mix.data.group_by,
            labels: mix.data.data.map(r => r.label),
          });
        }
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, [basePayload, mapPayload, scatterPayload, mixPayload, heatmapPayload]);

  const kpiStrip = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
      {[
        { label: "CCUS-Enabled Capacity", value: fmtNum(kpis?.pct_ccus, 1), suffix: "%", sub: "Plants flagged for CCS/CCUS · share of total capacity", color: "#7c3aed" },
        { label: "Clay Calcination Capacity", value: fmtNum(kpis?.pct_clay, 1), suffix: "%", sub: "Clay-calcination-enabled plants · share of total capacity", color: "#0891b2" },
        { label: "Low-Clinker Capacity", value: fmtNum(kpis?.pct_low_clinker, 1), suffix: "%", sub: "Plants with clinker/cement ratio ≤ 0.85 · share of total", color: "#d97706" },
        { label: "Future-Ready Capacity", value: fmtNum(kpis?.future_ready_cap, 1), suffix: "Mtpa", sub: "Plants with CCUS, clay calcination, or low clinker dependency", color: "#059669" },
      ].map(k => (
        <div key={k.label} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginBottom: 4 }}>
            {k.value}
            <span style={{ fontSize: 13, fontWeight: 500, color: k.color, opacity: 0.7, marginLeft: 3 }}>{k.suffix}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", marginBottom: 3 }}>{k.label}</div>
          <div style={{ fontSize: 10, color: "#94a3b8" }}>{k.sub}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="The Future of Green Cement"
        subtitle="ESG & Future Tech · Next-generation production pathways — carbon capture, clay calcination, and clinker reduction shaping where green cement scales next."
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* ── Sidebar filters (sticky) ─────────────────────────────────────── */}
        <div style={{
          position: "sticky",
          top: 80,
          alignSelf: "flex-start",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        }}>
          <Sidebar title="Filters">
            <MultiSelect
              label="Region"
              options={meta?.regions ?? []}
              selected={regions}
              onChange={setRegions}
              allLabel="All regions"
              placeholder="All regions"
            />

            <MultiSelect
              label="Country"
              options={scopedCountries}
              selected={countries}
              onChange={setCountries}
              allLabel="All countries"
              placeholder={regions.length ? `All countries in ${regions.length === 1 ? regions[0] : `${regions.length} regions`}` : "All countries"}
            />

            <MultiSelect
              label="Company"
              options={scopedCompanies}
              selected={companies}
              onChange={setCompanies}
              allLabel="All companies"
              placeholder="All companies"
              loading={companiesLoading}
            />

            <MultiSelect
              label="Technology Type"
              options={(meta?.tech_types ?? []).map(t => t.label)}
              selected={
                techTypes
                  .map(v => meta?.tech_types?.find(t => t.value === v)?.label)
                  .filter((s): s is string => !!s)
              }
              onChange={(nextLabels) => {
                // Map labels back to values for the payload
                const lookup = new Map<string, string>(
                  (meta?.tech_types ?? []).map(t => [t.label, t.value])
                );
                setTechTypes(
                  nextLabels
                    .map(l => lookup.get(l))
                    .filter((v): v is string => !!v)
                );
              }}
              allLabel="All technologies"
              placeholder="All technologies"
            />

            <FilterDivider />

            <div>
              <FilterLabel>Operating Status</FilterLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                {(meta?.statuses ?? []).map(s => {
                  const checked = statuses.includes(s);
                  return (
                    <label key={s} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      fontSize: 11.5, color: "#475569", cursor: "pointer", fontFamily: F,
                      padding: "3px 6px", borderRadius: 4,
                      background: checked ? "#fef2f2" : "transparent",
                    }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setStatuses(prev =>
                          e.target.checked ? [...prev, s] : prev.filter(x => x !== s)
                        )}
                        style={{ accentColor: BAIN_RED, cursor: "pointer" }}
                      />
                      <span style={{ textTransform: "capitalize" }}>{s}</span>
                    </label>
                  );
                })}
              </div>
              {statuses.length === 0 && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: F }}>
                  None selected = all statuses
                </div>
              )}
            </div>
          </Sidebar>
        </div>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Error banner */}
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                color: "#991b1b", padding: "8px 12px", borderRadius: 6,
                fontSize: 12, fontFamily: F,
              }}>
                {error}
              </div>
            )}

            {/* KPI strip */}
            {kpiStrip}

            {/* ───── Executive Insight (Bain red gradient) — directly below KPIs ───── */}
            <div style={{
              background: "linear-gradient(135deg, #E11C2A 0%, #8B0E18 100%)",
              color: "#fff", border: "1px solid #8B0E18",
              borderRadius: 10, padding: 16,
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
                {kpis ? (
                  <>
                    Across <strong>{scopeLabel}</strong>, <strong>{fmtNum(kpis.future_ready_cap, 1)} Mtpa</strong>
                    {" "}of cement capacity is future-ready — covering plants with CCUS, clay calcination, or low clinker dependency.
                    {kpis.pct_ccus != null && (
                      <> CCUS reaches <strong>{fmtNum(kpis.pct_ccus, 1)}%</strong> of capacity,</>
                    )}
                    {kpis.pct_clay != null && (
                      <> clay calcination <strong>{fmtNum(kpis.pct_clay, 1)}%</strong>,</>
                    )}
                    {kpis.pct_low_clinker != null && (
                      <> and low-clinker plants <strong>{fmtNum(kpis.pct_low_clinker, 1)}%</strong>.</>
                    )}
                    {" "}Future low-carbon cement is expected to be driven by clinker reduction, fuel flexibility, and carbon capture — with adoption currently concentrated in developed markets.
                  </>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Loading executive summary…</span>
                )}
              </div>
              {kpis && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 10.5, fontStyle: "italic",
                  color: "rgba(255,255,255,0.80)",
                  lineHeight: 1.4,
                }}>
                  Methodology · CCUS / clay / alt-fuel shares are based on plants where GEM records a Yes flag. Low-clinker = clinker/cement ratio ≤ 0.85. Future-Ready capacity is the deduped sum across CCUS, clay calcination, and low-clinker plants (a plant only counts once even if it qualifies on multiple criteria).
                </div>
              )}
            </div>

            {/* Hero — Green Technology Adoption Map */}
            <ChartCard
              title="Green Technology Adoption Map"
              subtitle={`Bubble = cement capacity · Color = primary green technology${mapData?.count != null ? ` · ${mapData.count} plants` : ""
                }`}
            >
              {loading && !mapData ? (
                <LoadingSpinner height={480} />
              ) : (
                <GreenTechMap data={mapData?.data ?? []} height={480} />
              )}
            </ChartCard>

            {/* Two-up: Scatter + Stacked Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ChartCard
                title="Clinker Dependency vs Future-Tech Adoption"
                subtitle="X = clinker / cement · Y = adoption score · Bubble = cement capacity"
                right={
                  <SegmentedControl
                    options={["Region", "Company"]}
                    value={scatterGroupBy === "company" ? "Company" : "Region"}
                    onChange={(v) => setScatterGroupBy(v === "Company" ? "company" : "region")}
                    size="sm"
                  />
                }
              >
                {loading && !scatterData ? (
                  <LoadingSpinner height={420} />
                ) : (
                  <ClinkerVsTechScatter
                    // Force-remount on filter/tab change. Without this, ECharts
                    // can hold stale data across rapid filter changes due to its
                    // internal animation/instance caching.
                    key={`scatter|${scatterGroupBy}|${(regions ?? []).join(",")}|${(countries ?? []).join(",")}|${(companies ?? []).join(",")}`}
                    data={scatterData?.data ?? []}
                    groupBy={scatterGroupBy}
                    showCountry={regions.length > 0}
                    seriesLabelOverride={
                      scatterGroupBy === "company" && countries.length > 0
                        ? (countries.length === 1
                          ? countries[0]
                          : countries.length <= 3
                            ? countries.join(", ")
                            : `${countries.length} countries`)
                        : undefined
                    }
                    height={420}
                  />
                )}
              </ChartCard>

              <ChartCard
                title="Future Capacity Mix"
                subtitle="Legacy · Transitioning · Future-Ready (100% stacked)"
                right={
                  <SegmentedControl
                    options={["Region", "Company"]}
                    value={mixGroupBy === "region" ? "Region" : "Company"}
                    onChange={(v) => setMixGroupBy(v === "Region" ? "region" : "company")}
                    size="sm"
                  />
                }
              >
                {loading && !mixData ? (
                  <LoadingSpinner height={420} />
                ) : (
                  <FutureCapacityMixBar
                    key={`mix|${mixGroupBy}|${(regions ?? []).join(",")}|${(countries ?? []).join(",")}|${(companies ?? []).join(",")}`}
                    data={mixData?.data ?? []}
                    groupBy={mixGroupBy}
                    showCountry={regions.length > 0}
                    height={420}
                  />
                )}
              </ChartCard>
            </div>

            {/* Heatmap */}
            <ChartCard
              title="Future Technology Adoption by Region"
              subtitle="% of regional cement capacity enabled with each green technology"
            >
              {loading && !heatmapData ? (
                <LoadingSpinner height={280} />
              ) : (
                <TechAdoptionHeatmap
                  key={`heat|${(regions ?? []).join(",")}|${(countries ?? []).join(",")}|${(companies ?? []).join(",")}`}
                  data={heatmapData}
                  height={280}
                />
              )}
            </ChartCard>
          </div>

          {/* ── Chat ──────────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ regions, countries, companies, techTypes, statuses }}
              chartContext={{
                page: "future_of_green_cement",
                kpis,
                map_count: mapData?.count,
                scatter_group_by: scatterGroupBy,
                mix_group_by: mixGroupBy,
              }}
              dataScope="gem_tracker"
              title="Green Cement Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Loading spinner ──────────────────────────────────────────────────────────
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