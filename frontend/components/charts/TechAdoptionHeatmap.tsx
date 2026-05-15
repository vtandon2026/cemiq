"use client";
// PATH: frontend/components/charts/TechAdoptionHeatmap.tsx
import { F, type HeatmapRow } from "./transitionTypes";
 
interface Props {
  data: HeatmapRow[];
}
 
const REGIONS = ["Europe", "North America", "China", "APAC", "MEA", "Latin America"];
const TECH_LABELS: Record<string, string> = {
  "alt_fuel": "Alternative Fuel",
  "ccus":     "CCUS",
  "clay":     "Clay Calcination",
};
 
function getColor(val: number): string {
  if (val >= 50) return "#15803d";
  if (val >= 20) return "#4ade80";
  if (val >= 5)  return "#fef08a";
  return "#f1f5f9";
}
 
export default function TechAdoptionHeatmap({ data }: Props) {
  if (!data.length) return <div style={{ color: "#94a3b8", fontSize: 13, padding: 16 }}>No data</div>;
 
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 3, fontSize: 12, fontFamily: F }}>
        <thead>
          <tr>
            <th style={{ padding: "6px 10px", textAlign: "left", fontSize: 11, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
              Technology
            </th>
            {REGIONS.map(r => (
              <th key={r} style={{ padding: "6px 8px", textAlign: "center", fontSize: 11, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>
                {r}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map(row => (
            <tr key={row.technology}>
              <td style={{ padding: "8px 10px", fontWeight: 600, color: "#1e293b", fontSize: 12, whiteSpace: "nowrap" }}>
                {TECH_LABELS[row.technology] ?? row.technology}
              </td>
              {REGIONS.map(reg => {
                const val = typeof row[reg] === "number" ? (row[reg] as number) : 0;
                return (
                  <td key={reg} style={{ padding: 4, textAlign: "center" }}>
                    <div style={{ background: getColor(val), borderRadius: 6, padding: "8px 4px", minWidth: 60 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: val >= 20 ? "#166534" : "#374151" }}>
                        {val.toFixed(0)}%
                      </div>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 10, color: "#94a3b8" }}>
        <span>Low adoption</span>
        {["#f1f5f9", "#fef08a", "#4ade80", "#15803d"].map(c => (
          <span key={c} style={{ width: 20, height: 12, background: c, border: "1px solid #e2e8f0", borderRadius: 2, display: "inline-block" }} />
        ))}
        <span>High adoption</span>
        <span style={{ marginLeft: 8 }}>% of capacity enabled</span>
      </div>
    </div>
  );
}