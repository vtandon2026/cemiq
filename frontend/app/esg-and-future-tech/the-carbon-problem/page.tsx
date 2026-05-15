// PATH: frontend/app/esg-and-future-tech/the-carbon-problem/page.tsx
"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ReactECharts from "echarts-for-react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import MultiSelect from "@/components/ui/MultiSelect";
import CarbonStackedBar, { type CarbonStackedBarHandle } from "@/components/charts/CarbonStackedBar";
import CarbonBubbleMap from "@/components/charts/CarbonBubbleMap";
import PlantAgeHistogram from "@/components/charts/PlantAgeHistogram";
import {
  getCarbonMeta, getCarbonCompanies, getCarbonKpis, getCarbonHero,
  getCarbonMap, getCarbonIntegratedGrinding, getCarbonPlantAge,
  exportPptx, exportPptxDeck,
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

// ── PPT TABLE BUILDERS ────────────────────────────────────────────────────────
// Two distinct shapes:
//
//  1) BarChart (THINKCELL_TEMPLATE_BAR.pptx, element "BarChart")
//     For stacked bar charts where each x-axis bar is a label, and each row
//     after the header is one stack segment (Dry / Mixed / Wet / Unknown):
//
//        | (cat)  | UltraTech | ACC  | Shree | ...
//        | Dry    |   12.5    |  6.1 |  4.2  | ...
//        | Mixed  |    2.3    |  0.8 |  0.1  | ...
//        | Wet    |    0.0    |  0.0 |  0.0  | ...
//        | Unknown|  145.7    | 32.0 | 18.5  | ...
//
//  2) GrowthChart (thinkcell_template_growth_newwww.pptx, element "GrowthChart")
//     For combo bar+line where each x-axis category gets two values
//     (a bar value and a line value):
//
//        |        | <10y | 10-20y | 20-30y | 30-50y | 50+y
//        | Bar    |   3  |   12   |   25   |   18   |  9
//        | Line   |  8.2 |  31.4  |  64.1  |  42.7  | 22.0
//
// Cell encoding (think-cell ppttc): use {string:"..."} for text and
// {number:N} for numerics. `null` for the top-left blank corner cell.

function buildBarChartTable(hero: CarbonHeroData, title: string) {
  // X-axis labels along the top header row (one cell per bar)
  const header = [null, ...hero.data.map(r => ts(r.label))];

  // One stack-row per production-type category. Each row carries one number
  // per bar (or null if the bar has no value for that segment).
  //
  // NOTE: 'Unknown' is intentionally NOT included in the PPT export — the
  // chart shows it (so totals reconcile to the KPI tiles), but for a PPT
  // deliverable we want only the meaningful typed categories so the slide
  // tells a clearer story. See the on-screen note under each chart.
  const dryRow = [ts("Dry"), ...hero.data.map(r => tcNum(r.dry))];
  const mixedRow = [ts("Mixed"), ...hero.data.map(r => tcNum(r.mixed))];
  const wetRow = [ts("Wet"), ...hero.data.map(r => tcNum(r.wet))];

  return [
    { name: "BarChart", table: [header, dryRow, mixedRow, wetRow] },
    { name: "ChartTitle", table: [[ts(title)]] },
  ];
}

function buildIntegratedGrindingTable(
  data: { plant_type: string; capacity: number }[],
  title: string,
) {
  // Each plant_type is a separate bar on the x-axis. Single-stack (one row).
  // Bain colors are baked into the template's series ordering; we just send values.
  const header = [null, ...data.map(r => ts(
    // Title-case display
    r.plant_type.charAt(0).toUpperCase() + r.plant_type.slice(1)
  ))];
  const capRow = [ts("Capacity"), ...data.map(r => tcNum(r.capacity))];

  return [
    { name: "BarChart", table: [header, capRow] },
    { name: "ChartTitle", table: [[ts(title)]] },
  ];
}

function buildPlantAgeGrowthTable(
  data: { bucket: string; count: number; capacity: number }[],
  title: string,
) {
  // Header = age buckets. Bar series = plant count. Line series = capacity.
  const header = [null, ...data.map(r => ts(r.bucket))];
  const countRow = [ts("Plants"), ...data.map(r => tcNum(r.count))];
  const capRow = [ts("Capacity"), ...data.map(r => tcNum(r.capacity))];

  return [
    { name: "GrowthChart", table: [header, countRow, capRow] },
    { name: "ChartTitle", table: [[ts(title)]] },
  ];
}

/**
 * Return a CarbonHeroData containing only rows within [startIdx, endIdx] of
 * the source. When `range` is null, returns the source unchanged. Inclusive bounds.
 */
function sliceHero(
  hero: CarbonHeroData,
  range: { startIdx: number; endIdx: number; total: number } | null,
): CarbonHeroData {
  if (!range || !hero.data?.length) return hero;
  const sliced = hero.data.slice(range.startIdx, range.endIdx + 1);
  return { ...hero, data: sliced };
}

/**
 * Build the confirmation message body for a zoomed-chart PPT export.
 * Caller wraps with the actual modal interaction.
 */
function zoomedExportMessage(
  range: { startIdx: number; endIdx: number; total: number },
  chartName: string,
): string {
  const visible = range.endIdx - range.startIdx + 1;
  return (
    `Exporting ${visible} of ${range.total} bars from "${chartName}".\n\n` +
    `Only the currently visible (zoomed) portion will be in the PPT.\n` +
    `Click the reset icon in the chart's top-right corner first if you want to export all bars.`
  );
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
  const [countries, setCountries] = useState<string[]>([]);
  const [companies, setCompanies] = useState<string[]>([]);
  // Click-driven set: which bars in hero are "active" — drives the plants chart.
  const [clickedCompanies, setClickedCompanies] = useState<string[]>([]);
  const [plantType, setPlantType] = useState<string>(ALL_PLANT_TYPES);
  const [statuses, setStatuses] = useState<string[]>([]);

  // Companies list scoped to selected countries
  const [scopedCompanies, setScopedCompanies] = useState<string[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  // ── Chart zoom plumbing ────────────────────────────────────────────────────
  // Each zoomable chart exposes an imperative handle so the page can call
  // .resetZoom() and .getVisibleRange() on it. We mirror zoom state into
  // React so the "Reset zoom" button can show conditionally.
  // Integrated/Grinding has at most 3 categories — no need for zoom.
  type ZoomRange = { startIdx: number; endIdx: number; total: number };
  const heroRef = useRef<CarbonStackedBarHandle>(null);
  const plantsRef = useRef<CarbonStackedBarHandle>(null);

  const [heroZoom, setHeroZoom] = useState<ZoomRange | null>(null);
  const [plantsZoom, setPlantsZoom] = useState<ZoomRange | null>(null);

  // Helpers — is the chart actually zoomed (i.e. not showing all rows)?
  const isZoomedRange = (z: ZoomRange | null) =>
    !!z && (z.startIdx > 0 || z.endIdx < z.total - 1);
  const heroIsZoomed = isZoomedRange(heroZoom);
  const plantsIsZoomed = isZoomedRange(plantsZoom);

  // Top-N is no longer user-controllable — sliders were removed in favor of
  // chart-level zoom. Backend still wants a cap, so use a very high number to
  // effectively return all rows.
  const TOP_N_ALL = 9999;

  // Data
  const [kpis, setKpis] = useState<CarbonKpis | null>(null);
  const [hero, setHero] = useState<CarbonHeroData | null>(null);
  const [heroPlants, setHeroPlants] = useState<CarbonHeroData | null>(null);
  const [mapData, setMapData] = useState<CarbonMapData | null>(null);
  const [intGrindData, setIntGrindData] = useState<CarbonIntegratedGrindingData | null>(null);
  const [plantAge, setPlantAge] = useState<CarbonPlantAgeData | null>(null);

  // UI
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  // ── In-app confirm modal (replaces window.confirm) ────────────────────────
  // State holds the active prompt + a resolver. callers `await confirmModal(...)`
  // which resolves to true/false based on which button the user clicks.
  type ConfirmState = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    resolve: ((value: boolean) => void) | null;
  };
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false, title: "", message: "", resolve: null,
  });

  const confirmModal = useCallback((opts: {
    title: string; message: string;
    confirmLabel?: string; cancelLabel?: string;
  }): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({
        open: true,
        title: opts.title,
        message: opts.message,
        confirmLabel: opts.confirmLabel,
        cancelLabel: opts.cancelLabel,
        resolve,
      });
    });
  }, []);

  const handleConfirmResult = (result: boolean) => {
    confirmState.resolve?.(result);
    setConfirmState(s => ({ ...s, open: false, resolve: null }));
  };

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
    countries: countries.length ? countries : null,
    companies: companies.length ? companies : null,
    plant_type: plantType === ALL_PLANT_TYPES ? null : plantType,
    statuses: statuses.length > 0 ? statuses : null,
  }), [countries, companies, plantType, statuses]);

  const kpiPayload = useMemo(() => ({
    countries: countries.length ? countries : null,
    statuses: statuses.length > 0 ? statuses : null,
  }), [countries, statuses]);

  const countryScopeLabel = useMemo(() => {
    if (countries.length === 0) return "All countries";
    if (countries.length === 1) return countries[0];
    return "Selected countries";
  }, [countries]);

  const hasClickedBars = clickedCompanies.length > 0;

  // ── Active-filter pills per chart ──────────────────────────────────────────
  // Each chart honors a different subset of filters; pills mirror exactly what
  // affects that chart's data. Empty/default filters are omitted (no pill).
  const countryPill: PillSpec | null = useMemo(() =>
    countries.length === 0 ? null
      : { label: "Country", value: formatList(countries) },
    [countries]);

  const companiesMultiPill: PillSpec | null = useMemo(() =>
    companies.length === 0 ? null
      : { label: "Companies", value: companies.length === 1 ? companies[0] : `${companies.length} selected` },
    [companies]);

  const plantTypePill: PillSpec | null = useMemo(() =>
    plantType === ALL_PLANT_TYPES ? null
      : { label: "Plant type", value: plantType.charAt(0).toUpperCase() + plantType.slice(1) },
    [plantType]);

  const statusesPill: PillSpec | null = useMemo(() =>
    statuses.length === 0 ? null
      : { label: "Status", value: statuses.length === 1 ? statuses[0] : `${statuses.length} active` },
    [statuses]);

  const clickedPill: PillSpec | null = useMemo(() =>
    clickedCompanies.length === 0 ? null
      : {
        label: "Highlighted",
        value: clickedCompanies.length === 1
          ? clickedCompanies[0]
          : `${clickedCompanies.length} companies`,
      },
    [clickedCompanies]);

  // Per-chart pill arrays. Filter out `null` so the row only contains active ones.
  // (Order is intentional: country first, then narrowing-from-broad-to-specific.)
  const companiesChartPills = useMemo(
    () => [countryPill, companiesMultiPill, plantTypePill, statusesPill].filter((p): p is PillSpec => p !== null),
    [countryPill, companiesMultiPill, plantTypePill, statusesPill],
  );
  const plantsChartPills = useMemo(
    () => [countryPill, clickedPill, plantTypePill, statusesPill].filter((p): p is PillSpec => p !== null),
    [countryPill, clickedPill, plantTypePill, statusesPill],
  );
  const mapChartPills = useMemo(
    () => [countryPill, companiesMultiPill, clickedPill, plantTypePill, statusesPill].filter((p): p is PillSpec => p !== null),
    [countryPill, companiesMultiPill, clickedPill, plantTypePill, statusesPill],
  );
  const intGrindChartPills = useMemo(
    () => [countryPill, companiesMultiPill, clickedPill, statusesPill].filter((p): p is PillSpec => p !== null),
    [countryPill, companiesMultiPill, clickedPill, statusesPill],
  );
  const plantAgeChartPills = useMemo(
    () => [countryPill, companiesMultiPill, clickedPill, plantTypePill, statusesPill].filter((p): p is PillSpec => p !== null),
    [countryPill, companiesMultiPill, clickedPill, plantTypePill, statusesPill],
  );

  // ── Load all data when filters change ──────────────────────────────────────
  const loadAll = useCallback(() => {
    setLoading(true);
    setError(null);

    const companiesTopN = TOP_N_ALL;
    const plantsTopN = TOP_N_ALL;

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
      // Fresh data means the chart's internal zoom resets to 0–100; mirror that
      // in React state so the "Reset zoom" button doesn't stay shown stale.
      setHeroZoom(null);
      setPlantsZoom(null);
      setLoading(false);
    }).catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, [chartPayload, kpiPayload, hasClickedBars, clickedCompanies]);

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
    which: "hero" | "plants" | "integrated" | "age" | "deck",
    template: string,
    builder: () => { name: string; table: unknown[][] }[],
    filename: string,
  ) => {
    setExporting(which);
    try {
      const data = builder();
      const res = await exportPptx({ template, data, filename });
      downloadBlob(res.data as Blob, filename);
    } catch (e) {
      alert(`PPT export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setExporting(null);
    }
  };

  const kpiStrip = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 0 }}>
      {[
        {
          label: "Total Cement Capacity",
          value: fmtNum(kpis?.total_cement_capacity, 1),
          suffix: "Mtpa",
          sub: countryScopeLabel,
          color: "#E11C2A",
        },
        {
          label: "Total Clinker Capacity",
          value: fmtNum(kpis?.total_clinker_capacity, 1),
          suffix: "Mtpa",
          sub: countryScopeLabel,
          color: "#E11C2A",
        },
        {
          label: "Wet Process Capacity",
          value: fmtNum(kpis?.pct_wet_capacity, 1),
          suffix: "%",
          sub: "Higher = elevated transition risk",
          color: (kpis?.pct_wet_capacity ?? 0) > 20 ? "#E11C2A" : "#0f172a",
        },
        {
          label: "Alt Fuel Adoption",
          value: fmtNum(kpis?.pct_alt_fuel, 1),
          suffix: "%",
          sub: "% of plants using alternative fuels",
          color: "#0f172a",
        },
      ].map(k => (
        <div key={k.label} style={{ background: "#fff", border: "1px solid #e9ecef", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: k.color, marginBottom: 4 }}>
            {k.value}<span style={{ fontSize: 13, fontWeight: 500, color: k.color, marginLeft: 3, opacity: 0.7 }}>{k.suffix}</span>
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
        title="The Carbon Problem"
        subtitle="ESG & Future Tech · Cement remains one of the world's most carbon-intensive industries, driven by clinker-heavy production and legacy manufacturing infrastructure."
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* ── Sidebar filters (sticky — follows user as they scroll) ──────── */}
        <div style={{
          position: "sticky",
          top: 80,              // gap below the top of the viewport when stuck
          alignSelf: "flex-start",
          // Cap height so the panel scrolls internally if filters grow tall
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          // Custom scrollbar styling (subtle)
          scrollbarWidth: "thin",
          scrollbarColor: "#cbd5e1 transparent",
        }}>
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
              onClick={async () => {
                // Read live zoom from each chart instance (bypasses React state
                // which is debounced 150ms after drag). More reliable than
                // checking heroZoom/plantsZoom state.
                const heroLive = heroRef.current?.getVisibleRange?.() ?? null;
                const plantsLive = plantsRef.current?.getVisibleRange?.() ?? null;
                const heroLiveZoomed = !!heroLive && (heroLive.startIdx > 0 || heroLive.endIdx < heroLive.total - 1);
                const plantsLiveZoomed = !!plantsLive && (plantsLive.startIdx > 0 || plantsLive.endIdx < plantsLive.total - 1);

                // Apply zoom ranges (if zoomed) to the two zoomable charts.
                // Compute up-front so the confirm dialog can be shown before
                // we flip into the loading state.
                const heroSliced = hero ? sliceHero(hero, heroLiveZoomed ? heroLive : null) : null;
                const plantsSliced = heroPlants ? sliceHero(heroPlants, plantsLiveZoomed ? plantsLive : null) : null;

                // One combined confirm if either chart is currently zoomed
                const zoomedCharts: string[] = [];
                if (heroLiveZoomed) zoomedCharts.push(`• Companies (${(heroLive!.endIdx - heroLive!.startIdx + 1)}/${heroLive!.total} bars)`);
                if (plantsLiveZoomed) zoomedCharts.push(`• Plants (${(plantsLive!.endIdx - plantsLive!.startIdx + 1)}/${plantsLive!.total} bars)`);
                if (zoomedCharts.length > 0) {
                  const proceed = await confirmModal({
                    title: "One or more charts are zoomed",
                    message:
                      `${zoomedCharts.join("\n")}\n\n` +
                      `The deck will export only the visible (zoomed) bars from these charts. ` +
                      `Click the reset icon in each chart's top-right corner first if you want the full data.`,
                    confirmLabel: "Export visible bars",
                    cancelLabel: "Cancel",
                  });
                  if (!proceed) return;
                }

                setExporting("deck");
                try {
                  const slides: { template: string; data: { name: string; table: unknown[][] }[] }[] = [];

                  // Slide 1: Companies bar
                  if (heroSliced?.data?.length) {
                    slides.push({
                      template: "bar",
                      data: buildBarChartTable(
                        heroSliced,
                        `Wet vs Dry Capacity — Companies (${countryScopeLabel})`,
                      ),
                    });
                  }

                  // Slide 2: Plants bar (only if user has drilled into specific companies)
                  if (plantsSliced?.data?.length) {
                    slides.push({
                      template: "bar",
                      data: buildBarChartTable(
                        plantsSliced,
                        `Wet vs Dry Capacity — Plants (${countryScopeLabel})`,
                      ),
                    });
                  }

                  // Slide 3: Integrated vs Grinding (no zoom — at most 3 categories)
                  if (intGrindData?.data?.length) {
                    slides.push({
                      template: "bar",
                      data: buildIntegratedGrindingTable(
                        intGrindData.data,
                        `Integrated vs Grinding — ${countryScopeLabel}`,
                      ),
                    });
                  }

                  // Slide 4: Plant Age (no zoom — at most 5 buckets)
                  if (plantAge?.data?.length) {
                    slides.push({
                      template: "carbon_plant_age",
                      data: buildPlantAgeGrowthTable(
                        plantAge.data,
                        `Plant Age Distribution — ${countryScopeLabel}`,
                      ),
                    });
                  }

                  if (slides.length === 0) {
                    alert("No data available to export.");
                    return;
                  }

                  const filename = `carbon_problem_${countrySlug}.pptx`;
                  const res = await exportPptxDeck({ slides, filename });
                  downloadBlob(res.data as Blob, filename);
                } catch (e) {
                  alert(`Deck export failed: ${e instanceof Error ? e.message : String(e)}`);
                } finally {
                  setExporting(null);
                }
              }}
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
        </div>

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

            {/* ───── Executive Insight (Bain red gradient) — directly below KPIs ───── */}
            <div style={{
              background: "linear-gradient(135deg, #E11C2A 0%, #8B0E18 100%)",
              color: "#fff", border: "1px solid #8B0E18",
              borderRadius: 10, padding: 16, marginBottom: 16,
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
              {kpis && (
                <div style={{
                  marginTop: 8, paddingTop: 8,
                  borderTop: "1px solid rgba(255,255,255,0.18)",
                  fontSize: 10.5, fontStyle: "italic",
                  color: "rgba(255,255,255,0.80)",
                  lineHeight: 1.4,
                }}>
                  Methodology · Wet-process share is a percentage of <em>typed</em> capacity (plants with unknown production type are excluded from the denominator). Alt-fuel share is a percentage of plants with a recorded alt-fuel status.
                </div>
              )}
            </div>

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
                      All companies in {countryScopeLabel}
                      {hasClickedBars
                        ? ` · ${clickedCompanies.length} selected · click again to remove · double-click chart or empty space to clear`
                        : " — click bars to select companies and see their plants on the right"}
                      {hero && hero.data.length > 12 && " · drag the slider below to zoom"}
                    </div>
                    <FilterPills pills={companiesChartPills} />
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
                    onPpt={async () => {
                      if (!hero) return;
                      const live = heroRef.current?.getVisibleRange?.();
                      const range = (live && (live.startIdx > 0 || live.endIdx < live.total - 1))
                        ? live
                        : (heroIsZoomed ? heroZoom : null);
                      if (range) {
                        const ok = await confirmModal({
                          title: "Export zoomed view to PPT?",
                          message: zoomedExportMessage(range, "Wet vs Dry Capacity Mix · Companies"),
                          confirmLabel: "Export visible bars",
                          cancelLabel: "Cancel",
                        });
                        if (!ok) return;
                      }
                      const sliced = sliceHero(hero, range);
                      exportChart(
                        "hero",
                        "bar",
                        () => buildBarChartTable(sliced, `Wet vs Dry Capacity — ${countryScopeLabel}`),
                        `carbon_hero_${countrySlug}.pptx`,
                      );
                    }}
                    pptLoading={exporting === "hero"}
                    pptDisabled={!hero}
                    showPpt
                  />
                </div>

                {loading && !hero ? (
                  <LoadingSpinner height={460} />
                ) : (
                  <ChartCardShell
                    title={`Wet vs Dry Capacity Mix · Companies — ${countryScopeLabel}`}
                    renderChart={(modalHeight) => (
                      <CarbonStackedBar
                        ref={heroRef}
                        data={hero?.data ?? []}
                        xAxisType="company"
                        onBarToggle={handleBarToggle}
                        onClearAll={handleClearClicks}
                        highlightLabels={clickedCompanies}
                        onZoomChange={setHeroZoom}
                        height={modalHeight > 0 ? modalHeight : 460}
                      />
                    )}
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
                        ? `${clickedCompanies.length} compan${clickedCompanies.length === 1 ? "y" : "ies"} selected · all plants`
                        : "No companies selected"}
                      {!hasClickedBars && heroPlants && heroPlants.data.length > 12 && " · drag slider to zoom"}
                    </div>
                    <FilterPills pills={plantsChartPills} />
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
                    onPpt={async () => {
                      if (!heroPlants) return;
                      // Read live zoom from the chart instance first; fall back
                      // to React state (debounced ~150ms after drag). Either
                      // source should be accurate; using both belt-and-suspenders.
                      const live = plantsRef.current?.getVisibleRange?.();
                      const range = (live && (live.startIdx > 0 || live.endIdx < live.total - 1))
                        ? live
                        : (plantsIsZoomed ? plantsZoom : null);
                      if (range) {
                        const ok = await confirmModal({
                          title: "Export zoomed view to PPT?",
                          message: zoomedExportMessage(range, "Wet vs Dry Capacity Mix · Plants"),
                          confirmLabel: "Export visible bars",
                          cancelLabel: "Cancel",
                        });
                        if (!ok) return;
                      }
                      const sliced = sliceHero(heroPlants, range);
                      exportChart(
                        "plants",
                        "bar",
                        () => buildBarChartTable(sliced, `Plant Capacity Mix — ${countryScopeLabel}`),
                        `carbon_plants_${countrySlug}.pptx`,
                      );
                    }}
                    pptLoading={exporting === "plants"}
                    pptDisabled={!heroPlants}
                    showPpt
                  />
                </div>

                {!hasClickedBars ? (
                  <PlantsEmptyState height={460} />
                ) : loading && !heroPlants ? (
                  <LoadingSpinner height={460} />
                ) : (
                  <ChartCardShell
                    title={`Wet vs Dry Capacity Mix · Plants — ${countryScopeLabel}`}
                    renderChart={(modalHeight) => (
                      <CarbonStackedBar
                        ref={plantsRef}
                        data={heroPlants?.data ?? []}
                        xAxisType="plant"
                        onZoomChange={setPlantsZoom}
                        height={modalHeight > 0 ? modalHeight : 460}
                      />
                    )}
                  />
                )}

                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8, fontFamily: F, lineHeight: 1.4 }}>
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
                  <FilterPills pills={mapChartPills} />
                </div>
              </div>

              {loading && !mapData ? (
                <LoadingSpinner height={460} />
              ) : (
                <ChartCardShell
                  title={`Carbon Exposure Map — ${countryScopeLabel}`}
                  renderChart={(modalHeight) => (
                    <CarbonBubbleMap
                      data={mapData?.data ?? []}
                      height={modalHeight > 0 ? modalHeight : 460}
                    />
                  )}
                />
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
                    <FilterPills pills={intGrindChartPills} />
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
                      "bar",
                      () => buildIntegratedGrindingTable(
                        intGrindData?.data ?? [],
                        `Integrated vs Grinding — ${countryScopeLabel}`,
                      ),
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
                  <ChartCardShell
                    title={`Integrated vs Grinding Plants — ${countryScopeLabel}`}
                    renderChart={(modalHeight) => (
                      <IntegratedGrindingBar
                        data={intGrindData.data.map(d => ({
                          label: d.plant_type.charAt(0).toUpperCase() + d.plant_type.slice(1),
                          value: d.capacity,
                        }))}
                        height={modalHeight > 0 ? modalHeight : 320}
                      />
                    )}
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
                    <FilterPills pills={plantAgeChartPills} />
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
                      "carbon_plant_age",
                      () => buildPlantAgeGrowthTable(
                        plantAge?.data ?? [],
                        `Plant Age Distribution — ${countryScopeLabel}`,
                      ),
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
                  <ChartCardShell
                    title={`Plant Age Distribution — ${countryScopeLabel}`}
                    renderChart={(modalHeight) => (
                      <PlantAgeHistogram
                        data={plantAge?.data ?? []}
                        referenceYear={plantAge?.reference_year ?? new Date().getFullYear()}
                        height={modalHeight > 0 ? modalHeight : 320}
                      />
                    )}
                  />
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

      {/* In-app confirm modal (handles PPT-zoom warnings, etc.) */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        onResult={handleConfirmResult}
      />
    </div>
  );
}

// ── Integrated/Grinding/Clinker-only bar — three distinct colors with matching legend ──────
function IntegratedGrindingBar({
  data, height = 320,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  // Color logic by carbon-intensity / process scope:
  //   Integrated    = full clinker→cement process → Bain red (carbon-heaviest)
  //   Clinker only  = clinker burn only, no grinding → Bain yellow (still high carbon)
  //   Grinding      = downstream grinding only      → Bain green (lightest footprint)
  const COLOR_INTEGRATED = "#E11C2A";  // Bain red
  const COLOR_CLINKER_ONLY = "#F0B400";  // Bain yellow
  const COLOR_GRINDING = "#2D7D46";  // Bain green
  const COLOR_OTHER = "#94a3b8";  // gray fallback

  // Normalize a raw label to one of our 4 keys.
  // GEM data uses lowercase: "integrated", "grinding", "clinker only" (with space)
  const keyFor = (label: string): "integrated" | "clinker_only" | "grinding" | "other" => {
    const l = label.toLowerCase().trim();
    if (l === "integrated") return "integrated";
    if (l === "grinding") return "grinding";
    if (l === "clinker only" || l === "clinker_only" || l === "clinker") return "clinker_only";
    return "other";
  };

  const colorForKey = (k: string): string => {
    if (k === "integrated") return COLOR_INTEGRATED;
    if (k === "clinker_only") return COLOR_CLINKER_ONLY;
    if (k === "grinding") return COLOR_GRINDING;
    return COLOR_OTHER;
  };

  // Display label (title case for the bar's x-axis tick AND the legend)
  const displayLabel = (rawLabel: string): string => {
    const k = keyFor(rawLabel);
    if (k === "integrated") return "Integrated";
    if (k === "clinker_only") return "Clinker only";
    if (k === "grinding") return "Grinding";
    return rawLabel;
  };

  // Series-per-category so legend swatches lock to the right colors and toggling works.
  // Each series only carries values for bars matching its key; others are null.
  const seriesDefs: { key: "integrated" | "clinker_only" | "grinding" | "other"; label: string; color: string }[] = [
    { key: "integrated", label: "Integrated", color: COLOR_INTEGRATED },
    { key: "clinker_only", label: "Clinker only", color: COLOR_CLINKER_ONLY },
    { key: "grinding", label: "Grinding", color: COLOR_GRINDING },
    { key: "other", label: "Other", color: COLOR_OTHER },
  ];

  // Determine which series actually have data
  const presentKeys = new Set<string>();
  data.forEach(d => {
    presentKeys.add(keyFor(d.label));
  });
  const activeSeries = seriesDefs.filter(s => presentKeys.has(s.key));

  // X-axis labels — title-cased
  const xLabels = data.map(d => displayLabel(d.label));

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
      data: xLabels,
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
        return keyFor(d.label) === s.key
          ? { value: d.value, itemStyle: { color: colorForKey(s.key), borderRadius: [3, 3, 0, 0] } }
          : null;
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

// ── ChartCardShell: wraps a chart card with an "Expand" overlay ──────────────
// Click the expand icon → renders the same content in a centered modal.
// Esc / X button / backdrop click closes. Charts inside get a taller height
// via the render-prop pattern so ECharts/Leaflet fill the bigger container.
function ChartCardShell({
  title,
  renderChart,
}: {
  /** Used for the modal's accessibility label and dialog header */
  title: string;
  /** Render the chart with a given height. Called twice: once for the inline
   *  card (default height) and once for the modal (taller). Should be cheap;
   *  the chart components themselves cache their option. */
  renderChart: (height: number) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // ESC closes the modal
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // When modal opens, dispatch a window resize event after a tick so embedded
  // charts (Leaflet map, ECharts) recalc their dimensions. Both libraries
  // listen for window resize by default.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
    return () => clearTimeout(t);
  }, [open]);

  // Lock body scroll while modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Inline button style — same look-and-feel as the Reset Zoom button so they
  // sit nicely side-by-side when both are present.
  const btnStyle: React.CSSProperties = {
    position: "absolute",
    top: 8, right: 8,
    width: 28, height: 28,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "#ffffff",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    cursor: "pointer",
    boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
    transition: "background 0.15s, color 0.15s, border-color 0.15s",
    padding: 0,
    zIndex: 6,   // above ECharts (z 5)
  };

  return (
    <>
      {/* Container holds the inline chart + the expand button on top-right */}
      <div style={{ position: "relative" }}>
        {renderChart(0)}  {/* 0 → caller decides default height */}
        <button
          onClick={() => setOpen(true)}
          title="Expand chart"
          aria-label="Expand chart"
          style={btnStyle}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "#fef2f2";
            (e.currentTarget as HTMLElement).style.color = "#E11C2A";
            (e.currentTarget as HTMLElement).style.borderColor = "#E11C2A";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.color = "#475569";
            (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
          }}
        >
          {/* Arrows-maximize icon (4 outward-pointing corners) */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4l4 0l0 4" />
            <path d="M14 10l6 -6" />
            <path d="M8 20l-4 0l0 -4" />
            <path d="M4 20l6 -6" />
            <path d="M16 20l4 0l0 -4" />
            <path d="M14 14l6 6" />
            <path d="M8 4l-4 0l0 4" />
            <path d="M4 4l6 6" />
          </svg>
        </button>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — expanded view`}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9990,
            animation: "carbonExpandFadeIn 0.15s ease-out",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#ffffff",
              borderRadius: 12,
              boxShadow: "0 24px 56px rgba(0,0,0,0.30), 0 4px 14px rgba(0,0,0,0.18)",
              width: "92vw",
              height: "88vh",
              maxWidth: 1600,
              padding: "16px 20px 20px",
              fontFamily: F,
              display: "flex",
              flexDirection: "column",
              animation: "carbonExpandSlideUp 0.18s ease-out",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12, paddingBottom: 10,
              borderBottom: "1px solid #f1f5f9",
            }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                {title}
              </div>
              <button
                onClick={() => setOpen(false)}
                title="Close (Esc)"
                aria-label="Close expanded view"
                style={{
                  width: 30, height: 30,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "transparent",
                  color: "#475569",
                  border: "1px solid transparent",
                  borderRadius: 6,
                  cursor: "pointer",
                  padding: 0,
                  transition: "background 0.15s, color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "#fef2f2";
                  (e.currentTarget as HTMLElement).style.color = "#E11C2A";
                  (e.currentTarget as HTMLElement).style.borderColor = "#E11C2A";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#475569";
                  (e.currentTarget as HTMLElement).style.borderColor = "transparent";
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body — chart fills remaining space */}
            <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
              {/* Compute a numeric height for the chart based on remaining viewport.
                  88vh - header(~50px) - container padding(~36px) = roughly 88vh - 86px. */}
              {renderChart(Math.max(400, Math.floor(window.innerHeight * 0.88 - 86)))}
            </div>
          </div>

          <style>{`
            @keyframes carbonExpandFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes carbonExpandSlideUp {
              from { opacity: 0; transform: translateY(8px) scale(0.98); }
              to   { opacity: 1; transform: translateY(0)    scale(1); }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// ── Filter pills (small gray badges showing active filters) ──────────────────
type PillSpec = { label: string; value: string };

function FilterPills({ pills }: { pills: PillSpec[] }) {
  if (!pills.length) return null;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 4,
      marginTop: 6,
    }}>
      {pills.map((p, i) => (
        <span
          key={`${p.label}-${i}`}
          style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            background: "#f1f5f9",
            color: "#475569",
            border: "1px solid #e2e8f0",
            borderRadius: 4,
            padding: "1.5px 7px",
            fontSize: 10.5,
            lineHeight: 1.4,
            fontFamily: F,
            whiteSpace: "nowrap",
          }}
          title={`${p.label}: ${p.value}`}
        >
          <span style={{ color: "#94a3b8", fontWeight: 500 }}>{p.label}:</span>
          <span style={{ color: "#1e293b", fontWeight: 600 }}>{p.value}</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Summarize a string-array filter into a single pill value.
 * Examples:
 *   formatList(["India"])                      → "India"
 *   formatList(["India","China","Japan"])      → "India, China, Japan"
 *   formatList(["A","B","C","D","E","F"], 3)   → "A, B, C, +3 more"
 */
function formatList(items: string[] | null | undefined, maxShown = 3): string {
  if (!items || items.length === 0) return "";
  if (items.length <= maxShown) return items.join(", ");
  return `${items.slice(0, maxShown).join(", ")}, +${items.length - maxShown} more`;
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

// ── In-app confirm modal ─────────────────────────────────────────────────────
// Renders a backdrop + centered card with title, message, and two buttons.
// Hidden via `open={false}` (kept mounted so transitions are smooth).
// Escape and backdrop click both resolve as Cancel.
function ConfirmModal({
  open, title, message, confirmLabel = "Confirm", cancelLabel = "Cancel",
  onResult,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onResult: (result: boolean) => void;
}) {
  // Esc to cancel — only when open
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResult(false);
      if (e.key === "Enter") onResult(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onResult]);

  if (!open) return null;

  return (
    <div
      onClick={() => onResult(false)}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 9999,
        animation: "carbonModalFadeIn 0.15s ease-out",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="carbon-modal-title"
        style={{
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 24px 56px rgba(0,0,0,0.22), 0 4px 14px rgba(0,0,0,0.12)",
          width: "100%", maxWidth: 460,
          margin: 16,
          fontFamily: F,
          animation: "carbonModalSlideUp 0.18s ease-out",
          overflow: "hidden",
        }}
      >
        {/* Header strip — small Bain-red accent bar */}
        <div style={{
          height: 4, background: `linear-gradient(90deg, ${BAIN_RED} 0%, #8B0E18 100%)`,
        }} />

        <div style={{ padding: "18px 20px 16px" }}>
          <div
            id="carbon-modal-title"
            style={{
              fontSize: 15, fontWeight: 700, color: "#0f172a",
              marginBottom: 8, lineHeight: 1.35,
            }}
          >
            {title}
          </div>
          <div style={{
            fontSize: 12.5, color: "#475569",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",   // honor \n in the message string
          }}>
            {message}
          </div>
        </div>

        {/* Action bar */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "10px 20px 18px",
        }}>
          <button
            onClick={() => onResult(false)}
            style={{
              background: "#fff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              fontFamily: F,
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "#f8fafc";
              (e.currentTarget as HTMLElement).style.borderColor = "#94a3b8";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "#fff";
              (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => onResult(true)}
            autoFocus
            style={{
              background: BAIN_RED,
              color: "#fff",
              border: `1px solid ${BAIN_RED}`,
              borderRadius: 6,
              padding: "7px 14px",
              fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              fontFamily: F,
              boxShadow: "0 1px 2px rgba(225,28,42,0.18)",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#c4151f"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = BAIN_RED; }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes carbonModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes carbonModalSlideUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </div>
  );
}