"use client";
// PATH: frontend/components/charts/TransitionMatrixChart.tsx
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { REGION_COLORS, F, type MatrixRow } from "./transitionTypes";

interface Props {
  data:    MatrixRow[];
  height?: number;
}

export default function TransitionMatrixChart({ data, height = 480 }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const echartsRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const zoomScaleRef = useRef(1);
  const wrapperRef   = useRef<HTMLDivElement>(null);

  const option = useMemo(() => {
    if (!data.length) return {};

    const regions = Array.from(new Set(data.map(d => d.region)));
    const maxCap  = Math.max(...data.map(d => d.total_capacity), 1);
    const minCap  = Math.min(...data.map(d => d.total_capacity));

    const baseSize = (cap: number) => {
      if (cap <= 0) return 8;
      if (maxCap === minCap) return 18;
      const t = Math.sqrt((cap - minCap) / (maxCap - minCap));
      return 8 + t * 36;
    };

    const symbolSizeFn = (_v: number[], params: { data: { _baseSize: number } }) => {
      const base  = params?.data?._baseSize ?? 12;
      const scale = Math.min(zoomScaleRef.current, 4);
      return base * scale;
    };

    const series = regions.map(region => ({
      name: region,
      type: "scatter",
      data: data
        .filter(d => d.region === region)
        .map(d => ({
          value: [d.carbon_exposure, d.readiness_score, d.total_capacity],
          name:  d.name,
          _baseSize: baseSize(d.total_capacity),
          _row: d,
          itemStyle: {
            color:       REGION_COLORS[region] ?? "#94a3b8",
            opacity:     0.82,
            borderColor: "rgba(255,255,255,0.9)",
            borderWidth: 1,
          },
          emphasis: {
            itemStyle: { opacity: 1, borderColor: "#0f172a", borderWidth: 1.5 },
          },
        })),
      symbolSize: symbolSizeFn,
    }));

    return {
      color: [],
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.12);border-radius:10px;",
        confine: true,
        formatter: (p: { name: string; seriesName: string; color: string; data: { _row: MatrixRow } }) => {
          const d = p.data._row;
          return `
            <div style="font-weight:700;margin-bottom:5px;color:#0f172a;font-size:13px">${d.name}</div>
            <div style="display:flex;align-items:center;gap:5px;font-size:10px;color:#64748b;margin-bottom:6px">
              <span style="width:8px;height:8px;border-radius:50%;background:${p.color};display:inline-block"></span>
              ${d.region}${d.country ? ` · ${d.country}` : ""}
            </div>
            <div style="height:0.5px;background:#f1f5f9;margin-bottom:6px"></div>
            ${[
              ["Capacity",         `${d.total_capacity.toFixed(0)} Mt`],
              ["Carbon Exposure",  `${d.carbon_exposure.toFixed(0)} / 100`],
              ["Readiness Score",  `${d.readiness_score.toFixed(0)} / 100`],
              ["Wet Process",      `${d.wet_share.toFixed(0)}%`],
              ["Alt Fuel",         `${d.alt_fuel_pct.toFixed(0)}%`],
              ["CCUS",             `${d.ccus_pct.toFixed(0)}%`],
              ["Clay Calcination", `${d.clay_pct.toFixed(0)}%`],
            ].map(([label, value]) =>
              `<div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:2px">
                <span style="color:#64748b;font-size:11px">${label}</span>
                <span style="font-weight:600;color:#1e293b;font-size:11px">${value}</span>
              </div>`
            ).join("")}`;
        },
      },
      legend: {
        bottom: 0,
        itemGap: 14,
        textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
        data: regions.map(r => ({ name: r, itemStyle: { color: REGION_COLORS[r] ?? "#94a3b8" } })),
      },
      grid: { left: 56, right: 56, top: 48, bottom: 100 },
      xAxis: {
        type: "value",
        name: "Carbon Exposure →",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: { fontSize: 11, color: "#64748b", fontFamily: F },
        min: 0, max: 100,
        axisLabel: { fontSize: 10, color: "#94a3b8", fontFamily: F },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: "Future Readiness →",
        nameLocation: "middle",
        nameGap: 40,
        nameTextStyle: { fontSize: 11, color: "#64748b", fontFamily: F },
        min: 0, max: 100,
        axisLabel: { fontSize: 10, color: "#94a3b8", fontFamily: F },
        splitLine: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
      },

      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0, end: 100,
          filterMode: "none",
          zoomOnMouseWheel: "ctrl",
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: false,
        },
        {
          type: "inside",
          yAxisIndex: 0,
          orient: "vertical",
          start: 0, end: 100,
          filterMode: "none",
          zoomOnMouseWheel: "ctrl",
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: false,
        },
        // Horizontal slider
        {
          type: "slider",
          xAxisIndex: 0,
          filterMode: "none",
          height: 12,
          bottom: 36,
          left: 56, right: 56,
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
        },
        // Vertical slider
        {
          type: "slider",
          yAxisIndex: 0,
          filterMode: "none",
          width: 12,
          right: 26,
          top: 48, bottom: 100,
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
        },
      ],
      series: [
        // ── Quadrant background series (markArea follows axis zoom) ──────────
        {
          type: "scatter",
          data: [],
          silent: true,
          markArea: {
            silent: true,
            data: [
              // Resilient Leaders — low exposure (x<50), high readiness (y>50)
              [
                { coord: [0,  50], itemStyle: { color: "rgba(5,150,105,0.07)" },
                  label: { show: true, position: "insideTopLeft", offset: [6, 6],
                           formatter: "Resilient Leaders", color: "#059669",
                           fontSize: 10, fontWeight: "bold", opacity: 0.8 } },
                { coord: [50, 100] },
              ],
              // Transforming Giants — high exposure (x>50), high readiness (y>50)
              [
                { coord: [50, 50], itemStyle: { color: "rgba(251,191,36,0.07)" },
                  label: { show: true, position: "insideTopLeft", offset: [6, 6],
                           formatter: "Transforming Giants", color: "#d97706",
                           fontSize: 10, fontWeight: "bold", opacity: 0.8 } },
                { coord: [100, 100] },
              ],
              // Stable but Lagging — low exposure (x<50), low readiness (y<50)
              [
                { coord: [0,  0],  itemStyle: { color: "rgba(148,163,184,0.06)" },
                  label: { show: true, position: "insideTopLeft", offset: [6, 6],
                           formatter: "Stable but Lagging", color: "#94a3b8",
                           fontSize: 10, fontWeight: "bold", opacity: 0.8 } },
                { coord: [50, 50] },
              ],
              // Transition Risk — high exposure (x>50), low readiness (y<50)
              [
                { coord: [50, 0],  itemStyle: { color: "rgba(220,38,38,0.07)" },
                  label: { show: true, position: "insideTopLeft", offset: [6, 6],
                           formatter: "⚠ Transition Risk", color: "#dc2626",
                           fontSize: 10, fontWeight: "bold", opacity: 0.8 } },
                { coord: [100, 50] },
              ],
            ],
          },
          markLine: {
            silent: true,
            symbol: ["none", "none"],
            lineStyle: { color: "#e2e8f0", width: 1, type: "dashed" },
            data: [
              { xAxis: 50 },   // vertical divider
              { yAxis: 50 },   // horizontal divider
            ],
          },
        },
        ...series,
      ],
      animation: true,
      animationDuration: 450,
      animationDurationUpdate: 0,
    };
  }, [data]);

  // Track zoom state for reset button
  useEffect(() => {
    if (!data.length) return;
    const timer = setTimeout(() => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      const readState = () => {
        const opt   = inst.getOption();
        const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
        const anyZoomed = dzArr.some(dz => (dz?.start ?? 0) > 0.5 || (dz?.end ?? 100) < 99.5);
        setIsZoomed(anyZoomed);
        let narrowest = 100;
        for (const dz of dzArr) {
          const span = Math.max(1, (dz?.end ?? 100) - (dz?.start ?? 0));
          if (span < narrowest) narrowest = span;
        }
        const scale = 100 / narrowest;
        if (Math.abs(scale - zoomScaleRef.current) > 0.01) {
          zoomScaleRef.current = scale;
          try { inst.setOption({}, { lazyUpdate: true }); } catch { /* disposed */ }
        }
      };
      readState();
      inst.off("datazoom");
      inst.on("datazoom", readState);
    }, 0);
    return () => {
      clearTimeout(timer);
      try { echartsRef.current?.getEchartsInstance?.()?.off("datazoom"); } catch { /* disposed */ }
    };
  }, [data]);

  // Wheel-to-pan with rAF throttling
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    let pendingDx = 0, pendingDy = 0;
    let rafId: number | null = null;
    const flush = () => {
      rafId = null;
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) { pendingDx = 0; pendingDy = 0; return; }
      const opt   = inst.getOption();
      const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
      if (dzArr.length < 2) { pendingDx = 0; pendingDy = 0; return; }
      const xStart = dzArr[0]?.start ?? 0, xEnd = dzArr[0]?.end ?? 100;
      const yStart = dzArr[1]?.start ?? 0, yEnd = dzArr[1]?.end ?? 100;
      const xWidth = xEnd - xStart, yHeight = yEnd - yStart;
      const dxPct = (pendingDx / el.clientWidth)  * xWidth  * 1.0;
      const dyPct = (pendingDy / el.clientHeight) * yHeight * 1.0;
      pendingDx = 0; pendingDy = 0;
      let nxS = xStart + dxPct, nxE = xEnd + dxPct;
      if (nxS < 0)   { nxE -= nxS; nxS = 0; }
      if (nxE > 100) { nxS -= (nxE - 100); nxE = 100; }
      let nyS = yStart - dyPct, nyE = yEnd - dyPct;
      if (nyS < 0)   { nyE -= nyS; nyS = 0; }
      if (nyE > 100) { nyS -= (nyE - 100); nyE = 100; }
      if (Math.abs(nxS - xStart) < 0.01 && Math.abs(nyS - yStart) < 0.01) return;
      inst.dispatchAction({ type: "dataZoom", batch: [
        { dataZoomIndex: 0, start: nxS, end: nxE },
        { dataZoomIndex: 1, start: nyS, end: nyE },
      ]});
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      pendingDx += e.deltaX;
      pendingDy += e.deltaY;
      if (rafId === null) rafId = requestAnimationFrame(flush);
    };
    el.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const doReset = () => {
    const inst = echartsRef.current?.getEchartsInstance?.();
    if (!inst) return;
    inst.dispatchAction({ type: "dataZoom", batch: [
      { dataZoomIndex: 0, start: 0, end: 100 },
      { dataZoomIndex: 1, start: 0, end: 100 },
    ]});
    setIsZoomed(false);
  };

  if (!data.length) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height, color: "#94a3b8", fontSize: 13 }}>
      No data available
    </div>
  );

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%", cursor: "grab" }}
      onMouseDown={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grabbing"; }}
      onMouseUp={e   => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
    >
      <ReactECharts
        ref={echartsRef}
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />

      {/* Reset zoom button */}
      {isZoomed && (
        <button onClick={doReset} title="Reset zoom"
          style={{
            position: "absolute", top: 8, right: 48,
            width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#fff", color: "#475569",
            border: "1px solid #cbd5e1", borderRadius: 6,
            cursor: "pointer", padding: 0,
            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
            zIndex: 7,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "#fef2f2";
            (e.currentTarget as HTMLElement).style.color = "#E11C2A";
            (e.currentTarget as HTMLElement).style.borderColor = "#E11C2A";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "#fff";
            (e.currentTarget as HTMLElement).style.color = "#475569";
            (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" />
          </svg>
        </button>
      )}

      <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4, fontFamily: F, textAlign: "right", paddingRight: 16 }}>
        Bubble size = total capacity. Pinch/Ctrl+scroll to zoom · drag to pan.
      </div>
    </div>
  );
}