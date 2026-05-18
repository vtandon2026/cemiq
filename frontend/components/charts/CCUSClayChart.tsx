"use client";
// PATH: frontend/components/charts/CCUSClayChart.tsx
import { F, type MatrixRow } from "./transitionTypes";

interface Props {
  data:    MatrixRow[];
  height?: number;
  topN?:   number;
}

const CCUS_COLOR = "#7c3aed";   
const CLAY_COLOR = "#0891b2";   

export default function CCUSClayChart({ data, height = 300, topN = 15 }: Props) {
  const sorted = [...data]
    .sort((a, b) => (b.ccus_pct + b.clay_pct) - (a.ccus_pct + a.clay_pct))
    .slice(0, topN);
  const max  = Math.max(...sorted.flatMap(d => [d.ccus_pct, d.clay_pct]), 1);
  const barH = Math.max(14, (height - 48) / Math.max(sorted.length, 1) - 4);

  if (!sorted.length) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 16 }}>No data</div>;

  return (
    <div style={{ fontFamily: F }}>
      {/* Legend — fixed at top so always visible */}
      <div style={{ display: "flex", gap: 20, marginBottom: 12, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 12, background: CCUS_COLOR, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#374151", fontWeight: 600 }}>CCUS</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 12, height: 12, background: CLAY_COLOR, borderRadius: 2, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "#374151", fontWeight: 600 }}>Clay Calcination</span>
        </span>
      </div>

      {/* Bars */}
      <div style={{ overflowY: "auto", maxHeight: height - 36 }}>
        {sorted.map(d => (
          <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ width: 120, fontSize: 11, color: "#374151", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 0 }}>
              {d.name}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              {/* CCUS bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ background: "#f1f5f9", borderRadius: 3, height: barH / 2, flex: 1, position: "relative", overflow: "hidden" }}>
                  <div style={{ width: `${(d.ccus_pct / max) * 100}%`, height: "100%", background: CCUS_COLOR, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: CCUS_COLOR, width: 32, fontWeight: 600 }}>{d.ccus_pct.toFixed(0)}%</span>
              </div>
              {/* Clay bar */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ background: "#f1f5f9", borderRadius: 3, height: barH / 2, flex: 1, position: "relative", overflow: "hidden" }}>
                  <div style={{ width: `${(d.clay_pct / max) * 100}%`, height: "100%", background: CLAY_COLOR, borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 10, color: CLAY_COLOR, width: 32, fontWeight: 600 }}>{d.clay_pct.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}