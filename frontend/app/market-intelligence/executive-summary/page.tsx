// PATH: frontend/app/market-intelligence/executive-summary/page.tsx
"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterSelect } from "@/components/layout/Sidebar";
import { getExecSummaryCountries, getExecSummary } from "@/lib/api";
import type { ExecSection } from "@/lib/types";

const BAND_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  "Stable":                    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  "Moderate growth":           { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  "Strong growth":             { bg: "#dcfce7", color: "#166534", border: "#86efac" },
  "Moderate underperformance": { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  "Material underperformance": { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
};

const BAIN_RED = "#E60000";
const F = "Arial, Helvetica, sans-serif";

function SectionCard({ section }: { section: ExecSection }) {
  const style  = BAND_STYLES[section.band_label] ?? { bg: "#f8fafc", color: "#475569", border: "#e2e8f0" };
  const fmtCagr = (v: number | null) => v == null ? "N/A" : `${(v * 100).toFixed(1)}%`;

  return (
    <div style={{
      background: "#ffffff", border: "1px solid #e9ecef",
      borderRadius: 10, padding: 20,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      fontFamily: F,
    }}>
      {/* Headline + badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6, flex: 1, margin: 0 }}>{section.headline}</p>
        <span style={{
          flexShrink: 0, padding: "3px 10px", borderRadius: 20,
          fontSize: 11, fontWeight: 700,
          background: style.bg, color: style.color, border: `1px solid ${style.border}`,
          whiteSpace: "nowrap",
        }}>{section.band_label}</span>
      </div>

      {/* CAGR metrics */}
      <div style={{
        display: "flex", gap: 20, marginBottom: 14,
        paddingBottom: 14, borderBottom: "1px solid #f1f5f9",
      }}>
        {[
          { label: "Country CAGR", value: fmtCagr(section.country_cagr) },
          { label: "Region avg",   value: fmtCagr(section.region_cagr)  },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Bullets */}
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
        {section.bullets.map((b, i) => (
          <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "#475569", lineHeight: 1.55 }}>
            <span style={{ color: BAIN_RED, marginTop: 2, flexShrink: 0 }}>•</span>
            <span>{b.replace(/\*\*/g, "").replace(/\s*\(\[?[^\]]*\]?\(https?:\/\/[^)]+\)\)/g, "").replace(/\s*\(https?:\/\/[^\s)]+\)/g, "")}</span>
          </li>
        ))}
      </ul>

      {/* Sources */}
      {section.source_refs.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14, paddingTop: 14, borderTop: "1px solid #f1f5f9", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>Sources:</span>
          {section.source_refs.map((s, i) => (
            <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" style={{
              fontSize: 11, padding: "2px 9px",
              border: "1px solid #e2e8f0", borderRadius: 20,
              color: "#64748b", textDecoration: "none",
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
            >{s.domain || s.title}</a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExecutiveSummaryPage() {
  const [countries,  setCountries]  = useState<string[]>([]);
  const [country,    setCountry]    = useState("");
  const [sections,   setSections]   = useState<ExecSection[]>([]);
  const [activeTab,  setActiveTab]  = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [useWeb,     setUseWeb]     = useState(true);
  const [trigger,    setTrigger]    = useState(0); // incremented only on Generate click

  useEffect(() => {
    getExecSummaryCountries().then((r) => {
      setCountries(r.data.countries);
      setCountry(r.data.countries[0] ?? "");
    });
  }, []);

  useEffect(() => {
    if (!country || trigger === 0) return;
    setLoading(true);
    setSections([]);
    getExecSummary(country, useWeb, true).then((r) => {
      setSections(r.data.sections);
      setActiveTab(0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [trigger]);

  const tabLabel = (s: ExecSection) =>
    s.category === "Construction overall"            ? "Construction"
    : s.category === "Building Products Overall Sales" ? "Building Products"
    : "Cement";

  return (
    <div style={{ fontFamily: F }}>
      <PageHeader
        title={`Executive Summary${country ? `: ${country}` : ""}`}
        subtitle="Market Intelligence · AI-generated country outlook"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Country</FilterLabel>
            <FilterSelect value={country} onChange={(e) => setCountry(e.target.value)}>
              {countries.length === 0
                ? <option value="">Loading…</option>
                : countries.map((c) => <option key={c}>{c}</option>)
              }
            </FilterSelect>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={useWeb}
              onChange={(e) => setUseWeb(e.target.checked)}
              style={{ accentColor: BAIN_RED, width: 14, height: 14 }}
            />
            <span style={{ fontSize: 12, color: "#475569" }}>Include web sources</span>
          </label>

          <button
            disabled={!country || loading}
            onClick={() => { if (country) setTrigger((t) => t + 1); }}
            style={{
              width: "100%", padding: "9px 0", borderRadius: 7,
              fontSize: 12, fontWeight: 700, fontFamily: F,
              background: !country || loading ? "#e2e8f0" : BAIN_RED,
              color: !country || loading ? "#94a3b8" : "#ffffff",
              border: "none", cursor: !country || loading ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              marginTop: 4,
            }}
          >
            {loading ? "Generating…" : "Generate Outlook"}
          </button>
        </Sidebar>

        {/* ── Main ─────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, minHeight: "calc(100vh - 220px)" }}>
          {loading ? (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", height: 280, gap: 14,
              color: "#94a3b8", fontSize: 13, fontFamily: F,
            }}>
              <div style={{
                width: 28, height: 28, border: "3px solid #f1f5f9",
                borderTop: `3px solid ${BAIN_RED}`, borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <span>Building executive outlook… this may take a moment.</span>
            </div>
          ) : sections.length > 0 ? (
            <>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                {sections.map((s, i) => {
                  const active = activeTab === i;
                  return (
                    <button key={i} onClick={() => setActiveTab(i)} style={{
                      padding: "6px 16px", borderRadius: 20, fontSize: 12,
                      fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
                      fontFamily: F,
                      background: active ? BAIN_RED : "#ffffff",
                      color:      active ? "#ffffff" : "#64748b",
                      border:     active ? `1.5px solid ${BAIN_RED}` : "1.5px solid #e2e8f0",
                    }}>
                      {tabLabel(s)}
                    </button>
                  );
                })}
              </div>

              {sections[activeTab] && <SectionCard section={sections[activeTab]} />}
            </>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 160, color: "#94a3b8", fontSize: 13, fontFamily: F,
              border: "1px dashed #e2e8f0", borderRadius: 10,
            }}>
              Select a country and click Generate to build the executive outlook.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}