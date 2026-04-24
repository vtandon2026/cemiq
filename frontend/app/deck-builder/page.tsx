// PATH: frontend/app/deck-builder/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import { getDeckMeta, buildDeck, getCiqCompanies } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";

const KPI_CATEGORIES: Record<string, { key: string; label: string }[]> = {
  "Investor Value":       [{ key: "market_cap", label: "Market Capitalization" }, { key: "enterprise_value", label: "Enterprise Value" }],
  "Earnings Quality":     [{ key: "revenue", label: "Revenue" }, { key: "ebitda", label: "EBITDA" }, { key: "ebitda_margin", label: "EBITDA Margin" }],
  "Capital Efficiency":   [{ key: "roic", label: "ROIC" }, { key: "roce", label: "ROCE" }, { key: "asset_turnover", label: "Asset Turnover" }],
  "Financial Risk":       [{ key: "net_debt", label: "Net Debt" }, { key: "net_debt_ebitda", label: "Net Leverage" }, { key: "debt_to_equity", label: "Debt-to-Equity" }],
  "Cash & Valuation":     [{ key: "opcf", label: "Operating Cash Flow" }, { key: "fcf", label: "Free Cash Flow" }, { key: "ev_ebitda", label: "EV / EBITDA" }],
  "Workforce Efficiency": [{ key: "ebitda_per_fte", label: "EBITDA / FTE" }, { key: "revenue_per_fte", label: "Revenue / FTE" }],
};
const CHART_MODES = ["Point-in-time (bar)", "Time series (line)", "Both"];
const CHART_MODE_MAP: Record<string, string> = {
  "Point-in-time (bar)": "point_in_time",
  "Time series (line)":  "time_series",
  "Both":                "both",
};
interface KpiRow { category: string; kpi_key: string; kpi_label: string; chart_mode: string }

// ── Shared styles ──────────────────────────────────────────────────────────
const F = "Arial, Helvetica, sans-serif";
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e9ecef", borderRadius: 10,
  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
};
const sel: React.CSSProperties = {
  width: "100%", border: "1px solid #e2e8f0", borderRadius: 6,
  padding: "7px 10px", fontSize: 12, color: "#374151",
  fontFamily: F, background: "#fff", outline: "none",
};
const label12: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: "#94a3b8",
  textTransform: "uppercase" as const, letterSpacing: "0.07em",
  fontFamily: F, marginBottom: 6, display: "block",
};

