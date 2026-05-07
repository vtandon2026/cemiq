"use client";
// PATH: frontend/components/charts/CompanyCapacityChart.tsx
import { useEffect, useRef, useState, useMemo } from "react";

const F = "Arial, Helvetica, sans-serif";
const BAIN_RED = "#CC0000";
const GREY     = "#94a3b8";

export interface CompanyRow {
  rank:           number;
  company:        string;
  total_capacity: number;
  plant_count:    number;
  market_share:   number;
  countries:      string[];
  country_count:  number;
}

interface TooltipState {
  x: number;
  y: number;
  row: CompanyRow;
}

interface Props {
  data:      CompanyRow[];
  height?:   number;
  colorMode?: "rank" | "share"; // rank = top3 red, share = gradient
}

function interpolateRed(t: number): string {
  // Dark red → light red gradient for top companies
  const r = Math.round(204 - t * 80);
  const g = Math.round(t * 60);
  const b = Math.round(t * 60);
  return `rgb(${r},${g},${b})`;
}

export default function CompanyCapacityChart({ data, height = 480, colorMode = "rank" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth]         = useState(800);
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null);
  const [hovered, setHovered]     = useState<string | null>(null);
  const [sortBy, setSortBy]       = useState<"capacity" | "share" | "plants">("capacity");
  const [highlightTop, setHighlightTop] = useState<number>(3);

  useEffect(() => {
    const obs = new ResizeObserver(e => setWidth(e[0].contentRect.width || 800));
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      if (sortBy === "capacity") return b.total_capacity - a.total_capacity;
      if (sortBy === "share")    return b.market_share - a.market_share;
      return b.plant_count - a.plant_count;
    });
  }, [data, sortBy]);

  const MARGIN = { top: 32, right: 20, bottom: 110, left: 52 };
  const innerW = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerH = height - MARGIN.top - MARGIN.bottom;
  const maxCap = sorted.length ? Math.max(...sorted.map(d => d.total_capacity)) : 1;
  const barGap = 3;
  const barW   = Math.max(6, (innerW / Math.max(sorted.length, 1)) - barGap);

  // Y axis ticks
  const yTicks = useMemo(() => {
    const step = maxCap <= 10 ? 2 : maxCap <= 50 ? 10 : maxCap <= 200 ? 50 : 100;
    const ticks = [];
    for (let v = 0; v <= maxCap * 1.05; v += step) ticks.push(v);
    return ticks;
  }, [maxCap]);

  if (!data.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height, color: "#94a3b8", fontSize: 13, fontFamily: F }}>
      No data available
    </div>
  );

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative", fontFamily: F }}>

      {/* ── Controls ────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Sort by:</span>
          {(["capacity", "share", "plants"] as const).map(opt => (
            <button key={opt} onClick={() => setSortBy(opt)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 20, border: "1px solid",
                borderColor: sortBy === opt ? BAIN_RED : "#e2e8f0",
                background:  sortBy === opt ? "#fff0f0" : "#fff",
                color:       sortBy === opt ? BAIN_RED : "#64748b",
                cursor: "pointer", fontFamily: F, fontWeight: sortBy === opt ? 600 : 400,
              }}>
              {opt === "capacity" ? "Capacity (Mt)" : opt === "share" ? "Market Share" : "Plant Count"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ fontSize: 11, color: "#64748b" }}>Highlight top</span>
          {[1, 3, 5, 10].map(n => (
            <button key={n} onClick={() => setHighlightTop(n)}
              style={{
                fontSize: 11, padding: "3px 8px", borderRadius: 20, border: "1px solid",
                borderColor: highlightTop === n ? BAIN_RED : "#e2e8f0",
                background:  highlightTop === n ? BAIN_RED : "#fff",
                color:       highlightTop === n ? "#fff" : "#64748b",
                cursor: "pointer", fontFamily: F,
              }}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* ── SVG Chart ─────────────────────────────────────────── */}
      <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Gridlines + Y labels */}
          {yTicks.map(tick => {
            const y = innerH - (tick / (maxCap * 1.05)) * innerH;
            return (
              <g key={tick}>
                <line x1={0} x2={innerW} y1={y} y2={y}
                  stroke={tick === 0 ? "#94a3b8" : "#f0f0f0"}
                  strokeWidth={tick === 0 ? 1 : 0.8}
                  strokeDasharray={tick === 0 ? "none" : "4,3"} />
                <text x={-8} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Y axis label */}
          <text
            transform={`translate(-40, ${innerH / 2}) rotate(-90)`}
            textAnchor="middle" fontSize={10} fill="#64748b">
            Capacity (Mt)
          </text>

          {/* Bars */}
          {sorted.map((d, i) => {
            const x    = i * (innerW / sorted.length) + (innerW / sorted.length - barW) / 2;
            const barH = Math.max(1, (d.total_capacity / (maxCap * 1.05)) * innerH);
            const y    = innerH - barH;
            const isHighlighted = i < highlightTop;
            const isHov = hovered === d.company;

            let fillColor = isHighlighted ? BAIN_RED : GREY;
            if (colorMode === "share" && isHighlighted) {
              fillColor = interpolateRed(1 - i / Math.max(highlightTop - 1, 1));
            }

            return (
              <g key={d.company} style={{ cursor: "pointer" }}
                onMouseEnter={e => {
                  setHovered(d.company);
                  const svgRect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  const containerRect = containerRef.current!.getBoundingClientRect();
                  setTooltip({
                    x: x + MARGIN.left + barW / 2,
                    y: y + MARGIN.top,
                    row: d,
                  });
                }}
                onMouseLeave={() => { setHovered(null); setTooltip(null); }}
              >
                {/* Bar shadow on hover */}
                {isHov && (
                  <rect x={x - 1} y={y - 1} width={barW + 2} height={barH + 2}
                    fill="none" stroke={fillColor} strokeWidth={2} opacity={0.5} rx={2} />
                )}
                {/* Bar */}
                <rect x={x} y={y} width={barW} height={barH}
                  fill={fillColor}
                  opacity={hovered && !isHov ? 0.45 : isHighlighted ? 1 : 0.65}
                  rx={2}
                  style={{ transition: "opacity 0.15s" }}
                />
                {/* Value label on top */}
                {barW > 14 && (
                  <text x={x + barW / 2} y={y - 5}
                    textAnchor="middle" fontSize={barW > 20 ? 9 : 7}
                    fill={isHighlighted ? BAIN_RED : "#64748b"}
                    fontWeight={isHighlighted ? 700 : 400}>
                    {d.total_capacity >= 10
                      ? d.total_capacity.toFixed(0)
                      : d.total_capacity.toFixed(1)}
                  </text>
                )}
                {/* Company label — rotated */}
                <text
                  transform={`translate(${x + barW / 2}, ${innerH + 8}) rotate(-40)`}
                  textAnchor="end" fontSize={barW > 16 ? 10 : 8}
                  fill={isHighlighted ? "#1e293b" : "#64748b"}
                  fontWeight={isHighlighted ? 600 : 400}>
                  {d.company.length > 24 ? d.company.slice(0, 22) + "…" : d.company}
                </text>
              </g>
            );
          })}

          {/* Border */}
          <rect x={0} y={0} width={innerW} height={innerH}
            fill="none" stroke="#e5e7eb" strokeWidth={0.8} />
        </g>

        {/* Legend */}
        <g transform={`translate(${MARGIN.left}, ${height - 18})`}>
          <rect width={10} height={10} fill={BAIN_RED} rx={1} />
          <text x={14} y={9} fontSize={10} fill="#555">Top {highlightTop}</text>
          <rect x={70} width={10} height={10} fill={GREY} opacity={0.65} rx={1} />
          <text x={84} y={9} fontSize={10} fill="#555">Others</text>
        </g>
      </svg>

      {/* ── Tooltip ───────────────────────────────────────────── */}
      {tooltip && (() => {
        const tipW = 210;
        const tipH = 180;
        let left = tooltip.x - tipW / 2;
        let top  = tooltip.y - tipH - 16;
        if (left < 0) left = 4;
        if (left + tipW > width) left = width - tipW - 4;
        if (top < 0) top = tooltip.y + 24;
        return (
        <div style={{
          position: "absolute",
          left, top,
          width: tipW,
          background: "#fff",
          border: "0.5px solid #e2e8f0",
          borderRadius: 10,
          padding: "12px 14px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
          fontSize: 12,
          pointerEvents: "none",
          zIndex: 10,
          fontFamily: F,
        }}>
          {/* Rank badge + company */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{
              background: tooltip.row.rank <= highlightTop ? BAIN_RED : "#94a3b8",
              color: "#fff", borderRadius: 4, padding: "1px 6px",
              fontSize: 10, fontWeight: 700,
            }}>#{tooltip.row.rank}</span>
            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>
              {tooltip.row.company}
            </span>
          </div>
          <div style={{ height: 0.5, background: "#f1f5f9", margin: "6px 0" }} />
          {[
            { label: "Total Capacity", value: `${tooltip.row.total_capacity.toFixed(1)} Mt` },
            { label: "Market Share",   value: `${tooltip.row.market_share}%` },
            { label: "Plant Count",    value: `${tooltip.row.plant_count}` },
            { label: "Countries",      value: `${tooltip.row.country_count}` },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 4 }}>
              <span style={{ color: "#64748b", fontSize: 11 }}>{label}</span>
              <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 11 }}>{value}</span>
            </div>
          ))}
          {tooltip.row.countries.length > 0 && (
            <div style={{ marginTop: 8, borderTop: "0.5px solid #f1f5f9", paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4 }}>COUNTRIES</div>
              <div style={{ fontSize: 10, color: "#475569", lineHeight: 1.6 }}>
                {tooltip.row.countries.slice(0, 8).join(", ")}
                {tooltip.row.countries.length > 8 && ` +${tooltip.row.countries.length - 8} more`}
              </div>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}