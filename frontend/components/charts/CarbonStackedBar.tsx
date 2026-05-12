// PATH: frontend/components/charts/CarbonStackedBar.tsx
"use client";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef } from "react";
import type { CarbonHeroRow } from "@/lib/types";

interface Props {
  data:           CarbonHeroRow[];
  xAxisType:      "company" | "plant";
  height?:        number;
  unit?:          string;
  onBarToggle?:   (label: string) => void;     // toggle-add / toggle-remove
  onClearAll?:    () => void;                  // empty-canvas click OR double-click
  highlightLabels?: string[];                  // bars to keep solid; others fade
}

// Production-type palette (Bain brand colors)
const COLOR_DRY   = "#2D7D46";   // Bain green
const COLOR_WET   = "#E11C2A";   // Bain red
const COLOR_MIXED = "#F0B400";   // Bain yellow

const F = "Arial, Helvetica, sans-serif";

export default function CarbonStackedBar({
  data,
  xAxisType,
  height = 460,
  unit = "Mtpa",
  onBarToggle,
  onClearAll,
  highlightLabels = [],
}: Props) {
  // ── ALL HOOKS UNCONDITIONALLY (before any early return) ───────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const echartsRef = useRef<any>(null);

  // Stable lookup for membership checks inside the option memo
  const highlightSet = useMemo(() => new Set(highlightLabels), [highlightLabels]);
  const hasHighlight = highlightSet.size > 0;

  const option = useMemo(() => {
    if (!data?.length) return {};

    const labels = data.map((d) => d.label);
    const truncate = (s: string, n = 18) =>
      s.length > n ? s.slice(0, n - 1) + "…" : s;

    const hasZoom = data.length > 12;

    // Per-bar opacity: dimmed when ANY highlights exist AND this bar isn't in the set
    const opacityFor = (label: string) =>
      hasHighlight && !highlightSet.has(label) ? 0.25 : 1;

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
        formatter: (params: { axisValueLabel?: string; name?: string; seriesName: string; value: number; marker: string }[]) => {
          const fullLabel = params[0]?.axisValueLabel ?? params[0]?.name ?? "";
          const total = params.reduce((a, p) => a + (p.value || 0), 0);
          let html = `<div style="font-weight:700;margin-bottom:6px;color:#0f172a">${fullLabel}</div>`;
          params.forEach((p) => {
            if (!p.value) return;
            const pct = total > 0 ? ((p.value / total) * 100).toFixed(1) : "0.0";
            html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px;font-size:12px">
              <span>${p.marker} ${p.seriesName}</span>
              <span style="font-weight:600">${p.value.toFixed(2)} ${unit} (${pct}%)</span>
            </div>`;
          });
          html += `<div style="border-top:1px solid #f1f5f9;margin-top:6px;padding-top:5px;display:flex;justify-content:space-between;gap:16px;font-size:12px">
            <span style="color:#64748b">Total</span>
            <span style="font-weight:700;color:#0f172a">${total.toFixed(2)} ${unit}</span>
          </div>`;
          return html;
        },
      },
      legend: {
        bottom: 4,
        itemGap: 18,
        textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
        data: [
          { name: "Dry",   itemStyle: { color: COLOR_DRY   } },
          { name: "Mixed", itemStyle: { color: COLOR_MIXED } },
          { name: "Wet",   itemStyle: { color: COLOR_WET   } },
        ],
      },
      xAxis: {
        type: "category",
        data: labels,
        axisLabel: {
          rotate: -35,
          fontSize: 10.5,
          color: "#475569",
          fontFamily: F,
          margin: 8,
          formatter: (val: string) => truncate(val, 16),
        },
        axisLine: { lineStyle: { color: "#e2e8f0" } },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: `Capacity (${unit})`,
        nameLocation: "end",
        nameGap: 8,
        nameTextStyle: { fontSize: 11, color: "#94a3b8", fontFamily: F },
        axisLabel: {
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: F,
          formatter: (v: number) => v.toLocaleString(),
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
      },
      series: [
        {
          name: "Dry",
          type: "bar",
          stack: "total",
          data: data.map((d) => ({
            value: d.dry,
            itemStyle: {
              color: COLOR_DRY,
              borderRadius: [0, 0, 0, 0],
              opacity: opacityFor(d.label),
            },
          })),
          barMaxWidth: 38,
        },
        {
          name: "Mixed",
          type: "bar",
          stack: "total",
          data: data.map((d) => ({
            value: d.mixed,
            itemStyle: {
              color: COLOR_MIXED,
              opacity: opacityFor(d.label),
            },
          })),
          barMaxWidth: 38,
        },
        {
          name: "Wet",
          type: "bar",
          stack: "total",
          data: data.map((d) => ({
            value: d.wet,
            itemStyle: {
              color: COLOR_WET,
              borderRadius: [3, 3, 0, 0],
              opacity: opacityFor(d.label),
            },
          })),
          barMaxWidth: 38,
        },
      ],
      grid: {
        left: 70,
        right: 24,
        top: 32,
        bottom: hasZoom ? 96 : 56,
      },
      dataZoom: hasZoom ? [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 14,
          bottom: 30,
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
          throttle: 50,
        },
      ] : undefined,
      animation: true,
      animationDuration: 450,
      animationEasing: "cubicOut" as const,
    };
  }, [data, unit, highlightSet, hasHighlight]);

  // Empty-canvas click + double-click clear, via zrender
  useEffect(() => {
    if (!onClearAll || xAxisType !== "company") return;
    const inst = echartsRef.current?.getEchartsInstance?.();
    if (!inst) return;
    const zr = inst.getZr();
    if (!zr) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const singleClick = (event: any) => {
      // event.target undefined => clicked blank canvas
      if (!event?.target) onClearAll();
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doubleClick = (_event: any) => {
      onClearAll();
    };
    zr.on("click", singleClick);
    zr.on("dblclick", doubleClick);
    return () => {
      zr.off("click", singleClick);
      zr.off("dblclick", doubleClick);
    };
  }, [onClearAll, xAxisType, data]);

  if (!data?.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height, color: "#94a3b8", fontSize: 13, fontFamily: F,
      }}>
        No data for the selected filters
      </div>
    );
  }

  const handleEvents = onBarToggle && xAxisType === "company"
    ? {
        click: (params: { name: string; componentType: string; dataIndex: number }) => {
          if (params?.componentType !== "series") return;
          const row = data[params.dataIndex];
          if (!row) return;
          if (row.is_other) return;
          onBarToggle(row.label);
        },
      }
    : undefined;

  return (
    <ReactECharts
      ref={echartsRef}
      option={option}
      style={{ height, cursor: onBarToggle && xAxisType === "company" ? "pointer" : "default" }}
      onEvents={handleEvents}
      notMerge
      opts={{ renderer: "canvas" }}
    />
  );
}