function SectionCard({ title, children, accent = "#2A465C" }: {
  title: string; children: React.ReactNode; accent?: string;
}) {
  return (
    <div style={{ ...card, overflow: "hidden" }}>
      <div style={{
        borderLeft: `3px solid ${accent}`,
        padding: "14px 20px", borderBottom: "1px solid #f1f5f9",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: F }}>{title}</span>
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

export default function DeckBuilderPage() {
  const [countries,    setCountries]    = useState<string[]>([]);
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [companies,    setCompanies]    = useState<string[]>([]);
  const [years,        setYears]        = useState<number[]>([]);
  const [country,      setCountry]      = useState("");
  const [company,      setCompany]      = useState("Holcim AG");
  const [year,       setYear]       = useState(2024);
  const [includeKpi, setIncludeKpi] = useState(false);
  const [peers,      setPeers]      = useState<string[]>([]);
  const [kpiRows,    setKpiRows]    = useState<KpiRow[]>([
    { category: "Earnings Quality", kpi_key: "ebitda", kpi_label: "EBITDA", chart_mode: "Both" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getDeckMeta().then((r) => {
      setCountries(["(All)", ...r.data.countries]);
      setAllCompanies(r.data.companies);
      setCompanies(r.data.companies);
      setYears(r.data.years);
      setYear(r.data.years.at(-1) ?? 2024);
      setCompany(r.data.companies.includes("Holcim AG") ? "Holcim AG" : r.data.companies[0] ?? "");
    });
  }, []);

  // Filter companies by selected country
  useEffect(() => {
    if (!country || country === "(All)") {
      setCompanies(allCompanies);
      return;
    }
    getCiqCompanies(country)
      .then((res) => {
        const filtered = res.data.companies ?? [];
        const list = filtered.length > 0 ? filtered : allCompanies;
        setCompanies(list);
        setCompany((prev) => list.includes(prev) ? prev : (list[0] ?? ""));
        setPeers((prev) => prev.filter((p) => list.includes(p)));
      })
      .catch(() => setCompanies(allCompanies));
  }, [country, allCompanies]);

  const kpiSlideCount = includeKpi && peers.length > 0 && kpiRows.length > 0
    ? 1 + kpiRows.reduce((s, r) => s + (r.chart_mode === "Both" ? 2 : 1), 0) : 0;
  const slideCount = 5 + kpiSlideCount;

  const addKpiRow = () => {
    const cat = Object.keys(KPI_CATEGORIES)[0];
    const kpi = KPI_CATEGORIES[cat][0];
    setKpiRows((p) => [...p, { category: cat, kpi_key: kpi.key, kpi_label: kpi.label, chart_mode: "Both" }]);
  };
  const removeKpiRow = (i: number) => setKpiRows((p) => p.filter((_, idx) => idx !== i));
  const updateKpiRow = (i: number, patch: Partial<KpiRow>) =>
    setKpiRows((p) => p.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const handleBuild = async () => {
    setLoading(true);
    try {
      const payload: Parameters<typeof buildDeck>[0] = {
        country: country && country !== "(All)" ? country : undefined,
        company: company || undefined, year,
      };
      if (includeKpi && peers.length > 0 && kpiRows.length > 0) {
        payload.comparison_request = {
          base_company: company, peer_companies: peers,
          kpi_selections: kpiRows.map((r) => ({ kpi_key: r.kpi_key, chart_mode: CHART_MODE_MAP[r.chart_mode] ?? "both" })),
          year, country: country && country !== "(All)" ? country : undefined, year_range_start: 2010,
        };
      }
      const res = await buildDeck(payload);
      downloadBlob(res.data as Blob, `${[country, company].filter(Boolean).join("_").replace(/\s+/g, "_") || "CemIQ"}_Deck.pptx`);
    } catch (e) {
      alert(`Deck build failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const baseSlides = [
    { num: 1, label: "Market Overview",   desc: `${country && country !== "(All)" ? country : "Global"} · ${year}`, type: "base" },
    { num: 2, label: "Company Profile",   desc: company,                   type: "base" },
    { num: 3, label: "Revenue Growth",    desc: "Historic + Forecast",     type: "base" },
    { num: 4, label: "Regional Mekko",    desc: "Market share by region",  type: "base" },
    { num: 5, label: "Stock Performance", desc: "Indexed price chart",     type: "base" },
  ];
  const kpiPreview = includeKpi && peers.length > 0
    ? [{ num: 6, label: "KPI Index", desc: `${kpiRows.length} metrics · ${peers.length} peers`, type: "kpi" },
       ...kpiRows.flatMap((r, i) =>
        r.chart_mode === "Both"
          ? [{ num: 7 + i * 2, label: r.kpi_label, desc: "Point-in-time", type: "kpi" },
             { num: 8 + i * 2, label: r.kpi_label, desc: "Time series",   type: "kpi" }]
          : [{ num: 7 + i, label: r.kpi_label, desc: r.chart_mode, type: "kpi" }]
      )]
    : [];

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader title="Deck Builder" subtitle="Configure and generate a PowerPoint deck with market intelligence slides" />

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* ── Left: Config ─────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Base filters */}
          <SectionCard title="Base Slides  ·  1 – 5">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { lbl: "Country", val: country,       fn: setCountry,                      opts: countries },
                { lbl: "Company", val: company,       fn: setCompany,                      opts: companies },
                { lbl: "Year",    val: String(year),  fn: (v: string) => setYear(Number(v)), opts: years.map(String) },
              ].map(({ lbl, val, fn, opts }) => (
                <div key={lbl}>
                  <span style={label12}>{lbl}</span>
                  <select value={val} onChange={(e) => fn(e.target.value)} style={sel}>
                    {opts.map((o) => <option key={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* KPI toggle */}
          <SectionCard title="KPI Comparison Slides" accent={includeKpi ? BAIN_RED : "#2A465C"}>
            {/* Toggle row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
              onClick={() => setIncludeKpi(!includeKpi)}>
              <span style={{ fontSize: 12, color: "#64748b", fontFamily: F }}>
                Benchmark <strong style={{ color: "#1e293b" }}>{company || "company"}</strong> against peer companies
              </span>
              <div style={{
                position: "relative", width: 38, height: 22, borderRadius: 11, flexShrink: 0,
                background: includeKpi ? BAIN_RED : "#e2e8f0", transition: "background 0.2s",
              }}>
                <span style={{
                  position: "absolute", top: 3, left: includeKpi ? 19 : 3,
                  width: 16, height: 16, borderRadius: "50%", background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.25)", transition: "left 0.2s",
                }} />
              </div>
            </div>

            {includeKpi && (
              <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>

                {/* Peer selection */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={label12}>Peer companies</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, fontFamily: F,
                      color: peers.length > 0 ? BAIN_RED : "#94a3b8",
                      background: peers.length > 0 ? "#fff1f2" : "#f8fafc",
                      border: `1px solid ${peers.length > 0 ? "#fecdd3" : "#e2e8f0"}`,
                      padding: "2px 9px", borderRadius: 20,
                    }}>{peers.length} selected</span>
                  </div>
                  <div style={{
                    maxHeight: 148, overflowY: "auto",
                    border: "1px solid #e2e8f0", borderRadius: 8,
                    background: "#fafafa",
                  }}>
                    {companies.filter((c) => c !== company).map((c, i, arr) => (
                      <label key={c} style={{
                        display: "flex", alignItems: "center", gap: 8,
                        fontSize: 12, color: "#374151", cursor: "pointer",
                        padding: "7px 12px",
                        borderBottom: i < arr.length - 1 ? "1px solid #f1f5f9" : "none",
                        background: peers.includes(c) ? "#fff7f7" : "transparent",
                      }}>
                        <input type="checkbox" checked={peers.includes(c)}
                          onChange={(e) => setPeers(e.target.checked ? [...peers, c] : peers.filter((x) => x !== c))}
                          style={{ accentColor: BAIN_RED, width: 13, height: 13, flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* KPI rows */}
                <div>
                  <span style={{ ...label12, marginBottom: 10 }}>KPIs to include</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {kpiRows.map((row, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 8, alignItems: "center",
                        background: "#f8fafc", borderRadius: 8, padding: "8px 10px",
                        border: "1px solid #f1f5f9",
                      }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 4, background: "#e2e8f0",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 10, fontWeight: 700, color: "#64748b", flexShrink: 0,
                        }}>{i + 1}</div>
                        <select value={row.category}
                          onChange={(e) => {
                            const cat = e.target.value;
                            const kpi = KPI_CATEGORIES[cat][0];
                            updateKpiRow(i, { category: cat, kpi_key: kpi.key, kpi_label: kpi.label });
                          }}
                          style={{ ...sel, flex: 1, fontSize: 11, background: "#fff" }}>
                          {Object.keys(KPI_CATEGORIES).map((c) => <option key={c}>{c}</option>)}
                        </select>
                        <select value={row.kpi_key}
                          onChange={(e) => {
                            const kpi = KPI_CATEGORIES[row.category].find((k) => k.key === e.target.value);
                            if (kpi) updateKpiRow(i, { kpi_key: kpi.key, kpi_label: kpi.label });
                          }}
                          style={{ ...sel, flex: 1, fontSize: 11, background: "#fff" }}>
                          {KPI_CATEGORIES[row.category]?.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
                        </select>
                        <select value={row.chart_mode}
                          onChange={(e) => updateKpiRow(i, { chart_mode: e.target.value })}
                          style={{ ...sel, width: 130, flex: "none", fontSize: 11, background: "#fff" }}>
                          {CHART_MODES.map((m) => <option key={m}>{m}</option>)}
                        </select>
                        <button onClick={() => removeKpiRow(i)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 16, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = BAIN_RED)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button onClick={addKpiRow} style={{
                    marginTop: 8, width: "100%", background: "none",
                    border: "1px dashed #e2e8f0", borderRadius: 8,
                    cursor: "pointer", color: "#94a3b8", fontSize: 11, fontWeight: 700,
                    padding: "8px 0", fontFamily: F, letterSpacing: "0.02em",
                    transition: "all 0.15s",
                  }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; e.currentTarget.style.background = "#fff7f7"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#94a3b8"; e.currentTarget.style.background = "none"; }}>
                    + Add KPI
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Generate button */}
          <button onClick={handleBuild} disabled={loading} style={{
            width: "100%", padding: "14px 0", borderRadius: 8,
            fontWeight: 700, color: "#ffffff", fontSize: 13, letterSpacing: "0.03em",
            background: loading ? "#94a3b8" : BAIN_RED, border: "none",
            cursor: loading ? "not-allowed" : "pointer", fontFamily: F,
            boxShadow: loading ? "none" : "0 2px 10px rgba(230,0,0,0.25)",
            transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.background = "#c00000"; e.currentTarget.style.boxShadow = "0 4px 18px rgba(230,0,0,0.35)"; } }}
            onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.background = BAIN_RED; e.currentTarget.style.boxShadow = "0 2px 10px rgba(230,0,0,0.25)"; } }}
          >
            {loading ? "Building deck…" : `Generate Deck  ·  ${slideCount} slide${slideCount !== 1 ? "s" : ""}`}
          </button>
        </div>

        {/* ── Right: Preview ────────────────────── */}
        <div style={{ flex: "0 0 300px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Slide list */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{
              padding: "14px 18px", borderBottom: "1px solid #f1f5f9",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: F }}>Deck Preview</span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: BAIN_RED,
                background: "#fff1f2", padding: "3px 10px", borderRadius: 20,
                border: "1px solid #fecdd3", fontFamily: F,
              }}>{slideCount} slides</span>
            </div>
            <div style={{
              maxHeight: 380, overflowY: "auto",
              padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4,
            }}>
              {[...baseSlides, ...kpiPreview].map((slide, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 7,
                  background: slide.type === "kpi" ? "#fff7f7" : "#f8fafc",
                  border: `1px solid ${slide.type === "kpi" ? "#fecdd3" : "#f1f5f9"}`,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: "#fff",
                    background: slide.type === "kpi" ? BAIN_RED : "#2A465C",
                    borderRadius: 4, padding: "2px 6px",
                    minWidth: 22, textAlign: "center" as const, flexShrink: 0,
                    fontFamily: F,
                  }}>{slide.num}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.label}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, fontFamily: F, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slide.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary card */}
          <div style={{ ...card, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: F }}>Configuration</span>
            </div>
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              {([
                ["Country",    country && country !== "(All)" ? country : "All countries"],
                ["Company",    company || "—"],
                ["Year",       String(year)],
                ["Base slides","5 (fixed)"],
                ["KPI slides", kpiSlideCount > 0 ? `${kpiSlideCount} slides` : "Not included"],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: F }}>{k}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", fontFamily: F, maxWidth: 150, textAlign: "right" as const, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: F }}>Total</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: BAIN_RED, fontFamily: F }}>{slideCount} slides</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}