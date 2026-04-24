// PATH: frontend/components/charts/KpiBarChart.tsx
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { KpiPointRow, KpiTimeSeriesRow } from "@/lib/types";
import { BAIN_RED, BAIN_GREY, COMPARE_PALETTE } from "@/lib/chartHelpers";

// ── Point-in-time bar chart ───────────────────────────────────────────────────
interface BarProps {
  data: (KpiPointRow & { _value: number })[];
  analyzedCompany: string;
  valueKey: string;
  yAxisTitle?: string;
  height?: number;
}

export function KpiBarChart({
  data,
  analyzedCompany,
  valueKey,
  yAxisTitle = "",
  height = 480,
}: BarProps) {
  const option = useMemo(() => {
    const sorted = [...data].sort((a, b) => b._value - a._value);

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
          type: "shadow",
          shadowStyle: { color: "rgba(0,0,0,0.04)" },
        },
      },

      xAxis: {
        type: "category",
        data: sorted.map((r) => r.Company),
        axisLabel: {
          rotate: 35,
          fontSize: 11,
          color: "#475569",
          fontFamily: "Arial, Helvetica, sans-serif",
          overflow: "truncate",
          width: 100,
          interval: 0,
        },
        axisLine:  { lineStyle: { color: "#e2e8f0" } },
        axisTick:  { show: false },
        splitLine: { show: false },
      },

      yAxis: {
        type: "value",
        name: yAxisTitle,
        nameTextStyle: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        axisLine:  { show: false },
        axisTick:  { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },

      series: [{
        type: "bar",
        data: sorted.map((r) => {
          const isMain = r.Company === analyzedCompany;
          return {
            value:     r._value,
            itemStyle: {
              color:        isMain ? BAIN_RED : BAIN_GREY,
              borderRadius: [3, 3, 0, 0],
              opacity:      isMain ? 1 : 0.75,
            },
            emphasis: {
              itemStyle: { opacity: 1 },
            },
          };
        }),
        barMaxWidth: 44,
        showBackground: false,
      }],

      grid: { left: 68, right: 20, top: 28, bottom: 110 },
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut",
    };
  }, [data, analyzedCompany, yAxisTitle]);

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      notMerge
      opts={{ renderer: "canvas" }}
    />
  );
}

// ── Time-series line chart ────────────────────────────────────────────────────
interface LineProps {
  data: KpiTimeSeriesRow[];
  analyzedCompany: string;
  yAxisTitle?: string;
  height?: number;
}

export function KpiLineChart({
  data,
  analyzedCompany,
  yAxisTitle = "",
  height = 480,
}: LineProps) {
  const option = useMemo(() => {
    const companyMap = new Map<string, { year: number; value: number }[]>();
    data.forEach((r) => {
      if (!companyMap.has(r.Company)) companyMap.set(r.Company, []);
      companyMap.get(r.Company)!.push({ year: r.Year, value: r.Value });
    });

    const allYears = [...new Set(data.map((r) => r.Year))].sort();
    let palIdx = 0;

    const series = [...companyMap.entries()].map(([company, rows]) => {
      const isMain = company === analyzedCompany;
      const color  = isMain ? BAIN_RED : COMPARE_PALETTE[palIdx++ % COMPARE_PALETTE.length];
      const yearMap: Record<number, number> = {};
      rows.forEach((r) => { yearMap[r.year] = r.value; });
      return {
        name:      company,
        type:      "line",
        data:      allYears.map((y) => yearMap[y] ?? null),
        smooth:    0.2,
        lineStyle: { width: isMain ? 2.5 : 1.5, color },
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
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
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
        data: allYears.map(String),
        boundaryGap: false,
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
          margin: 10,
        },
        axisLine:  { lineStyle: { color: "#e2e8f0" } },
        axisTick:  { show: false },
        splitLine: { show: false },
      },

      yAxis: {
        type: "value",
        name: yAxisTitle,
        nameTextStyle: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        axisLine:  { show: false },
        axisTick:  { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },

      series,
      grid: { left: 68, right: 20, top: 28, bottom: 60 },

      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut",
    };
  }, [data, analyzedCompany, yAxisTitle]);

  return (
    <ReactECharts
      option={option}
      style={{ height }}
      notMerge
      opts={{ renderer: "canvas" }}
    />
  );
}