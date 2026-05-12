// PATH: frontend/app/esg-and-future-tech/the-carbon-problem/page.tsx
"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import MultiSelect from "@/components/ui/MultiSelect";
import CarbonStackedBar from "@/components/charts/CarbonStackedBar";
import CarbonBubbleMap from "@/components/charts/CarbonBubbleMap";
import PlantAgeHistogram from "@/components/charts/PlantAgeHistogram";
import {
  getCarbonMeta, getCarbonCompanies, getCarbonKpis, getCarbonHero,
  getCarbonMap, getCarbonIntegratedGrinding, getCarbonPlantAge,
  exportPptx,
} from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type {
  CarbonMeta, CarbonKpis, CarbonHeroData, CarbonMapData,
  CarbonIntegratedGrindingData, CarbonPlantAgeData,
} from "@/lib/types";

const F = "Arial, Helvetica, sans-serif";
const ALL_PLANT_TYPES = "All";

// ── Helpers ──────────────────────────────────────────────────────────────────
const ts = (s: string) => ({ string: s });
const tcNum = (v: number | null | undefined) =>
  v == null ? null : { number: parseFloat(v.toFixed(4)) };

function buildHeroTable(hero: CarbonHeroData, title: string) {
  const header = [null, ts("Dry"), ts("Mixed"), ts("Wet"), ts("Unknown")];
  const body = hero.data.map((row) => [
    ts(row.label),
    tcNum(row.dry),
    tcNum(row.mixed),
    tcNum(row.wet),
    tcNum(row.unknown),
  ]);
  return [
    { name: "GrowthChart", table: [header, ...body] },
    { name: "ChartTitle",  table: [[ts(title)]] },
  ];
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({
  label, value, suffix, accent = false, sublabel, scope,
}: {
  label: string; value: string; suffix?: string;
  accent?: boolean; sublabel?: string; scope?: string;
}) {
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
        {scope && (
          <span style={{
            color: "#94a3b8", textTransform: "none",
            fontWeight: 400, letterSpacing: 0,
          }}> — {scope}</span>
        )}
      </div>
      <div style={{
        fontSize: 22, fontWeight: 700,
        color: accent ? BAIN_RED : "#0f172a", fontFamily: F,
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CarbonProblemPage() {
  const [meta, setMeta] = useState<CarbonMeta | null>(null);

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [countries, setCountries]   = useState<string[]>([]);
  const [companies, setCompanies]   = useState<string[]>([]);
  // Click-driven set: which bars in hero are "active" — drives the plants chart.
  const [clickedCompanies, setClickedCompanies] = useState<string[]>([]);
  const [plantType, setPlantType]   = useState<string>(ALL_PLANT_TYPES);
  const [statuses, setStatuses]     = useState<string[]>([]);

  // Companies list scoped to selected countries
  const [scopedCompanies, setScopedCompanies] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // Top-N sliders
  const MAX_N = 100;
  const [topNCompanies, setTopNCompanies] = useState<number>(MAX_N);
  const [topNPlants, setTopNPlants]       = useState<number>(MAX_N);
  const showAllCompanies = topNCompanies >= MAX_N;
  const showAllPlants    = topNPlants    >= MAX_N;

  // Data
  const [kpis, setKpis]                 = useState<CarbonKpis | null>(null);
  const [hero, setHero]                 = useState<CarbonHeroData | null>(null);
  const [heroPlants, setHeroPlants]     = useState<CarbonHeroData | null>(null);
  const [mapData, setMapData]           = useState<CarbonMapData | null>(null);
  const [intGrindData, setIntGrindData] = useState<CarbonIntegratedGrindingData | null>(null);
  const [plantAge, setPlantAge]         = useState<CarbonPlantAgeData | null>(null);

  // UI
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // ── Load meta once ──────────────────────────────────────────────────────────
  useEffect(() => {
    getCarbonMeta()
      .then(r => setMeta(r.data))
      .catch((e: Error) => setError(e.message));
  }, []);

  // ── Refetch scoped company list whenever countries change ──────────────────
  useEffect(() => {
    setCompaniesLoading(true);
    getCarbonCompanies(countries.length ? countries : null)
      .then(r => {
        const allowed = new Set(r.data.companies);
        setScopedCompanies(r.data.companies);
        // Drop selections + click-highlights that aren't in the new scope
        setCompanies(prev => prev.filter(c => allowed.has(c)));
        setClickedCompanies(prev => prev.filter(c => allowed.has(c)));
        setCompaniesLoading(false);
      })
      .catch((e: Error) => { setError(e.message); setCompaniesLoading(false); });
  }, [countries]);

  // ── Build payloads ─────────────────────────────────────────────────────────
  const chartPayload = useMemo(() => ({
    countries:  countries.length ? countries : null,
    companies:  companies.length ? companies : null,
    plant_type: plantType === ALL_PLANT_TYPES ? null : plantType,
    statuses:   statuses.length > 0 ? statuses : null,
  }), [countries, companies, plantType, statuses]);

  const kpiPayload = useMemo(() => ({
    countries:  countries.length ? countries : null,
    statuses:   statuses.length > 0 ? statuses : null,
  }), [countries, statuses]);

  const countryScopeLabel = useMemo(() => {
    if (countries.length === 0) return "All countries";
    if (countries.length === 1) return countries[0];
    return "Selected countries";
  }, [countries]);

  const hasClickedBars = clickedCompanies.length > 0;

  // ── Load all data when filters change ──────────────────────────────────────
  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);

    const companiesTopN = showAllCompanies ? 9999 : topNCompanies;
    const plantsTopN    = showAllPlants    ? 9999 : topNPlants;

    // Hero (companies, left): respects multi-select via `companies`
    const heroCompaniesPayload = {
      ...chartPayload, top_n: companiesTopN, axis: "company" as const,
    };

    // Plants (right): only loaded when bars are clicked. Filter by clickedCompanies.
    const heroPlantsPayload = hasClickedBars
      ? {
          ...chartPayload,
          companies: clickedCompanies,   // ← override the multi-select with click set
          top_n: plantsTopN,
          axis: "plant" as const,
        }
      : null;

    // Map / I-G / Age — use clickedCompanies if present (focus those plants),
    // otherwise the multi-select scope.
    const detailPayload = hasClickedBars
      ? { ...chartPayload, companies: clickedCompanies }
      : chartPayload;

    const requests: Promise<unknown>[] = [
      getCarbonKpis(kpiPayload),
      getCarbonHero(heroCompaniesPayload),
      heroPlantsPayload
        ? getCarbonHero(heroPlantsPayload)
        : Promise.resolve({ data: null as CarbonHeroData | null }),
      getCarbonMap(detailPayload),
      getCarbonIntegratedGrinding(detailPayload),
      getCarbonPlantAge(detailPayload),
    ];

    Promise.all(requests).then((results) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [k, hc, hp, m, ig, pa] = results as any[];
      setKpis(k.data);
      setHero(hc.data);
      setHeroPlants(hp.data);
      setMapData(m.data);
      setIntGrindData(ig.data);
      setPlantAge(pa.data);
      setLoading(false);
    }).catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, [chartPayload, kpiPayload, hasClickedBars, clickedCompanies, topNCompanies, topNPlants, showAllCompanies, showAllPlants]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Bar click toggles in/out of clickedCompanies ──────────────────────────
  const handleBarToggle = (label: string) => {
    if (!scopedCompanies.includes(label)) return;
    setClickedCompanies(prev =>
      prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]
    );
  };

  const handleClearClicks = () => setClickedCompanies([]);

  const countrySlug = countries.length === 0
    ? "all_countries"
    : countries.length === 1
      ? countries[0].replace(/\s+/g, "_")
      : `${countries.length}_countries`;

  // ── PPT exports ────────────────────────────────────────────────────────────
  const exportChart = async (
    which: "hero" | "integrated" | "age" | "deck",
    template: string,
    builder: () => { name: string; table: unknown[][] }[],
    filename: string,
  ) => {
    setExporting(which);
    try {
      const data = builder();
      const res  = await exportPptx({ template, data, filename });
      downloadBlob(res.data as Blob, filename);
    } catch (e) {
      alert(`PPT export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(null);
    }
  };

  const kpiStrip = (
    <div style={{ display: "flex", gap: 12 }}>
      <KpiTile
        label="Total Cement Capacity"
        scope={countryScopeLabel}
        value={fmtNum(kpis?.total_cement_capacity, 1)}
        suffix="Mtpa"
      />
      <KpiTile
        label="Total Clinker Capacity"
        scope={countryScopeLabel}
        value={fmtNum(kpis?.total_clinker_capacity, 1)}
        suffix="Mtpa"
      />
      <KpiTile
        label="% Wet Process Capacity"
        scope={countryScopeLabel}
        value={fmtNum(kpis?.pct_wet_capacity, 1)}
        suffix="%"
        accent={(kpis?.pct_wet_capacity ?? 0) > 20}
        sublabel="Higher = elevated transition risk"
      />
      <KpiTile
        label="% Plants Using Alt. Fuel"
        scope={countryScopeLabel}
        value={fmtNum(kpis?.pct_alt_fuel, 1)}
        suffix="%"
        sublabel="Transition indicator"
      />
    </div>
  );

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title="The Carbon Problem"
        subtitle="ESG & Future Tech · Cement remains one of the world's most carbon-intensive industries, driven by clinker-heavy production and legacy manufacturing infrastructure."
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* ── Sidebar filters ─────────────────────────────────────────────── */}
        <Sidebar title="Filters">

          <MultiSelect
            label="Country"
            options={meta?.countries ?? []}
            selected={countries}
            onChange={(next: string[]) => {
              setCountries(next);
              setClickedCompanies([]);   // clear bar selections on country change
            }}
            allLabel="All countries"
            placeholder="All countries"
          />

          <MultiSelect
            label="Company"
            options={scopedCompanies}
            selected={companies}
            onChange={(next: string[]) => {
              setCompanies(next);
              // Drop click-highlights that fall outside the new multi-select.
              // (A company you no longer want in the hero shouldn't drive plants.)
              if (next.length > 0) {
                const allowed = new Set(next);
                setClickedCompanies(prev => prev.filter(c => allowed.has(c)));
              }
            }}
            allLabel="All companies"
            placeholder="All companies"
            loading={companiesLoading}
          />

          <div>
            <FilterLabel>Plant Type</FilterLabel>
            <FilterSelect value={plantType} onChange={e => setPlantType(e.target.value)}>
              <option>{ALL_PLANT_TYPES}</option>
              {(meta?.plant_types ?? []).map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </FilterSelect>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Top Companies</FilterLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="range"
                min={5}
                max={MAX_N}
                step={1}
                value={topNCompanies}
                onChange={e => setTopNCompanies(Number(e.target.value))}
                style={{ flex: 1, accentColor: BAIN_RED, cursor: "pointer" }}
              />
              <div style={{
                minWidth: 38, textAlign: "right",
                fontSize: 11, fontWeight: 600, color: "#1e293b", fontFamily: F,
              }}>
                {showAllCompanies ? `${MAX_N}+` : topNCompanies}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <FilterLabel>Top Plants</FilterLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <input
                type="range"
                min={5}
                max={MAX_N}
                step={1}
                value={topNPlants}
                onChange={e => setTopNPlants(Number(e.target.value))}
                style={{ flex: 1, accentColor: BAIN_RED, cursor: "pointer" }}
              />
              <div style={{
                minWidth: 38, textAlign: "right",
                fontSize: 11, fontWeight: 600, color: "#1e293b", fontFamily: F,
              }}>
                {showAllPlants ? `${MAX_N}+` : topNPlants}
              </div>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, fontFamily: F }}>
              {MAX_N}+ shows all · use chart slider/scroll to zoom
            </div>
          </div>

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

          <FilterDivider />

          <button
            onClick={() => exportChart(
              "deck",
              "carbon_deck",
              () => buildHeroTable(hero!, `The Carbon Problem — ${countryScopeLabel}`),
              `carbon_problem_${countrySlug}.pptx`,
            )}
            disabled={!hero || exporting === "deck"}
            style={{
              width: "100%", padding: "8px 10px",
              background: BAIN_RED, color: "#fff",
              border: "none", borderRadius: 6,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: F, opacity: !hero || exporting === "deck" ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {exporting === "deck" ? "Exporting..." : "Export All to Deck"}
          </button>
        </Sidebar>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, padding: "10px 14px",
                color: "#b91c1c", fontSize: 13, fontFamily: F, marginBottom: 12,
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>{kpiStrip}</div>

            {/* ───── Top row: Companies (left) + Plants (right) ───── */}
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 16 }}>

              {/* Companies (left) */}
              <div style={{
                background: "#fff", border: "1px solid #e9ecef",
                borderRadius: 10, padding: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F,
                      flexWrap: "wrap",
                    }}>
                      <span>Wet vs Dry Capacity Mix · Companies</span>
                      {hasClickedBars && (
                        <button
                          onClick={handleClearClicks}
                          title="Clear all bar selections"
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 3,
                            background: "#fff1f1", color: BAIN_RED,
                            border: `1px solid ${BAIN_RED}`,
                            borderRadius: 4, padding: "2px 7px",
                            fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: F,
                            lineHeight: 1, transition: "background 0.15s",
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#fee2e2"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#fff1f1"; }}
                        >
                          Clear ({clickedCompanies.length})
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                      {showAllCompanies ? "All companies" : `Top ${topNCompanies}`} in {countryScopeLabel}
                      {hasClickedBars
                        ? ` · ${clickedCompanies.length} selected · click again to remove · double-click chart or empty space to clear`
                        : " — click bars to select companies and see their plants on the right"}
                      {hero && hero.data.length > 12 && " · drag the slider below to zoom"}
                    </div>
                  </div>
                  <ChartActions
                    onCsv={() => {
                      if (!hero) return;
                      const rows = hero.data.map(r =>
                        `${r.label.replace(/,/g, " ")},${r.dry},${r.mixed},${r.wet},${r.unknown},${r.total}`
                      ).join("\n");
                      const blob = new Blob([`Label,Dry,Mixed,Wet,Unknown,Total\n${rows}`], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `carbon_hero_${countrySlug}.csv`;
                      a.click();
                    }}
                    csvDisabled={!hero}
                    onPpt={() => exportChart(
                      "hero",
                      "carbon_hero",
                      () => buildHeroTable(hero!, `Wet vs Dry Capacity — ${countryScopeLabel}`),
                      `carbon_hero_${countrySlug}.pptx`,
                    )}
                    pptLoading={exporting === "hero"}
                    pptDisabled={!hero}
                    showPpt
                  />
                </div>

                {loading && !hero ? (
                  <LoadingSpinner height={460} />
                ) : (
                  <CarbonStackedBar
                    data={hero?.data ?? []}
                    xAxisType="company"
                    onBarToggle={handleBarToggle}
                    onClearAll={handleClearClicks}
                    highlightLabels={clickedCompanies}
                    height={460}
                  />
                )}

                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: F, lineHeight: 1.4 }}>
                  Wet-process plants are significantly more energy and carbon intensive than modern dry-process facilities,
                  creating elevated transition risk under tightening carbon regulations.
                </p>
              </div>

              {/* Plants (right) */}
              <div style={{
                background: "#fff", border: "1px solid #e9ecef",
                borderRadius: 10, padding: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                      Wet vs Dry Capacity Mix · Plants
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                      {hasClickedBars
                        ? `${clickedCompanies.length} compan${clickedCompanies.length === 1 ? "y" : "ies"} selected · ${showAllPlants ? "all plants" : `top ${topNPlants}`}`
                        : "No companies selected"}
                      {!hasClickedBars && heroPlants && heroPlants.data.length > 12 && " · drag slider to zoom"}
                    </div>
                  </div>
                  <ChartActions
                    onCsv={() => {
                      if (!heroPlants) return;
                      const rows = heroPlants.data.map(r =>
                        `${r.label.replace(/,/g, " ")},${r.dry},${r.mixed},${r.wet},${r.unknown},${r.total}`
                      ).join("\n");
                      const blob = new Blob([`Plant,Dry,Mixed,Wet,Unknown,Total\n${rows}`], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `carbon_plants_${countrySlug}.csv`;
                      a.click();
                    }}
                    csvDisabled={!heroPlants}
                    onPpt={() => exportChart(
                      "hero",
                      "carbon_hero",
                      () => buildHeroTable(heroPlants!, `Plant Capacity Mix — ${countryScopeLabel}`),
                      `carbon_plants_${countrySlug}.pptx`,
                    )}
                    pptLoading={exporting === "hero"}
                    pptDisabled={!heroPlants}
                    showPpt
                  />
                </div>

                {!hasClickedBars ? (
                  <PlantsEmptyState height={460} />
                ) : loading && !heroPlants ? (
                  <LoadingSpinner height={460} />
                ) : (
                  <CarbonStackedBar
                    data={heroPlants?.data ?? []}
                    xAxisType="plant"
                    height={460}
                  />
                )}

                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: F }}>
                  {hasClickedBars
                    ? `Plant-level wet/dry mix for: ${clickedCompanies.slice(0, 3).join(", ")}${clickedCompanies.length > 3 ? `, +${clickedCompanies.length - 3} more` : ""}.`
                    : "Click one or more company bars on the left to populate this chart."}
                </p>
              </div>
            </div>

            {/* ───── Map full-width ───── */}
            <div style={{
              background: "#fff", border: "1px solid #e9ecef",
              borderRadius: 10, padding: 16, marginBottom: 16,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                    Carbon Exposure Map
                    {hasClickedBars && (
                      <span style={{ color: BAIN_RED, fontWeight: 600 }}> · {clickedCompanies.length} selected</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                    Bubble size = clinker capacity · {mapData?.count ?? 0} plants
                  </div>
                </div>
              </div>

              {loading && !mapData ? (
                <LoadingSpinner height={460} />
              ) : (
                <CarbonBubbleMap data={mapData?.data ?? []} height={460} />
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: F }}>
                Source: GEM Global Cement & Concrete Tracker (Jul 2025)
              </p>
            </div>

            {/* ───── Integrated/Grinding + Plant Age ───── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

              <div style={{
                background: "#fff", border: "1px solid #e9ecef",
                borderRadius: 10, padding: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                      Integrated vs Grinding Plants
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                      Capacity by plant type · {countryScopeLabel}
                    </div>
                  </div>
                  <ChartActions
                    onCsv={() => {
                      if (!intGrindData?.data?.length) return;
                      const rows = intGrindData.data.map(r =>
                        `${r.plant_type},${r.capacity}`
                      ).join("\n");
                      const blob = new Blob([`Plant Type,Capacity (Mtpa)\n${rows}`], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `carbon_integrated_grinding_${countrySlug}.csv`;
                      a.click();
                    }}
                    csvDisabled={!intGrindData?.data?.length}
                    onPpt={() => exportChart(
                      "integrated",
                      "carbon_integrated",
                      () => {
                        const header = [null, ts("Capacity (Mtpa)")];
                        const body = (intGrindData?.data ?? []).map(r =>
                          [ts(r.plant_type), tcNum(r.capacity)]
                        );
                        return [{ name: "GrowthChart", table: [header, ...body] }];
                      },
                      `carbon_integrated_grinding_${countrySlug}.pptx`,
                    )}
                    pptLoading={exporting === "integrated"}
                    pptDisabled={!intGrindData?.data?.length}
                    showPpt
                  />
                </div>

                {loading && !intGrindData ? (
                  <LoadingSpinner height={320} />
                ) : intGrindData?.data?.length ? (
                  <IntegratedGrindingBar
                    data={intGrindData.data.map(d => ({
                      label: d.plant_type.charAt(0).toUpperCase() + d.plant_type.slice(1),
                      value: d.capacity,
                    }))}
                    height={320}
                  />
                ) : (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    height: 320, color: "#94a3b8", fontSize: 13, fontFamily: F,
                  }}>
                    No data for the selected filters
                  </div>
                )}
              </div>

              <div style={{
                background: "#fff", border: "1px solid #e9ecef",
                borderRadius: 10, padding: 16,
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)", minWidth: 0,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                      Plant Age Distribution
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: F, marginTop: 2 }}>
                      Older plants carry higher transition risk
                    </div>
                  </div>
                  <ChartActions
                    onCsv={() => {
                      if (!plantAge?.data?.length) return;
                      const rows = plantAge.data.map(r =>
                        `${r.bucket},${r.count},${r.capacity}`
                      ).join("\n");
                      const blob = new Blob([`Age Bucket,Plant Count,Capacity (Mtpa)\n${rows}`], { type: "text/csv" });
                      const a = document.createElement("a");
                      a.href = URL.createObjectURL(blob);
                      a.download = `carbon_plant_age_${countrySlug}.csv`;
                      a.click();
                    }}
                    csvDisabled={!plantAge?.data?.length}
                    onPpt={() => exportChart(
                      "age",
                      "carbon_age",
                      () => {
                        const header = [null, ts("Plant count"), ts("Capacity (Mtpa)")];
                        const body = (plantAge?.data ?? []).map(r =>
                          [ts(r.bucket), tcNum(r.count), tcNum(r.capacity)]
                        );
                        return [{ name: "GrowthChart", table: [header, ...body] }];
                      },
                      `carbon_plant_age_${countrySlug}.pptx`,
                    )}
                    pptLoading={exporting === "age"}
                    pptDisabled={!plantAge?.data?.length}
                    showPpt
                  />
                </div>

                {loading && !plantAge ? (
                  <LoadingSpinner height={320} />
                ) : (
                  <PlantAgeHistogram
                    data={plantAge?.data ?? []}
                    referenceYear={plantAge?.reference_year ?? new Date().getFullYear()}
                    height={320}
                  />
                )}
              </div>
            </div>

            {/* ───── Executive Insight (Bain red gradient) ───── */}
            <div style={{
              background: "linear-gradient(135deg, #E11C2A 0%, #8B0E18 100%)",
              color: "#fff", border: "1px solid #8B0E18",
              borderRadius: 10, padding: 18, marginBottom: 16,
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
                    <strong>{countryScopeLabel}</strong> has <strong>{fmtNum(kpis.total_cement_capacity, 1)} Mtpa</strong> of cement capacity
                    across <strong>{kpis.plant_count}</strong> plants.
                    {kpis.pct_wet_capacity != null && (
                      <> About <strong>{fmtNum(kpis.pct_wet_capacity, 1)}%</strong> of typed capacity is wet-process — {kpis.pct_wet_capacity > 20 ? "an elevated" : "a moderate"} transition risk.</>
                    )}
                    {kpis.pct_alt_fuel != null && (
                      <> Alternative fuel adoption sits at <strong>{fmtNum(kpis.pct_alt_fuel, 1)}%</strong> of plants.</>
                    )}
                  </>
                ) : (
                  <span style={{ color: "rgba(255,255,255,0.7)" }}>Loading executive summary…</span>
                )}
              </div>
            </div>
          </div>

          {/* Chat panel */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ countries, companies, clicked_companies: clickedCompanies, plant_type: plantType, statuses }}
              chartContext={{
                page: "carbon-problem",
                kpis,
                hero_summary: hero?.data?.slice(0, 5),
                plant_count: mapData?.count,
              }}
              dataScope="carbon"
              title="ESG Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Integrated/Grinding bar — two distinct colors with matching legend ──────
function IntegratedGrindingBar({
  data, height = 320,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  // Bain red = integrated (carbon-heavy, full process)
  // Bain green = grinding (downstream-only, lighter footprint)
  const COLOR_INTEGRATED = "#E11C2A";  // Bain red
  const COLOR_GRINDING   = "#2D7D46";  // Bain green
  const COLOR_OTHER      = "#94a3b8";  // gray fallback (e.g. "unknown")

  const colorFor = (label: string): string => {
    const l = label.toLowerCase();
    if (l === "integrated") return COLOR_INTEGRATED;
    if (l === "grinding")   return COLOR_GRINDING;
    return COLOR_OTHER;
  };

  // Series-per-category so legend swatches lock to the right colors and toggling works.
  // Each series only carries values for bars matching its label; others are null.
  const seriesDefs: { key: "integrated" | "grinding" | "other"; label: string; color: string }[] = [
    { key: "integrated", label: "Integrated", color: COLOR_INTEGRATED },
    { key: "grinding",   label: "Grinding",   color: COLOR_GRINDING   },
    { key: "other",      label: "Other",      color: COLOR_OTHER      },
  ];

  // Determine which series actually have data (so we don't show empty legend entries)
  const presentKeys = new Set<string>();
  data.forEach(d => {
    const l = d.label.toLowerCase();
    if (l === "integrated" || l === "grinding") presentKeys.add(l);
    else presentKeys.add("other");
  });

  const activeSeries = seriesDefs.filter(s => presentKeys.has(s.key));

  const option = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#fff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [10, 14],
      textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
      extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
      confine: true,
      formatter: (params: { axisValueLabel: string; value: number | null; marker: string; seriesName: string }[]) => {
        // Only one series will have a non-null value per bar
        const active = params.find(p => p.value != null);
        if (!active) return "";
        return `<div style="font-weight:700;margin-bottom:4px;color:#0f172a">${active.axisValueLabel}</div>
          <div style="display:flex;justify-content:space-between;gap:16px;font-size:12px">
            <span>${active.marker} ${active.seriesName}</span>
            <span style="font-weight:600">${(active.value ?? 0).toFixed(2)} Mtpa</span>
          </div>`;
      },
    },
    legend: {
      bottom: 4,
      itemGap: 18,
      textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
      data: activeSeries.map(s => ({
        name: s.label,
        itemStyle: { color: s.color },
      })),
    },
    xAxis: {
      type: "category",
      data: data.map(d => d.label),
      axisLabel: { fontSize: 11, color: "#475569", fontFamily: F },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: "Capacity (Mtpa)",
      nameLocation: "end",
      nameGap: 8,
      nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: F },
      axisLabel: { fontSize: 11, color: "#94a3b8", fontFamily: F },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    series: activeSeries.map(s => ({
      name: s.label,
      type: "bar",
      data: data.map(d => {
        const matchesThisSeries =
          (s.key === "integrated" && d.label.toLowerCase() === "integrated") ||
          (s.key === "grinding"   && d.label.toLowerCase() === "grinding")   ||
          (s.key === "other"      && d.label.toLowerCase() !== "integrated" && d.label.toLowerCase() !== "grinding");
        return matchesThisSeries
          ? { value: d.value, itemStyle: { color: colorFor(d.label), borderRadius: [3, 3, 0, 0] } }
          : null;   // null = bar slot is empty for this series
      }),
      barMaxWidth: 80,
    })),
    grid: { left: 60, right: 24, top: 32, bottom: 56 },
    animation: true,
    animationDuration: 450,
  };
  return (
    <ReactECharts
      option={option}
      style={{ height }}
      notMerge
      opts={{ renderer: "canvas" }}
    />
  );
}

// ── Empty state for plants chart ─────────────────────────────────────────────
function PlantsEmptyState({ height = 460 }: { height?: number }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      height, gap: 10, color: "#94a3b8", fontFamily: F, textAlign: "center",
      padding: 20,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: "#fef2f2", color: BAIN_RED,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 700,
      }}>
        ←
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>
        Click bars to see plants
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", maxWidth: 300, lineHeight: 1.45 }}>
        Select one or more companies in the chart on the left to see their plant-level wet/dry capacity mix here.
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