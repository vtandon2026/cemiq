// PATH: frontend/components/charts/PlantAgeHistogram.tsx
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { CarbonPlantAgeRow } from "@/lib/types";

interface Props {
  data:           CarbonPlantAgeRow[];
  referenceYear:  number;
  height?:        number;
  unit?:          string;
}

const F = "Arial, Helvetica, sans-serif";
const BAIN_RED = "#E11C2A";

export default function PlantAgeHistogram({
  data,
  referenceYear,
  height = 320,
  unit = "Mtpa",
}: Props) {
  const option = useMemo(() => {
    if (!data?.length) return {};

    const buckets = data.map((d) => d.bucket);
    const counts  = data.map((d) => d.count);
    const caps    = data.map((d) => d.capacity);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "shadow" },
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
        confine: true,
        formatter: (params: { axisValueLabel: string; seriesName: string; value: number; marker: string }[]) => {
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a">${params[0]?.axisValueLabel}</div>`;
          params.forEach((p) => {
            const val = p.seriesName === "Capacity"
              ? `${p.value.toFixed(2)} ${unit}`
              : `${p.value} plants`;
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px;font-size:12px">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:600">${val}</span>
            </div>`;
          });
          return html;
        },
      },
      legend: {
        bottom: 4,
        itemGap: 18,
        textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
        // Pin per-item color so legend swatches match bar/line color exactly
        data: [
          { name: "Plants",   itemStyle: { color: BAIN_RED } },
          { name: "Capacity", itemStyle: { color: "#1e293b" } },
        ],
      },
      xAxis: {
        type: "category",
        data: buckets,
        axisLabel: { fontSize: 11, color: "#475569", fontFamily: F, margin: 8 },
        axisLine:  { lineStyle: { color: "#e2e8f0" } },
        axisTick:  { show: false },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Plant count",
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: F },
          axisLabel: { fontSize: 11, color: "#94a3b8", fontFamily: F },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value",
          name: `Capacity (${unit})`,
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: F },
          axisLabel: { fontSize: 11, color: "#94a3b8", fontFamily: F },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Plants",
          type: "bar",
          yAxisIndex: 0,
          data: counts.map((v) => ({
            value: v,
            itemStyle: { color: BAIN_RED, borderRadius: [3, 3, 0, 0] },
          })),
          barMaxWidth: 48,
        },
        {
          name: "Capacity",
          type: "line",
          yAxisIndex: 1,
          data: caps,
          lineStyle: { color: "#1e293b", width: 2 },
          itemStyle: { color: "#1e293b" },
          symbol: "circle",
          symbolSize: 6,
          smooth: 0.2,
          z: 5,
        },
      ],
      grid: { left: 56, right: 56, top: 32, bottom: 56 },
      animation: true,
      animationDuration: 450,
    };
  }, [data, unit]);

  if (!data?.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height, color: "#94a3b8", fontSize: 13, fontFamily: F,
      }}>
        No plants with known start dates for the selected filters
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
        fontSize: 10.5, color: "#94a3b8",
        marginTop: -4, fontFamily: F, textAlign: "right", paddingRight: 16,
      }}>
        Reference year: {referenceYear}. Plants without a recorded start date are excluded.
      </div>
    </div>
  );
}