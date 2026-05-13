"use client";
// PATH: frontend/components/charts/TransitionMatrixChart.tsx
import { useEffect, useRef, useState } from "react";
import { REGION_COLORS, F, type MatrixRow } from "./transitionTypes";

interface Props {
  data:    MatrixRow[];
  height?: number;
}

export default function TransitionMatrixChart({ data, height = 480 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width,   setWidth]   = useState(700);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: MatrixRow } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(e => setWidth(e[0].contentRect.width || 700));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  if (!data.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height, color: "#94a3b8", fontSize: 13 }}>
      No data available
    </div>
  );

  const M = { top: 32, right: 32, bottom: 48, left: 48 };
  const W = width - M.left - M.right;
  const H = height - M.top - M.bottom;
  const maxCap = Math.max(...data.map(d => d.total_capacity));

  const cx = (d: MatrixRow) => (d.carbon_exposure / 100) * W;
  const cy = (d: MatrixRow) => H - (d.readiness_score / 100) * H;
  const cr = (d: MatrixRow) => Math.max(5, Math.sqrt(d.total_capacity / maxCap) * 32);

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {Object.entries(REGION_COLORS).map(([r, c]) => (
            <radialGradient key={r} id={`grad-${r.replace(/\s/g, "")}`} cx="40%" cy="35%" r="60%">
              <stop offset="0%" stopColor={c} stopOpacity="0.9" />
              <stop offset="100%" stopColor={c} stopOpacity="0.5" />
            </radialGradient>
          ))}
        </defs>
        <g transform={`translate(${M.left},${M.top})`}>
          {/* Quadrant backgrounds */}
          <rect x={0}   y={0}   width={W/2} height={H/2} fill="rgba(5,150,105,0.05)"  />
          <rect x={W/2} y={0}   width={W/2} height={H/2} fill="rgba(251,191,36,0.06)" />
          <rect x={0}   y={H/2} width={W/2} height={H/2} fill="rgba(148,163,184,0.05)"/>
          <rect x={W/2} y={H/2} width={W/2} height={H/2} fill="rgba(220,38,38,0.06)"  />

          {/* Quadrant labels */}
          {[
            { x: 8,      y: 14,      label: "Resilient Leaders",    color: "#059669" },
            { x: W/2+8,  y: 14,      label: "Transforming Giants",  color: "#d97706" },
            { x: 8,      y: H/2+14,  label: "Stable but Lagging",   color: "#94a3b8" },
            { x: W/2+8,  y: H/2+14,  label: "⚠ Transition Risk",   color: "#dc2626" },
          ].map(q => (
            <text key={q.label} x={q.x} y={q.y} fontSize={10} fontWeight={700} fill={q.color} opacity={0.7}>
              {q.label}
            </text>
          ))}

          {/* Divider lines */}
          <line x1={W/2} y1={0} x2={W/2} y2={H} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />
          <line x1={0} y1={H/2} x2={W} y2={H/2} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4,3" />

          {/* Axis ticks */}
          {[0, 25, 50, 75, 100].map(v => (
            <g key={v}>
              <text x={(v/100)*W} y={H+16} textAnchor="middle" fontSize={9} fill="#94a3b8">{v}</text>
              <text x={-8} y={H-(v/100)*H+4} textAnchor="end" fontSize={9} fill="#94a3b8">{v}</text>
            </g>
          ))}
          <text x={W/2} y={H+32} textAnchor="middle" fontSize={11} fill="#64748b">Carbon Exposure →</text>
          <text transform={`translate(-36,${H/2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#64748b">Future Readiness →</text>

          {/* Border */}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="#e2e8f0" strokeWidth={1} />

          {/* Bubbles */}
          {data.map(d => {
            const x = cx(d), y = cy(d), r = cr(d);
            const color  = REGION_COLORS[d.region] ?? "#94a3b8";
            const gradId = `grad-${d.region.replace(/\s/g, "")}`;
            const isHov  = hovered === d.name;
            return (
              <g key={d.name} style={{ cursor: "pointer" }}
                onMouseEnter={() => { setHovered(d.name); setTooltip({ x: x + M.left, y: y + M.top, row: d }); }}
                onMouseLeave={() => { setHovered(null); setTooltip(null); }}>
                <circle cx={x} cy={y} r={r}
                  fill={`url(#${gradId})`}
                  stroke={isHov ? color : "white"}
                  strokeWidth={isHov ? 2 : 1}
                  opacity={hovered && !isHov ? 0.35 : 0.85}
                  style={{ transition: "opacity 0.15s" }}
                />
                {r > 14 && (
                  <text x={x} y={y+4} textAnchor="middle" fontSize={Math.min(9, r * 0.55)}
                    fill="white" fontWeight={700} pointerEvents="none" style={{ userSelect: "none" }}>
                    {d.name.length > 12 ? d.name.slice(0, 10) + "…" : d.name}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (() => {
        const tipW = 240;
        const tipH = 210;
        const pad  = 16;
        // Try right of bubble first, then left, then above
        let left = tooltip.x + pad;
        let top  = tooltip.y - tipH / 2;
        if (left + tipW > width) left = tooltip.x - tipW - pad;
        if (left < 0) left = 4;
        if (top < 0) top = 4;
        if (top + tipH > height - M.top) top = height - tipH - 4;
        return (
          <div style={{ position: "absolute", left, top, width: tipW, background: "#fff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 12, pointerEvents: "none", zIndex: 10, fontFamily: F }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: REGION_COLORS[tooltip.row.region] ?? "#94a3b8", display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{tooltip.row.name}</span>
            </div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>
              {tooltip.row.region}{tooltip.row.country ? ` · ${tooltip.row.country}` : ""}
            </div>
            <div style={{ height: 0.5, background: "#f1f5f9", marginBottom: 6 }} />
            {[
              ["Capacity",        `${tooltip.row.total_capacity.toFixed(0)} Mt`],
              ["Carbon Exposure", `${tooltip.row.carbon_exposure.toFixed(0)} / 100`],
              ["Readiness Score", `${tooltip.row.readiness_score.toFixed(0)} / 100`],
              ["Wet Process",     `${tooltip.row.wet_share.toFixed(0)}%`],
              ["Alt Fuel",        `${tooltip.row.alt_fuel_pct.toFixed(0)}%`],
              ["CCUS",            `${tooltip.row.ccus_pct.toFixed(0)}%`],
              ["Clay Calcination",`${tooltip.row.clay_pct.toFixed(0)}%`],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 3 }}>
                <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 11 }}>{value}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
        {Object.entries(REGION_COLORS).filter(([r]) => r !== "Other").map(([region, color]) => (
          <div key={region} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#475569" }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, display: "inline-block" }} />
            {region}
          </div>
        ))}
        <div style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>Bubble size = total capacity</div>
      </div>
    </div>
  );
}