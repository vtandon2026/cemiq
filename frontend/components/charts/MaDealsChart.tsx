"use client";
// components/charts/MaDealsChart.tsx
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

export interface MaDealRow {
  year: number;
  deal_value_b: number | null;
  deal_count: number;
  deal_value_yoy: number | null;
}

interface Props {
  data: MaDealRow[];
  height?: number;
}

const BAR_COLOR  = "#1A1A1A";   // dark grey bars — deal value
const LINE_COLOR = "#E11C2A";   // red line — deal count

export default function MaDealsChart({ data, height = 420 }: Props) {
  const option = useMemo(() => {
    if (!data.length) return {};

    const years  = data.map(d => String(d.year));
    const values = data.map(d => d.deal_value_b ?? 0);
    const counts = data.map(d => d.deal_count);

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", crossStyle: { color: "#e2e8f0" } },
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
        formatter: (params: { axisValueLabel: string; seriesName: string; value: number; marker: string }[]) => {
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a">${params[0]?.axisValueLabel}</div>`;
          params.forEach(p => {
            const val = p.seriesName === "Deal Count"
              ? `${p.value} deals`
              : `$${p.value.toFixed(1)}B`;
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
        itemGap: 20,
        textStyle: { fontSize: 11, color: "#475569", fontFamily: "Arial, Helvetica, sans-serif" },
      },
      grid: { left: 64, right: 64, top: 32, bottom: 56 },
      xAxis: {
        type: "category",
        data: years,
        axisLabel: {
          fontSize: 11, color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
          rotate: -30,
        },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
      },
      yAxis: [
        {
          type: "value",
          name: "Total deal value ($B)",
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif" },
          axisLabel: {
            formatter: (v: number) => `$${v}B`,
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        {
          type: "value",
          name: "Total deal count",
          nameLocation: "end",
          nameGap: 8,
          nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif" },
          axisLabel: {
            fontSize: 11, color: "#94a3b8",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Deal Value ($B)",
          type: "bar",
          yAxisIndex: 0,
          data: values,
          itemStyle: { color: BAR_COLOR, borderRadius: [2, 2, 0, 0] },
          barMaxWidth: 40,
          label: {
            show: true,
            position: "top",
            formatter: (p: { value: number }) => p.value > 0 ? `${p.value.toFixed(0)}` : "",
            fontSize: 9,
            color: "#374151",
            fontFamily: "Arial, Helvetica, sans-serif",
          },
        },
        {
          name: "Deal Count",
          type: "line",
          yAxisIndex: 1,
          data: counts,
          lineStyle: { color: LINE_COLOR, width: 2 },
          itemStyle: { color: LINE_COLOR },
          symbol: "circle",
          symbolSize: 5,
          smooth: 0.2,
          z: 5,
        },
      ],
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut" as const,
    };
  }, [data]);

  if (!data.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 200, color: "#94a3b8", fontSize: 13,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        No data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      notMerge
      opts={{ renderer: "canvas" }}
    />
  );
}