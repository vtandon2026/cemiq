// PATH: frontend/components/charts/StockPriceChart.tsx
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { StockPriceData } from "@/lib/types";
import { BAIN_RED, COMPARE_PALETTE } from "@/lib/chartHelpers";

interface Props {
  data: StockPriceData;
  mainCompany: string;
  height?: number;
}

export default function StockPriceChart({ data, mainCompany, height = 520 }: Props) {
  const option = useMemo(() => {
    if (!data?.dates?.length) return {};

    let palIdx = 0;
    const series = Object.entries(data.series).map(([company, vals]) => {
      const isMain = company === mainCompany;
      const color  = isMain ? BAIN_RED : COMPARE_PALETTE[palIdx++ % COMPARE_PALETTE.length];
      return {
        name:      company,
        type:      "line",
        data:      vals,
        smooth:    0.3,
        lineStyle: {
          width: isMain ? 2.5 : 1.5,
          color,
          type: isMain ? "solid" : "solid",
        },
        itemStyle: { color },
        symbol:    "circle",
        symbolSize: isMain ? 6 : 4,
        emphasis: {
          focus: "series",
          lineStyle: { width: isMain ? 3.5 : 2.5 },
        },
        connectNulls: false,
        z: isMain ? 10 : 1,
      };
    });

    return {
      backgroundColor: "transparent",

      tooltip: {
        trigger: "axis",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
        extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.10); border-radius: 8px;",
        formatter: (
          params: { seriesName: string; value: number | null; marker: string; dataIndex: number }[],
        ) => {
          const date = data.dates[params[0]?.dataIndex] ?? "";
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a;font-size:12px">${date}</div>`;
          params
            .filter((p) => p.value != null)
            .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
            .forEach((p) => {
              const rawPrice = data.raw_prices[p.seriesName]?.[p.dataIndex];
              const priceStr = rawPrice != null
                ? `<span style="color:#94a3b8;font-size:11px"> · $${rawPrice.toFixed(2)}</span>`
                : "";
              const isMain = p.seriesName === mainCompany;
              html += `
                <div style="display:flex;align-items:center;gap:6px;margin-top:4px;
                  ${isMain ? "font-weight:700;" : ""}">
                  ${p.marker}
                  <span style="flex:1">${p.seriesName}</span>
                  <span style="font-weight:700">${(p.value ?? 0).toFixed(1)}</span>
                  ${priceStr}
                </div>`;
            });
          return html;
        },
        axisPointer: {
          type: "cross",
          lineStyle: { color: "#e2e8f0", width: 1, type: "dashed" },
          crossStyle: { color: "#e2e8f0", width: 1 },
          label: { show: false },
        },
      },

      legend: {
        bottom: 4,
        type: "scroll",
        textStyle: { fontSize: 11, color: "#475569", fontFamily: "Arial, Helvetica, sans-serif" },
        icon: "circle",
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 16,
        pageIconColor: BAIN_RED,
        pageTextStyle: { color: "#64748b", fontSize: 11 },
      },

      xAxis: {
        type: "category",
        data: data.dates,
        boundaryGap: false,
        axisLine:  { lineStyle: { color: "#e2e8f0" } },
        axisTick:  { show: false },
        splitLine: { show: false },
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
          formatter: (v: string) => v.slice(0, 7),
          margin: 10,
        },
      },

      yAxis: {
        type: "value",
        name: "Indexed (Start = 100)",
        nameTextStyle: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: [0, 0, 0, -40],
        },
        // Dynamic min: floor to nearest 10 below the data minimum, with 5% padding
        min: (value: { min: number }) => Math.floor((value.min * 0.95) / 10) * 10,
        axisLine:  { show: false },
        axisTick:  { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9", type: "solid" } },
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
      },

      series,

      grid: { left: 72, right: 16, top: 36, bottom: 60 },

      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut",
    };
  }, [data, mainCompany]);

  if (!data?.dates?.length) {
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
        color: "#94a3b8",
        fontSize: 13,
        fontFamily: "Arial, Helvetica, sans-serif",
        flexDirection: "column",
        gap: 8,
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
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