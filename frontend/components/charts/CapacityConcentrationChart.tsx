// // "use client";
// // // components/charts/CapacityConcentrationChart.tsx
// // import ReactECharts from "echarts-for-react";
// // import { useMemo } from "react";

// // export interface ConcentrationRow {
// //   country: string;
// //   total_capacity: number;
// //   top3_capacity: number;
// //   top3_share: number;
// //   other_share: number;
// //   top3_owners: { owner: string; capacity: number }[];
// // }

// // interface Props {
// //   data: ConcentrationRow[];
// //   height?: number;
// // }

// // const BAIN_RED = "#E11C2A";
// // const GREY     = "#B0B0B0";

// // export default function CapacityConcentrationChart({ data, height = 560 }: Props) {
// //   const option = useMemo(() => {
// //     if (!data.length) return {};

// //     // Sort descending by top3_share (already sorted from backend, but ensure)
// //     const sorted = [...data].sort((a, b) => b.top3_share - a.top3_share);
// //     const countries     = sorted.map(r => r.country);
// //     const top3Shares    = sorted.map(r => r.top3_share);
// //     const otherShares   = sorted.map(r => r.other_share);
// //     const totals        = sorted.map(r => r.total_capacity);

// //     return {
// //       backgroundColor: "transparent",
// //       tooltip: {
// //         trigger: "axis",
// //         axisPointer: { type: "shadow" },
// //         backgroundColor: "#ffffff",
// //         borderColor: "#e2e8f0",
// //         borderWidth: 1,
// //         padding: [10, 14],
// //         extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
// //         textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
// //         formatter: (params: { dataIndex: number }[]) => {
// //           const i = params[0].dataIndex;
// //           const row = sorted[i];
// //           const ownersHtml = row.top3_owners
// //             .map(o => `<div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px;font-size:11px">
// //               <span style="color:#475569">${o.owner}</span>
// //               <span style="font-weight:600">${o.capacity.toFixed(1)} Mt</span>
// //             </div>`)
// //             .join("");
// //           return `
// //             <div style="font-weight:700;margin-bottom:6px;color:#0f172a;font-size:13px">${row.country}</div>
// //             <div style="display:flex;justify-content:space-between;gap:16px;font-size:12px;margin-bottom:4px">
// //               <span>Total capacity</span><span style="font-weight:600">${row.total_capacity.toFixed(1)} Mt</span>
// //             </div>
// //             <div style="display:flex;justify-content:space-between;gap:16px;font-size:12px">
// //               <span style="color:${BAIN_RED}">Top 3 share</span>
// //               <span style="font-weight:700;color:${BAIN_RED}">${row.top3_share.toFixed(1)}%</span>
// //             </div>
// //             <div style="height:1px;background:#f1f5f9;margin:6px 0"></div>
// //             <div style="font-size:11px;font-weight:600;color:#94a3b8;margin-bottom:3px">TOP 3 OWNERS</div>
// //             ${ownersHtml}
// //           `;
// //         },
// //       },
// //       legend: {
// //         bottom: 4,
// //         itemGap: 20,
// //         textStyle: { fontSize: 11, color: "#475569", fontFamily: "Arial, Helvetica, sans-serif" },
// //         data: [
// //           { name: "Top 3", icon: "rect" },
// //           { name: "Other", icon: "rect" },
// //         ],
// //       },
// //       grid: { left: 140, right: 60, top: 28, bottom: 48 },
// //       xAxis: {
// //         type: "value",
// //         min: 0,
// //         max: 100,
// //         axisLabel: {
// //           formatter: (v: number) => `${v}%`,
// //           fontSize: 11, color: "#94a3b8",
// //           fontFamily: "Arial, Helvetica, sans-serif",
// //         },
// //         axisLine: { show: false },
// //         axisTick: { show: false },
// //         splitLine: { lineStyle: { color: "#f1f5f9" } },
// //       },
// //       yAxis: {
// //         type: "category",
// //         data: countries,
// //         inverse: false,
// //         axisLabel: {
// //           fontSize: 11, color: "#374151",
// //           fontFamily: "Arial, Helvetica, sans-serif",
// //           width: 120,
// //           overflow: "truncate",
// //         },
// //         axisLine: { show: false },
// //         axisTick: { show: false },
// //       },
// //       series: [
// //         {
// //           name: "Top 3",
// //           type: "bar",
// //           stack: "share",
// //           data: top3Shares,
// //           itemStyle: { color: BAIN_RED },
// //           barMaxWidth: 28,
// //           label: {
// //             show: true,
// //             position: "insideLeft",
// //             formatter: (p: { dataIndex: number }) => {
// //               const v = top3Shares[p.dataIndex];
// //               return v > 8 ? `${v.toFixed(0)}%` : "";
// //             },
// //             fontSize: 10,
// //             color: "#fff",
// //             fontFamily: "Arial, Helvetica, sans-serif",
// //             fontWeight: 600,
// //           },
// //         },
// //         {
// //           name: "Other",
// //           type: "bar",
// //           stack: "share",
// //           data: otherShares,
// //           itemStyle: { color: GREY },
// //           barMaxWidth: 28,
// //           // Show total capacity as label at end of bar
// //           label: {
// //             show: true,
// //             position: "right",
// //             formatter: (p: { dataIndex: number }) => `${totals[p.dataIndex].toFixed(0)} Mt`,
// //             fontSize: 10,
// //             color: "#94a3b8",
// //             fontFamily: "Arial, Helvetica, sans-serif",
// //           },
// //         },
// //       ],
// //       animation: true,
// //       animationDuration: 500,
// //       animationEasing: "cubicOut" as const,
// //     };
// //   }, [data]);

