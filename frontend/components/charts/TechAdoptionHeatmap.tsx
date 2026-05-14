// PATH: frontend/components/charts/TechAdoptionHeatmap.tsx
// Supporting Chart 3 — Future Tech Adoption by Region.
// Rows = tech (CCUS / Clay / Alt Fuel), Cols = region, value = % capacity enabled.
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { GreenHeatmapData } from "@/lib/types";

interface Props {
  data:    GreenHeatmapData | null;
  height?: number;
}

const F = "Arial, Helvetica, sans-serif";

export default function TechAdoptionHeatmap({ data, height = 280 }: Props) {
  const option = useMemo(() => {
    if (!data?.data?.length) return {};

    const xs = data.regions;
    const ys = data.techs.map(t => t.label);

    // ECharts heatmap data shape: [xIndex, yIndex, value]
    // We need to map each cell (tech, region) -> indices.
    const techIdx   = new Map(data.techs.map((t, i) => [t.value, i]));
    const regionIdx = new Map(xs.map((r, i) => [r, i]));

    const series = data.data.map(cell => {
      const xi = regionIdx.get(cell.region);
      const yi = techIdx.get(cell.tech);
      // ECharts treats null/undefined value as "no data" => cell not painted.
      return [xi, yi, cell.value == null ? "-" : cell.value, cell.cap];
    });

    const numericValues = data.data
      .map(d => d.value)
      .filter((v): v is number => v != null);
    const maxVal = numericValues.length ? Math.max(...numericValues) : 0;
    // Round visualMax to a sensible upper bound; never lower than 5 so a
    // sparsely-adopted dataset still produces visible gradients.
    const visualMax = Math.max(5, Math.ceil(maxVal));

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
        formatter: (p: { value: [number, number, number | string, number]; name: string }) => {
          const [xi, yi, v, cap] = p.value;
          const region = xs[xi];
          const tech   = ys[yi];
          const valStr = v === "-" ? "No capacity in region" : `${(v as number).toFixed(1)}%`;
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#0f172a">${tech} · ${region}</div>
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
      grid: { left: 130, right: 30, top: 28, bottom: 80 },
      xAxis: {
        type: "category",
        data: xs,
        splitArea: { show: true },
        axisLabel: { fontSize: 11, color: "#475569", fontFamily: F },
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
        min: 0,
        max: visualMax,
        calculable: true,
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
          formatter: (p: { value: [number, number, number | string] }) => {
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

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
      <div style={{
        fontSize: 10.5, color: "#94a3b8", marginTop: 2,
        fontFamily: F, textAlign: "right", paddingRight: 16,
      }}>
        Cell value = % of regional cement capacity enabled with that technology.
      </div>
    </div>
  );
}