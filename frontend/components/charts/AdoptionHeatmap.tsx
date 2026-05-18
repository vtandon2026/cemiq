// PATH: frontend/components/charts/AdoptionHeatmap.tsx
// Supporting Chart 3 — Future Tech Adoption by Region (or Country when a
// region filter is active and the backend drills down).
//
// Rows = tech (CCUS / Clay Calc / Alt Fuel)
// Cols = regions OR countries (whatever the backend sends in data.regions)
// Cell value = % of column's capacity enabled with that tech
//
// When there are many columns (drill-down can yield 30+ countries), a
// horizontal zoom slider and scroll-wheel zoom let users navigate.
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { GreenHeatmapData } from "@/lib/types";

interface Props {
  data:    GreenHeatmapData | null;
  height?: number;
}

const F = "Arial, Helvetica, sans-serif";

// Show zoom slider when column count exceeds this.
const ZOOM_THRESHOLD = 8;

export default function AdoptionHeatmap({ data, height = 280 }: Props) {
  const option = useMemo(() => {
    if (!data?.data?.length) return {};

    const xs = data.regions;
    const ys = data.techs.map(t => t.label);

    const techIdx   = new Map(data.techs.map((t, i) => [t.value, i]));
    const regionIdx = new Map(xs.map((r, i) => [r, i]));

    const numericValues = data.data
      .map(d => d.value)
      .filter((v): v is number => v != null);
    const minVal = numericValues.length ? Math.min(...numericValues) : 0;
    const maxVal = numericValues.length ? Math.max(...numericValues) : 0;
    const vmMin = 0;
    const vmMax = Math.max(maxVal, minVal + 1, 1);

    const highlightedCols = data.highlighted_cols ?? [];
    const hlSet = new Set(highlightedCols);

    const series = data.data.map(cell => {
      const isHl = hlSet.has(cell.region);
      return {
        value: [
          regionIdx.get(cell.region),
          techIdx.get(cell.tech),
          cell.value == null ? "-" : cell.value,
          cell.cap,
        ],
        itemStyle: isHl
          ? { borderColor: "#E11C2A", borderWidth: 2.5 }
          : undefined,
      };
    });

    const hasZoom = xs.length > ZOOM_THRESHOLD;
    const initialEndPct = hasZoom
      ? Math.min(100, (ZOOM_THRESHOLD / xs.length) * 100)
      : 100;

    const maxXLen = xs.reduce((m, l) => Math.max(m, l.length), 0);
    const rotateX = xs.length > 6 || maxXLen > 10;

    return {
      backgroundColor: "transparent",
      tooltip: {
        position: "top",
        backgroundColor: "#fff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
        formatter: (p: { value?: unknown }) => {
          if (!Array.isArray(p.value) || p.value.length < 4) return "";
          const [xi, yi, v, cap] = p.value as [number, number, number | string, number];
          const colName = xs[xi];
          const tech    = ys[yi];
          if (colName === undefined || tech === undefined) return "";
          const valStr = v === "-" ? "No capacity" : `${(v as number).toFixed(1)}%`;
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#0f172a">${tech} · ${colName}</div>
            <div style="display:flex;flex-direction:column;gap:3px;font-size:11.5px">
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#64748b">Enabled</span>
                <span style="font-weight:600">${valStr}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:16px">
                <span style="color:#64748b">Enabled capacity</span>
                <span style="font-weight:600">${cap.toFixed(2)} Mtpa</span>
              </div>
            </div>`;
        },
      },
      grid: {
        left: 130, right: 30, top: 28,
        bottom: hasZoom ? 120 : 80,
      },
      xAxis: {
        type: "category",
        data: xs,
        splitArea: { show: true },
        axisLabel: {
          fontSize: 11, color: "#475569", fontFamily: F,
          interval: 0,
          rotate: rotateX ? 30 : 0,
          formatter: (v: string) => v.length > 14 ? v.slice(0, 12) + "…" : v,
        },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: ys,
        splitArea: { show: true },
        axisLabel: { fontSize: 11.5, color: "#1e293b", fontFamily: F, fontWeight: 600 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: vmMin,
        max: vmMax,
        calculable: false,
        show: true,
        orient: "horizontal",
        left: "center",
        bottom: 0,
        itemWidth: 14,
        itemHeight: 140,
        textStyle: { fontSize: 10.5, color: "#64748b", fontFamily: F },
        text: ["High", "Low"],
        inRange: {
          color: ["#F0FDF4", "#86EFAC", "#10B981", "#047857"],
        },
        formatter: (v: number) => `${v.toFixed(0)}%`,
      },
      dataZoom: hasZoom ? [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: initialEndPct,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          start: 0,
          end: initialEndPct,
          height: 12,
          bottom: 38,
          left: 130,
          right: 30,
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
        },
      ] : undefined,
      series: [{
        name: "Adoption",
        type: "heatmap",
        data: series,
        label: {
          show: true,
          fontSize: 11,
          fontFamily: F,
          fontWeight: 600,
          color: "#0f172a",
          formatter: (p: { value?: unknown }) => {
            if (!Array.isArray(p.value) || p.value.length < 3) return "";
            const v = p.value[2];
            if (v === "-" || v == null) return "—";
            return `${(v as number).toFixed(1)}%`;
          },
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 2,
        },
        emphasis: {
          itemStyle: {
            borderColor: "#0f172a",
            borderWidth: 1.5,
          },
        },
        progressive: 0,
        animation: true,
        animationDuration: 450,
        animationDurationUpdate: 0,
      }],
    };
  }, [data]);

  if (!data?.data?.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height, color: "#94a3b8", fontSize: 13, fontFamily: F,
      }}>
        No data for the current filters
      </div>
    );
  }

  const effectiveHeight = (data.regions.length > ZOOM_THRESHOLD ? height + 40 : height);

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: effectiveHeight }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
      <div style={{
        fontSize: 10.5, color: "#94a3b8", marginTop: 2,
        fontFamily: F, textAlign: "right", paddingRight: 16,
      }}>
        Cell value = {data.unit ?? "% of regional capacity"}.
        {data.regions.length > ZOOM_THRESHOLD && " Drag the slider or scroll to navigate."}
      </div>
    </div>
  );
}