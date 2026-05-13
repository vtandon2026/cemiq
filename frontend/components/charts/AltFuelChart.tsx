"use client";
// PATH: frontend/components/charts/AltFuelChart.tsx
import { F, type MatrixRow } from "./transitionTypes";

interface Props {
  data:    MatrixRow[];
  height?: number;
  topN?:   number;
}

export default function AltFuelChart({ data, height = 300, topN = 20 }: Props) {
  const sorted = [...data].sort((a, b) => b.alt_fuel_pct - a.alt_fuel_pct).slice(0, topN);
  const max    = Math.max(...sorted.map(d => d.alt_fuel_pct), 1);
  const barH   = Math.max(16, (height - 20) / Math.max(sorted.length, 1) - 3);

  if (!sorted.length) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 16 }}>No data</div>;

  return (
    <div style={{ overflowY: "auto", maxHeight: height, fontFamily: F }}>
      {sorted.map(d => (
        <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 120, fontSize: 11, color: "#374151", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {d.name}
          </div>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 4, height: barH, position: "relative" }}>
            <div style={{ width: `${(d.alt_fuel_pct / max) * 100}%`, height: "100%", background: "#059669", borderRadius: 4, transition: "width 0.3s" }} />
          </div>
          <div style={{ width: 40, fontSize: 11, fontWeight: 600, color: "#059669" }}>
            {d.alt_fuel_pct.toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}