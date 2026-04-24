"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { GlobalCementRow } from "@/lib/types";
import { BAIN_RED, BAIN_GREY, COMPARE_PALETTE } from "@/lib/chartHelpers";

interface Props {
  data: GlobalCementRow[];
  view: "time_series" | "point_in_time";
  highlightCountry?: string;
  height?: number;
  kpiName?: string;
}

export default function GlobalCementChart({
  data,
  view,
  highlightCountry,
  height = 520,
  kpiName = "Value",
}: Props) {
  const option = useMemo(() => {
    if (!data.length) return {};

    if (view === "time_series") {
      // Group by country
      const countryMap = new Map<string, { year: number; value: number }[]>();
      data.forEach((r) => {
        if (!countryMap.has(r.Country)) countryMap.set(r.Country, []);
        countryMap.get(r.Country)!.push({ year: r.Year, value: r.Value });
      });

      const allYears = [...new Set(data.map((r) => r.Year))].sort();
      let palIdx = 0;
      const series = [...countryMap.entries()].map(([country, rows]) => {
        const isHighlight = country === highlightCountry;
        const color = isHighlight
          ? BAIN_RED
          : COMPARE_PALETTE[palIdx++ % COMPARE_PALETTE.length];
        const yearMap: Record<number, number> = {};
        rows.forEach((r) => { yearMap[r.year] = r.value; });
        return {
          name:      country,
          type:      "line",
          data:      allYears.map((y) => yearMap[y] ?? null),
          lineStyle: { width: isHighlight ? 3 : 2, color },
          itemStyle: { color },
          symbol:    "circle",
          symbolSize: isHighlight ? 6 : 4,
          connectNulls: false,
        };
      });

      return {
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        xAxis:  { type: "category", data: allYears.map(String), axisLabel: { fontSize: 11 } },
        yAxis:  {
          type: "value",
          name: kpiName,
          nameGap: 18,
          nameTextStyle: { fontSize: 11, padding: [0, 0, 0, 8] },
          axisLabel: { fontSize: 11, margin: 10 },
        },
        series,
        grid:   { left: 92, right: 24, top: 34, bottom: 70 },
      };
    }

    // point_in_time — bar chart
    const sorted = [...data].sort((a, b) => b.Value - a.Value);
    const colors = sorted.map((r) =>
      r.Country === highlightCountry ? BAIN_RED : BAIN_GREY,
    );
    return {
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: sorted.map((r) => r.Country),
        axisLabel: { rotate: 35, fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: kpiName,
        nameGap: 18,
        nameTextStyle: { fontSize: 11, padding: [0, 0, 0, 8] },
        axisLabel: { fontSize: 11, margin: 10 },
      },
      series: [{
        type: "bar",
        data: sorted.map((r, i) => ({ value: r.Value, itemStyle: { color: colors[i] } })),
        barMaxWidth: 40,
      }],
      grid: { left: 92, right: 24, top: 34, bottom: 70 },
    };
  }, [data, view, highlightCountry, kpiName]);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height }} notMerge />;
}