// //   if (!data.length) {
// //     return (
// //       <div style={{
// //         display: "flex", alignItems: "center", justifyContent: "center",
// //         height: 200, color: "#94a3b8", fontSize: 13,
// //         fontFamily: "Arial, Helvetica, sans-serif",
// //       }}>
// //         No data available
// //       </div>
// //     );
// //   }

// //   // Dynamic height: at least 400, grow with number of countries
// //   const chartH = Math.max(height, data.length * 36 + 80);

// //   return (
// //     <ReactECharts
// //       option={option}
// //       style={{ height: chartH }}
// //       notMerge
// //       opts={{ renderer: "canvas" }}
// //     />
// //   );
// // }











// "use client";
// // components/charts/CapacityConcentrationChart.tsx
// // Mekko-style: bar WIDTH ∝ total capacity, bar HEIGHT = Top3 share %
// import { useMemo, useRef, useEffect, useState } from "react";

// export interface ConcentrationRow {
//   country: string;
//   total_capacity: number;
//   top3_capacity: number;
//   top3_share: number;
//   other_share: number;
//   top3_owners: { owner: string; capacity: number }[];
// }

// interface Props {
//   data: ConcentrationRow[];
// }

// const BAIN_RED = "#CC0000";
// const GREY     = "#C8C8C8";
// const GAP      = 2; // px gap between bars

// export default function CapacityConcentrationChart({ data }: Props) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [width, setWidth] = useState(900);
//   const [tooltip, setTooltip] = useState<{ x: number; y: number; row: ConcentrationRow } | null>(null);

//   // Responsive width
//   useEffect(() => {
//     const obs = new ResizeObserver(entries => {
//       setWidth(entries[0].contentRect.width || 900);
//     });
//     if (containerRef.current) obs.observe(containerRef.current);
//     return () => obs.disconnect();
//   }, []);

//   const MARGIN = { top: 32, right: 16, bottom: 80, left: 40 };
//   const chartH  = 340;
//   const innerW  = width - MARGIN.left - MARGIN.right;
//   const innerH  = chartH - MARGIN.top - MARGIN.bottom;

//   const bars = useMemo(() => {
//     if (!data.length) return [];
//     const totalCap = data.reduce((s, r) => s + r.total_capacity, 0);
//     const totalGap  = GAP * (data.length - 1);
//     const drawableW = innerW - totalGap;
//     let x = 0;
//     return data.map(r => {
//       const bw   = (r.total_capacity / totalCap) * drawableW;
//       const top3H = (r.top3_share / 100) * innerH;
//       const bar = { ...r, x, bw, top3H };
//       x += bw + GAP;
//       return bar;
//     });
//   }, [data, innerW, innerH]);

//   // Y-axis ticks
//   const yTicks = [0, 20, 40, 60, 80, 100];

//   if (!data.length) {
//     return (
//       <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13, fontFamily: "Arial, Helvetica, sans-serif" }}>
//         No data available
//       </div>
//     );
//   }

//   return (
//     <div ref={containerRef} style={{ width: "100%", position: "relative", fontFamily: "Arial, Helvetica, sans-serif" }}>
//       <svg width={width} height={chartH} style={{ display: "block", overflow: "visible" }}>
//         <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

//           {/* Y gridlines + labels */}
//           {yTicks.map(t => {
//             const y = innerH - (t / 100) * innerH;
//             return (
//               <g key={t}>
//                 <line x1={0} x2={innerW} y1={y} y2={y}
//                   stroke={t === 0 ? "#999" : "#e5e5e5"} strokeWidth={t === 0 ? 1 : 0.8} />
//                 <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="#888">{t}%</text>
//               </g>
//             );
//           })}

