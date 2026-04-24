// PATH: frontend/components/charts/MekkoChart.tsx
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo, useRef, useCallback, useEffect } from "react";
import type { MekkoRow } from "@/lib/types";

interface Props {
  data: MekkoRow[];
  year: number;
  height?: number;
  labelMinPct?: number;
}

type EChartLike = {
  getWidth: () => number;
  convertToPixel: (coord: unknown, val: unknown) => number;
  on?: (event: string, fn: () => void) => void;
  off?: (event: string, fn?: () => void) => void;
  isDisposed?: () => boolean;
  getDom?: () => unknown;
};

const BAIN_REGION_SHADE_FAMILIES = [
  ["#2D475A", "#46647B", "#7891AA", "#A3BCD3", "#DCE5EA"],
  ["#640A40", "#973B74", "#BA749F", "#D9ABC6", "#EED6E5"],
  ["#AB8933", "#C6AA3D", "#E9CD49", "#F2DE8A", "#FAEEC3"],
  ["#104C3E", "#507867", "#83AC9A", "#BBCABA", "#DCE2D6"],
  ["#333333", "#5C5C5C", "#858585", "#B4B4B4", "#D6D6D6"],
];
const MEKKO_OTHER_COLOR = "#D9D9D9";

const GRID_LEFT = 64;
const GRID_RIGHT = 20;
const GRID_BOTTOM = 110;

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function textColorFor(hex: string): string {
  return luminance(hex) < 0.35 ? "#FFFFFF" : "#111111";
}

function mekkoColor(country: string, rIdx: number, rank: number, n: number): string {
  if (country.trim().toLowerCase() === "other") return MEKKO_OTHER_COLOR;
  const pal = BAIN_REGION_SHADE_FAMILIES[rIdx % BAIN_REGION_SHADE_FAMILIES.length];
  if (n <= 1) return pal[0];
  const idx = Math.round((rank * (pal.length - 1)) / Math.max(n - 1, 1));
  return pal[Math.max(0, Math.min(pal.length - 1, idx))];
}

