"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { GrowthData } from "@/lib/types";

interface Props {
  data: GrowthData;
  height?: number;
  label?: string;
  yAxisLabel?:  string;   // custom left-axis name (default "Revenue")
  barLabel?:    string;   // custom series label (default "Historic Revenue")
}

const BAIN_RED   = "#E60000";
const HIST_BAR   = "#1A1A1A";
const HIST_LINE  = "#666666";
const FCST_LINE  = "#0000FF";

export default function GrowthChart({ data, height = 520, label, yAxisLabel, barLabel }: Props) {
  const option = useMemo(() => {
    if (!data?.years?.length) return {};

    const { years, revenue, yoy, cutoff_year } = data;
    const cutoff = cutoff_year ?? 2024;

    const getR = (y: number) => revenue[String(y)] ?? null;
    const getY = (y: number) => {
      const v = yoy[String(y)];
      return v != null ? v * 100 : null;
    };

    return {
      backgroundColor: "transparent",

      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
        axisPointer: {
          type: "cross",
          lineStyle:  { color: "#e2e8f0", width: 1, type: "dashed" },
          crossStyle: { color: "#e2e8f0", width: 1 },
          label: { show: false },
        },
        formatter: (params: { axisValueLabel: string; seriesName: string; value: number | null; marker: string }[]) => {
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a">${params[0]?.axisValueLabel}</div>`;
          params.forEach((p) => {
            if (p.value == null) return;
            const val = p.seriesName.includes("YoY")
              ? `${p.value.toFixed(1)}%`
              : p.value.toLocaleString();
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px;font-size:12px">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:600">${val}</span>
            </div>`;
          });
          return html;
        },
      },

      // Default legend — ECharts auto-renders rect for bars, line+circle for lines
      legend: {
        bottom: 4,
        itemGap: 16,
        textStyle: { fontSize: 11, color: "#475569", fontFamily: "Arial, Helvetica, sans-serif" },
      },

      xAxis: {
        type: "category",
        data: years.map(String),
        axisLabel: {
          rotate: -30,
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 8,
        },
        axisLine:  { lineStyle: { color: "#e2e8f0" } },
        axisTick:  { show: false },
        splitLine: { show: false },
      },

      yAxis: [
        {
          type: "value",
          name: yAxisLabel ?? "Revenue",
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: {
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLabel: {
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLine:  { show: false },
          axisTick:  { show: false },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value",
          name: "YoY %",
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: {
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLabel: {
            formatter: (v: number) => `${v.toFixed(0)}%`,
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLine:  { show: false },
          axisTick:  { show: false },
          splitLine: { show: false },
        },
      ],

      series: [
        {
          name: barLabel ? `Historic ${barLabel}` : "Historic Revenue",
          type: "bar",
          yAxisIndex: 0,
          data: years.map((y) => (y <= cutoff ? getR(y) : null)),
          itemStyle: {
            color: HIST_BAR,
            borderRadius: [3, 3, 0, 0],
          },
          emphasis: { itemStyle: { opacity: 1 } },
          barMaxWidth: 32,
          opacity: 0.9,
        },
        {
          name: barLabel ? `Forecast ${barLabel}` : "Forecast Revenue",
          type: "bar",
          yAxisIndex: 0,
          data: years.map((y) => (y > cutoff ? getR(y) : null)),
          itemStyle: {
            color: "#E11C2A",
            borderRadius: [3, 3, 0, 0],
          },
          barMaxWidth: 32,
        },
        {
          name: "Historic YoY",
          type: "line",
          yAxisIndex: 1,
          data: years.map((y) => (y <= cutoff ? getY(y) : null)),
          lineStyle: { color: HIST_LINE, width: 2 },
          itemStyle: { color: HIST_LINE },
          symbol: "circle",
          symbolSize: 5,
          smooth: 0.2,
          connectNulls: false,
          z: 5,
        },
        {
          name: "Forecast YoY",
          type: "line",
          yAxisIndex: 1,
          data: years.map((y) => (y >= cutoff ? getY(y) : null)),
          lineStyle: { color: FCST_LINE, width: 2, type: "dashed" },
          itemStyle: { color: FCST_LINE },
          symbol: "circle",
          symbolSize: 5,
          smooth: 0.2,
          connectNulls: false,
          z: 5,
        },
      ],

      // COVID markLine on the bars series
      graphic: [
        {
          type: "line",
          shape: { x1: 0, y1: 0, x2: 0, y2: 0 },
          silent: true,
        },
      ],

      grid: { left: 80, right: 80, top: 32, bottom: 72 },

      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut" as const,
    };
  }, [data]);

  if (!data?.years?.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 160, color: "#94a3b8", fontSize: 13,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        No data available
      </div>
    );
  }

  return (
    <div>
      {label && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, fontFamily: "Arial, Helvetica, sans-serif" }}>
          COVID-19 markers: 2019 / 2020
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}