//           {/* Bars */}
//           {bars.map((b) => {
//             const otherH = innerH - b.top3H;
//             return (
//               <g key={b.country}
//                 transform={`translate(${b.x}, 0)`}
//                 style={{ cursor: "pointer" }}
//                 onMouseEnter={e => {
//                   const svgRect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
//                   setTooltip({
//                     x: b.x + MARGIN.left + b.bw / 2,
//                     y: MARGIN.top,
//                     row: b,
//                   });
//                 }}
//                 onMouseLeave={() => setTooltip(null)}
//               >
//                 {/* Total capacity label on top */}
//                 <text
//                   x={b.bw / 2} y={-6}
//                   textAnchor="middle" fontSize={9} fill="#333" fontWeight={600}
//                 >
//                   {b.total_capacity >= 10
//                     ? Math.round(b.total_capacity)
//                     : b.total_capacity.toFixed(1)}
//                 </text>

//                 {/* Grey (Other) — top portion */}
//                 <rect x={0} y={0} width={b.bw} height={otherH} fill={GREY} />

//                 {/* Red (Top 3) — bottom portion */}
//                 <rect x={0} y={otherH} width={b.bw} height={b.top3H} fill={BAIN_RED} />

//                 {/* White divider line */}
//                 <line x1={0} x2={b.bw} y1={otherH} y2={otherH} stroke="#fff" strokeWidth={1.5} />

//                 {/* Country label — rotated */}
//                 <text
//                   transform={`translate(${b.bw / 2}, ${innerH + 8}) rotate(-45)`}
//                   textAnchor="end"
//                   fontSize={10}
//                   fill="#333"
//                 >
//                   {b.country}
//                 </text>
//               </g>
//             );
//           })}

//           {/* Border box */}
//           <rect x={0} y={0} width={innerW} height={innerH} fill="none" stroke="#bbb" strokeWidth={0.8} />
//         </g>

//         {/* Legend */}
//         <g transform={`translate(${width / 2 - 70}, ${chartH - 16})`}>
//           <rect width={12} height={12} fill={GREY} rx={1} />
//           <text x={16} y={10} fontSize={11} fill="#555">Other</text>
//           <rect x={70} width={12} height={12} fill={BAIN_RED} rx={1} />
//           <text x={86} y={10} fontSize={11} fill="#555">Top 3</text>
//         </g>
//       </svg>

//       {/* Tooltip */}
//       {tooltip && (
//         <div style={{
//           position: "absolute",
//           left: tooltip.x,
//           top: tooltip.y,
//           transform: "translateX(-50%)",
//           background: "#fff",
//           border: "1px solid #e2e8f0",
//           borderRadius: 8,
//           padding: "10px 14px",
//           boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
//           fontSize: 12,
//           pointerEvents: "none",
//           zIndex: 10,
//           minWidth: 180,
//           fontFamily: "Arial, Helvetica, sans-serif",
//         }}>
//           <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a", fontSize: 13 }}>
//             {tooltip.row.country}
//           </div>
//           <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
//             <span style={{ color: "#475569" }}>Total capacity</span>
//             <span style={{ fontWeight: 600 }}>{tooltip.row.total_capacity.toFixed(1)} Mt</span>
//           </div>
//           <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
//             <span style={{ color: BAIN_RED }}>Top 3 share</span>
//             <span style={{ fontWeight: 700, color: BAIN_RED }}>{tooltip.row.top3_share.toFixed(1)}%</span>
//           </div>
//           <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0 6px" }} />
//           <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>TOP 3 OWNERS</div>
//           {tooltip.row.top3_owners.map(o => (
//             <div key={o.owner} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, marginTop: 2 }}>
//               <span style={{ color: "#475569" }}>{o.owner}</span>
//               <span style={{ fontWeight: 600 }}>{o.capacity.toFixed(1)} Mt</span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }









"use client";
// components/charts/CapacityConcentrationChart.tsx
// Mekko-style: bar WIDTH ∝ total capacity, bar HEIGHT = Top3 share %
import { useMemo, useRef, useEffect, useState } from "react";

export interface ConcentrationRow {
  country: string;
  total_capacity: number;
  top3_capacity: number;
  top3_share: number;
  other_share: number;
  top3_owners: { owner: string; capacity: number }[];
}

interface Props {
  data: ConcentrationRow[];
}

const BAIN_RED = "#CC0000";
const GREY     = "#C8C8C8";
const GAP      = 2; // px gap between bars

