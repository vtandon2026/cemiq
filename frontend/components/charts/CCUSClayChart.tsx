"use client";
// PATH: frontend/components/charts/CCUSClayChart.tsx
import { F, type MatrixRow } from "./transitionTypes";

interface Props {
  data:    MatrixRow[];
  height?: number;
  topN?:   number;
}

export default function CCUSClayChart({ data, height = 300, topN = 15 }: Props) {
  const sorted = [...data]
    .sort((a, b) => (b.ccus_pct + b.clay_pct) - (a.ccus_pct + a.clay_pct))
    .slice(0, topN);
  const max  = Math.max(...sorted.flatMap(d => [d.ccus_pct, d.clay_pct]), 1);
  const barH = Math.max(14, (height - 20) / Math.max(sorted.length, 1) - 4);

  if (!sorted.length) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 16 }}>No data</div>;

  return (
    <div style={{ overflowY: "auto", maxHeight: height, fontFamily: F }}>
      {sorted.map(d => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ width: 120, fontSize: 11, color: "#374151", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.name}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            {/* CCUS bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ background: "#f1f5f9", borderRadius: 3, height: barH / 2, flex: 1, position: "relative" }}>
                <div style={{ width: `${(d.ccus_pct / max) * 100}%`, height: "100%", background: "#7c3aed", borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, color: "#7c3aed", width: 32 }}>{d.ccus_pct.toFixed(0)}%</span>
            </div>
            {/* Clay bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ background: "#f1f5f9", borderRadius: 3, height: barH / 2, flex: 1, position: "relative" }}>
                <div style={{ width: `${(d.clay_pct / max) * 100}%`, height: "100%", background: "#0891b2", borderRadius: 3 }} />
              </div>
              <span style={{ fontSize: 10, color: "#0891b2", width: 32 }}>{d.clay_pct.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      ))}
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#7c3aed", borderRadius: 2, display: "inline-block" }} />
          CCUS
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 10, height: 10, background: "#0891b2", borderRadius: 2, display: "inline-block" }} />
          Clay Calcination
        </span>
      </div>
    </div>
  );
}