export default function MekkoChart({ data, year, height = 620, labelMinPct = 6 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<EChartLike | null>(null);
  const overlayTimeoutsRef = useRef<number[]>([]);
  const dataZoomHandlerRef = useRef<(() => void) | null>(null);

  const { seriesData, regionCenters, regionLabels, regionWidths, legendItems } = useMemo(() => {
    if (!data?.length) return { seriesData: [], regionCenters: [], regionLabels: [], regionWidths: [], legendItems: [] };

    const regionMap = new Map<string, MekkoRow[]>();
    data.forEach((row) => {
      if (!regionMap.has(row.Region)) regionMap.set(row.Region, []);
      regionMap.get(row.Region)!.push(row);
    });

    const grandTotal = data.reduce((s, r) => s + r.value, 0);
    if (grandTotal <= 0) return { seriesData: [], regionCenters: [], regionLabels: [], regionWidths: [], legendItems: [] };

    const regionsSorted = [...regionMap.keys()].sort(
      (a, b) =>
        regionMap.get(b)!.reduce((s, r) => s + r.value, 0) -
        regionMap.get(a)!.reduce((s, r) => s + r.value, 0),
    );

    const rowsOut: {
      value: [number, number, number, number];
      color: string;
      labelText: string;
      showLabel: boolean;
      useVerticalLabel: boolean;
      tip: string;
    }[] = [];

    const centers: number[] = [];
    const labels: string[] = [];
    const widths: number[] = [];
    const legendMap = new Map<string, string>();
    let xLeft = 0;

    regionsSorted.forEach((region, rIdx) => {
      const rows = regionMap.get(region)!.slice().sort((a, b) => {
        const aIsOther = a.Country.trim().toLowerCase() === "other";
        const bIsOther = b.Country.trim().toLowerCase() === "other";
        if (aIsOther !== bIsOther) return aIsOther ? 1 : -1;
        return b.value - a.value;
      });
      const regionTotal = rows.reduce((s, r) => s + r.value, 0);
      const width = regionTotal / grandTotal;
      const center = xLeft + width / 2;
      centers.push(center);
      labels.push(region);
      widths.push(width);

      let yBase = 0;
      rows.forEach((row, rank) => {
        const h = row.value / regionTotal;
        const color = mekkoColor(row.Country, rIdx, rank, rows.length);
        if (!legendMap.has(row.Country)) legendMap.set(row.Country, color);

        const barWidthPx = width * 900;
        const barHeightPx = h * 520;
        const showLabel = barHeightPx >= 14 && barWidthPx >= 8;
        const useVertical = barWidthPx < 30 && barHeightPx >= 40;
        const maxCharsH = Math.max(2, Math.floor(barWidthPx / 6.5));
        const maxCharsV = Math.max(2, Math.floor(barHeightPx / 7.5));
        const maxChars = useVertical ? maxCharsV : maxCharsH;
        const labelText = row.Country.length > maxChars ? row.Country.slice(0, maxChars - 1) + "…" : row.Country;

        rowsOut.push({
          value: [center, width, yBase, yBase + h],
          color,
          labelText,
          showLabel,
          useVerticalLabel: useVertical,
          tip:
            `<div style="font-weight:700;margin-bottom:5px;color:#0f172a">${row.Country}</div>` +
            `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Region</span><span style="font-weight:600">${region}</span></div>` +
            `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Value</span><span style="font-weight:600">${row.value.toLocaleString()}</span></div>` +
            `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Share of region</span><span style="font-weight:700;color:#E60000">${(h * 100).toFixed(1)}%</span></div>` +
            `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px"><span style="color:#64748b">Region total</span><span style="font-weight:600">${regionTotal.toLocaleString()}</span></div>`,
        });
        yBase += h;
      });

      xLeft += width;
    });

    return {
      seriesData: rowsOut,
      regionCenters: centers,
      regionLabels: labels,
      regionWidths: widths,
      legendItems: [...legendMap.entries()].map(([country, color]) => ({ country, color })),
    };
  }, [data, labelMinPct]);

  const isChartUsable = useCallback((chart: unknown): chart is EChartLike => {
    if (!chart || typeof chart !== "object") return false;
    const candidate = chart as EChartLike;
    if (typeof candidate.isDisposed === "function" && candidate.isDisposed()) return false;
    if (typeof candidate.getDom === "function" && !candidate.getDom()) return false;
    return typeof candidate.getWidth === "function" && typeof candidate.convertToPixel === "function";
  }, []);

  const clearOverlay = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll(".mekko-label-svg").forEach((el) => el.remove());
  }, []);

  const clearOverlayTimeouts = useCallback(() => {
    overlayTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    overlayTimeoutsRef.current = [];
  }, []);

  const detachChartListeners = useCallback(() => {
    const chart = chartInstanceRef.current;
    const handler = dataZoomHandlerRef.current;
    if (!chart || !handler) return;
    try {
      chart.off?.("datazoom", handler);
    } catch {}
    dataZoomHandlerRef.current = null;
  }, []);

  const drawOverlay = useCallback((chart: EChartLike | null) => {
    const container = containerRef.current;
    if (!container) return;
    clearOverlay();
    if (!regionCenters.length || !isChartUsable(chart)) return;

    const totalW = chart.getWidth();
    const toPixel = (xVal: number) => chart.convertToPixel({ xAxisIndex: 0 }, xVal) as number;

    try {
      const test = toPixel(0.5);
      if (!test || test <= 0 || !totalW || totalW <= 0) return;
    } catch {
      return;
    }

    const plotBottom = height - GRID_BOTTOM;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "mekko-label-svg");
    svg.setAttribute("width", String(totalW));
    svg.setAttribute("height", String(height));
    Object.assign(svg.style, {
      position: "absolute",
      left: "0",
      top: "0",
      pointerEvents: "none",
      overflow: "hidden",
    });

    regionCenters.forEach((center, i) => {
      const cx = toPixel(center);
      const leftX = toPixel(center - regionWidths[i] / 2);
      const rightX = toPixel(center + regionWidths[i] / 2);
      const barPx = Math.max(rightX - leftX, 1);
      const label = regionLabels[i] ?? "";
      const textW = label.length * 6.5;
      const useHorizontal = textW <= barPx - 8;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("font-size", "11");
      text.setAttribute("font-weight", "600");
      text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
      text.setAttribute("fill", "#1e293b");

      if (useHorizontal) {
        text.setAttribute("x", String(cx));
        text.setAttribute("y", String(plotBottom + 16));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "hanging");
      } else {
        text.setAttribute("x", "0");
        text.setAttribute("y", "0");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("transform", `translate(${cx - barPx / 2 + 2}, ${plotBottom + 6}) rotate(35)`);
      }

      text.textContent = label;
      svg.appendChild(text);
    });

    container.style.position = "relative";
    container.appendChild(svg);
  }, [clearOverlay, height, isChartUsable, regionCenters, regionLabels, regionWidths]);

  const scheduleOverlay = useCallback((chart: EChartLike | null, delays: number[]) => {
    clearOverlayTimeouts();
    delays.forEach((delay) => {
      const id = window.setTimeout(() => {
        if (!isChartUsable(chart)) return;
        drawOverlay(chart);
      }, delay);
      overlayTimeoutsRef.current.push(id);
    });
  }, [clearOverlayTimeouts, drawOverlay, isChartUsable]);

  const onChartReady = useCallback((chart: unknown) => {
    detachChartListeners();
    chartInstanceRef.current = isChartUsable(chart) ? chart : null;
    if (!isChartUsable(chart)) return;

    const handleDataZoom = () => drawOverlay(chart);
    dataZoomHandlerRef.current = handleDataZoom;
    scheduleOverlay(chart, [100]);
    try {
      chart.off?.("datazoom", handleDataZoom);
    } catch {}
    chart.on?.("datazoom", handleDataZoom);
  }, [detachChartListeners, drawOverlay, isChartUsable, scheduleOverlay]);

  useEffect(() => {
    if (!chartInstanceRef.current) return;
    clearOverlay();
    scheduleOverlay(chartInstanceRef.current, [50, 300]);
  }, [clearOverlay, data, regionBandsKey(regionCenters, regionLabels, regionWidths), scheduleOverlay]);

  useEffect(() => {
    return () => {
      clearOverlayTimeouts();
      clearOverlay();
      detachChartListeners();
    };
  }, [clearOverlay, clearOverlayTimeouts, detachChartListeners]);

  const option = useMemo(() => {
    if (!seriesData.length) return null;
    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#ffffff",
        borderColor: "#e2e8f0",
        borderWidth: 1,
        padding: [10, 14],
        textStyle: { fontSize: 12, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" },
        extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
      },
      xAxis: {
        type: "value",
        min: -0.03,
        max: 1.03,
        axisLabel: { show: false },
        axisTick: { show: false },
        axisLine: { show: false },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        min: 0,
        max: 1,
        axisLabel: {
          formatter: (v: number) => `${Math.round(v * 100)}%`,
          fontSize: 11,
          color: "#94a3b8",
          fontFamily: "Arial, Helvetica, sans-serif",
        },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [{
        type: "custom",
        renderItem: (
          params: { dataIndex: number },
          api: {
            value: (i: number) => number;
            coord: (pt: [number, number]) => [number, number];
            visual: (key: string) => unknown;
          },
        ) => {
          const item = seriesData[params.dataIndex];
          const xCenter = api.value(0);
          const width = api.value(1);
          const yBase = api.value(2);
          const yTop = api.value(3);
          const [px1, py1] = api.coord([xCenter - width / 2, yTop]);
          const [px2, py2] = api.coord([xCenter + width / 2, yBase]);
          const w = px2 - px1;
          const h = py2 - py1;
          if (w <= 0 || h <= 0) return { type: "group", children: [] };
          const children: Array<Record<string, unknown>> = [{
            type: "rect",
            shape: { x: px1, y: py1, width: w, height: h },
            style: {
              ...(api.visual("style") as Record<string, unknown> | undefined),
              fill: (api.visual("color") as string | undefined) ?? "#000000",
              stroke: "#FFFFFF",
              lineWidth: 0.6,
            },
          }];

          if (item?.showLabel) {
            children.push({
              type: "text",
              x: px1 + w / 2,
              y: py1 + h / 2,
              rotation: item.useVerticalLabel ? Math.PI / 2 : 0,
              style: {
                text: item.labelText,
                fill: textColorFor(item.color),
                font: "10px Arial, Helvetica, sans-serif",
                fontWeight: 600,
                align: "center",
                verticalAlign: "middle",
                width: item.useVerticalLabel ? Math.max(h - 6, 0) : Math.max(w - 6, 0),
                overflow: "truncate",
              },
              silent: true,
            });
          }

          return {
            type: "group",
            children,
          };
        },
        data: seriesData.map((it) => ({
          value: it.value,
          itemStyle: { color: it.color },
          tooltip: { formatter: () => it.tip },
        })),
        encode: { tooltip: [0, 1, 2, 3] },
      }],
      grid: { left: GRID_LEFT, right: GRID_RIGHT, top: 20, bottom: GRID_BOTTOM },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          startValue: -0.03,
          endValue: 1.03,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          startValue: -0.03,
          endValue: 1.03,
          height: 20,
          bottom: 4,
          borderColor: "#e2e8f0",
          fillerColor: "rgba(230,0,0,0.08)",
          handleStyle: { color: "#E60000", borderColor: "#E60000" },
          textStyle: { color: "#94a3b8", fontSize: 10 },
          showDetail: false,
        },
      ],
      animation: true,
      animationDuration: 500,
      animationEasing: "cubicOut" as const,
    };
  }, [seriesData]);

  if (!data?.length || !option) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#94a3b8", fontSize: 13, fontFamily: "Arial, Helvetica, sans-serif" }}>
        No data available
      </div>
    );
  }

  return (
    <div>
      <div ref={containerRef} style={{ position: "relative" }}>
        <ReactECharts
          option={option}
          style={{ height }}
          notMerge
          opts={{ renderer: "canvas" }}
          onChartReady={onChartReady}
        />
      </div>

      {legendItems.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "5px 12px",
          marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9",
        }}>
          {legendItems.map(({ country, color }) => (
            <div key={country} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#475569", fontFamily: "Arial, Helvetica, sans-serif" }}>{country}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function regionBandsKey(regionCenters: number[], regionLabels: string[], regionWidths: number[]): string {
  return JSON.stringify({ regionCenters, regionLabels, regionWidths });
}