export default function CapacityConcentrationChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; row: ConcentrationRow } | null>(null);

  // Responsive width
  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width || 900);
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const MARGIN = { top: 32, right: 16, bottom: 80, left: 40 };
  const chartH  = 520;
  const innerW  = width - MARGIN.left - MARGIN.right;
  const innerH  = chartH - MARGIN.top - MARGIN.bottom;

  const bars = useMemo(() => {
    if (!data.length) return [];
    const totalCap = data.reduce((s, r) => s + r.total_capacity, 0);
    const totalGap  = GAP * (data.length - 1);
    const drawableW = innerW - totalGap;
    let x = 0;
    return data.map(r => {
      const bw   = (r.total_capacity / totalCap) * drawableW;
      const top3H = (r.top3_share / 100) * innerH;
      const bar = { ...r, x, bw, top3H };
      x += bw + GAP;
      return bar;
    });
  }, [data, innerW, innerH]);

  // Y-axis ticks
  const yTicks = [0, 20, 40, 60, 80, 100];

  if (!data.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 200, color: "#94a3b8", fontSize: 13, fontFamily: "Arial, Helvetica, sans-serif" }}>
        No data available
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative", fontFamily: "Arial, Helvetica, sans-serif" }}>
      <svg width={width} height={chartH} style={{ display: "block", overflow: "visible" }}>
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

          {/* Y gridlines + labels */}
          {yTicks.map(t => {
            const y = innerH - (t / 100) * innerH;
            return (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y} y2={y}
                  stroke={t === 0 ? "#999" : "#e5e5e5"} strokeWidth={t === 0 ? 1 : 0.8} />
                <text x={-6} y={y + 4} textAnchor="end" fontSize={10} fill="#888">{t}%</text>
              </g>
            );
          })}

          {/* Bars */}
          {bars.map((b) => {
            const otherH = innerH - b.top3H;
            return (
              <g key={b.country}
                transform={`translate(${b.x}, 0)`}
                style={{ cursor: "pointer" }}
                onMouseEnter={e => {
                  const svgRect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                  setTooltip({
                    x: b.x + MARGIN.left + b.bw / 2,
                    y: MARGIN.top,
                    row: b,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Total capacity label on top */}
                <text
                  x={b.bw / 2} y={-6}
                  textAnchor="middle" fontSize={9} fill="#333" fontWeight={600}
                >
                  {b.total_capacity >= 10
                    ? Math.round(b.total_capacity)
                    : b.total_capacity.toFixed(1)}
                </text>

                {/* Grey (Other) — top portion */}
                <rect x={0} y={0} width={b.bw} height={otherH} fill={GREY} />

                {/* Red (Top 3) — bottom portion */}
                <rect x={0} y={otherH} width={b.bw} height={b.top3H} fill={BAIN_RED} />

                {/* White divider line */}
                <line x1={0} x2={b.bw} y1={otherH} y2={otherH} stroke="#fff" strokeWidth={1.5} />

                {/* Country label — rotated */}
                <text
                  transform={`translate(${b.bw / 2}, ${innerH + 8}) rotate(-45)`}
                  textAnchor="end"
                  fontSize={10}
                  fill="#333"
                >
                  {b.country}
                </text>
              </g>
            );
          })}

          {/* Border box */}
          <rect x={0} y={0} width={innerW} height={innerH} fill="none" stroke="#bbb" strokeWidth={0.8} />
        </g>

        {/* Legend */}
        <g transform={`translate(${width / 2 - 70}, ${chartH - 16})`}>
          <rect width={12} height={12} fill={GREY} rx={1} />
          <text x={16} y={10} fontSize={11} fill="#555">Other</text>
          <rect x={70} width={12} height={12} fill={BAIN_RED} rx={1} />
          <text x={86} y={10} fontSize={11} fill="#555">Top 3</text>
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: "absolute",
          left: tooltip.x,
          top: tooltip.y,
          transform: "translateX(-50%)",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          padding: "10px 14px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          fontSize: 12,
          pointerEvents: "none",
          zIndex: 10,
          minWidth: 180,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: "#0f172a", fontSize: 13 }}>
            {tooltip.row.country}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 2 }}>
            <span style={{ color: "#475569" }}>Total capacity</span>
            <span style={{ fontWeight: 600 }}>{tooltip.row.total_capacity.toFixed(1)} Mt</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 6 }}>
            <span style={{ color: BAIN_RED }}>Top 3 share</span>
            <span style={{ fontWeight: 700, color: BAIN_RED }}>{tooltip.row.top3_share.toFixed(1)}%</span>
          </div>
          <div style={{ height: 1, background: "#f1f5f9", margin: "4px 0 6px" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", marginBottom: 4 }}>TOP 3 OWNERS</div>
          {tooltip.row.top3_owners.map(o => (
            <div key={o.owner} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 11, marginTop: 2 }}>
              <span style={{ color: "#475569" }}>{o.owner}</span>
              <span style={{ fontWeight: 600 }}>{o.capacity.toFixed(1)} Mt</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}