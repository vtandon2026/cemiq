"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { ProfitPoolRow } from "@/lib/types";

interface Props {
  data: ProfitPoolRow[];
  height?: number;
}

const MAIN_FILLS = ["#2A465C", "#3D6478", "#4E7F96", "#5E96AE", "#2D5A72", "#1E3D52"];
const OTHER_FILL = "#B0BEC5";
const OTHER_BORDER = "#90A4AE";

const GRID_LEFT = 70;
const GRID_RIGHT = 16;
const GRID_BOTTOM = 72;

export default function ProfitPoolChart({ data, height = 620 }: Props) {
  const { sorted, centers, widths } = useMemo(() => {
    const sortedRows = [...data].sort((a, b) =>
      a.is_other ? 1 : b.is_other ? -1 : b.EBITDA_margin - a.EBITDA_margin,
    );
    const totalRevenue = sortedRows.reduce((sum, row) => sum + row.Revenue, 0);
    const nextCenters: number[] = [];
    const nextWidths: number[] = [];
    let offset = 0;

    sortedRows.forEach((row) => {
      const width = totalRevenue > 0 ? (row.Revenue / totalRevenue) * 100 : 0;
      nextCenters.push(offset + width / 2);
      nextWidths.push(width);
      offset += width;
    });

    return { sorted: sortedRows, centers: nextCenters, widths: nextWidths };
  }, [data]);

  const option = useMemo(() => {
    if (!data.length) return {};

    let colorIndex = 0;
    const seriesData = sorted.map((row, i) => {
      const isOther = !!row.is_other;
      const fill = isOther ? OTHER_FILL : MAIN_FILLS[colorIndex++ % MAIN_FILLS.length];
      const marginPct = (row.EBITDA_margin * 100).toFixed(1);
      const shortLabel = row.Category.length > 18 ? `${row.Category.slice(0, 17)}…` : row.Category;

      return {
        name: row.Category,
        value: [centers[i], row.EBITDA_margin * 100, widths[i]],
        itemStyle: {
          color: fill,
          borderColor: isOther ? OTHER_BORDER : "rgba(255,255,255,0.25)",
          borderWidth: 1,
          opacity: 0.92,
        },
        emphasis: {
          itemStyle: { opacity: 1, shadowBlur: 6, shadowColor: "rgba(0,0,0,0.18)" },
        },
        label: {
          show: widths[i] > 4,
          formatter: () => (widths[i] > 11 ? `${shortLabel}\n${marginPct}%` : shortLabel),
          fontSize: 10,
          fontWeight: 700,
          color: "#ffffff",
          lineHeight: 13,
          overflow: "truncate",
        },
        tooltip: {
          formatter: () => {
            let html =
              `<div style="font-weight:700;margin-bottom:5px;color:#0f172a">${row.Category}</div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Revenue</span><span style="font-weight:600">$${row.Revenue.toLocaleString()} mn</span></div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">EBITDA</span><span style="font-weight:600">$${row.EBITDA.toLocaleString()} mn</span></div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Margin</span><span style="font-weight:700;color:#E60000">${marginPct}%</span></div>` +
              `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Rev. share</span><span style="font-weight:600">${(row.width * 100).toFixed(1)}%</span></div>`;
            if (isOther && row.constituent_categories?.length) {
              html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #f1f5f9;font-size:11px;color:#94a3b8">Includes: ${row.constituent_categories.join(", ")}</div>`;
            }
            return html;
          },
        },
      };
    });

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
        extraCssText: "box-shadow: 0 4px 16px rgba(0,0,0,0.10); border-radius: 8px;",
      },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: true, lineStyle: { color: "#e2e8f0" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: "EBITDA margin",
        nameLocation: "end",
        nameTextStyle: {
          fontSize: 11,
          color: "#64748b",
          fontFamily: "Arial, Helvetica, sans-serif",
          padding: [0, 0, 4, -48],
        },
        axisLabel: {
          formatter: (v: number) => `${v.toFixed(0)}%`,
          fontSize: 11,
          color: "#475569",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        axisLine: { onZero: true, lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      series: [
        {
          type: "custom",
          renderItem: (
            _params: unknown,
            api: {
              value: (i: number) => number;
              coord: (v: number[]) => number[];
              visual: (key: string) => unknown;
            },
          ) => {
            const centerX = api.value(0);
            const yValue = api.value(1);
            const barWidth = api.value(2);
            const [x1, y1] = api.coord([centerX - barWidth / 2, yValue]);
            const [x2, y0] = api.coord([centerX + barWidth / 2, 0]);
            return {
              type: "rect",
              shape: {
                x: x1,
                y: Math.min(y0, y1),
                width: Math.max(x2 - x1, 1),
                height: Math.max(Math.abs(y0 - y1), 1),
              },
              style: {
                ...(api.visual("style") as Record<string, unknown> | undefined),
                fill: (api.visual("color") as string | undefined) ?? "#000000",
              },
            };
          },
          data: seriesData,
          encode: { x: 0, y: 1 },
          label: { position: "inside" },
        },
      ],
      grid: { left: GRID_LEFT, right: GRID_RIGHT, top: 36, bottom: GRID_BOTTOM },
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut" as const,
    };
  }, [data, sorted, centers, widths]);

  if (!data.length) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
        gap: 8,
        color: "#94a3b8",
        fontSize: 13,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
        No data available
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <ReactECharts option={option} style={{ height }} notMerge opts={{ renderer: "canvas" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 4,
          height: 52,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {sorted.map((row, i) => (
          <div
            key={`${row.Category}-${i}`}
            style={{
              position: "absolute",
              left: `calc(${GRID_LEFT}px + ((100% - ${GRID_LEFT + GRID_RIGHT}px) * ${centers[i] / 100}))`,
              bottom: 40,
              transform: "translateX(-20%) rotate(40deg)",
              transformOrigin: "top left",
              color: "#475569",
              fontSize: 10,
              fontFamily: "Arial, Helvetica, sans-serif",
              whiteSpace: "nowrap",
              maxWidth: 110,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={row.Category}
          >
            {row.Category}
          </div>
        ))}
      </div>
    </div>
  );
}
