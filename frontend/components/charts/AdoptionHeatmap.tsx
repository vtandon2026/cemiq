// PATH: frontend/components/charts/TechAdoptionHeatmap.tsx
// Supporting Chart 3 — Future Tech Adoption by Region (or Country when a
// region filter is active and the backend drills down).
//
// Rows = tech (CCUS / Clay Calc / Alt Fuel)
// Cols = regions OR countries (whatever the backend sends in data.regions)
// Cell value = % of column's capacity enabled with that tech
//
// When there are many columns (drill-down can yield 30+ countries), a
// horizontal zoom slider and scroll-wheel zoom let users navigate.
"use client";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";
import type { GreenHeatmapData } from "@/lib/types";

interface Props {
  data:    GreenHeatmapData | null;
  height?: number;
}

const F = "Arial, Helvetica, sans-serif";

// Show zoom slider when column count exceeds this.
const ZOOM_THRESHOLD = 8;

export default function TechAdoptionHeatmap({ data, height = 280 }: Props) {
  const option = useMemo(() => {
    if (!data?.data?.length) return {};

    const xs = data.regions;
    const ys = data.techs.map(t => t.label);

    const techIdx   = new Map(data.techs.map((t, i) => [t.value, i]));
    const regionIdx = new Map(xs.map((r, i) => [r, i]));

    // ── Global min-to-max color scaling ────────────────────────────────────
    // The cell with the HIGHEST adoption % on the chart renders as the deepest
    // green; the LOWEST renders as the palest. Every other cell sits
    // proportionally between them. Per spec, this means rows with lower
    // overall adoption (e.g. CCUS) will look mostly pale, while rows with
    // higher adoption (e.g. Alternative Fuel) use the deeper end of the
    // gradient. Driven by ECharts' visualMap below — we don't override
    // per-cell colors, so the visualMap min/max controls everything.
    const numericValues = data.data
      .map(d => d.value)
      .filter((v): v is number => v != null);
    const minVal = numericValues.length ? Math.min(...numericValues) : 0;
    const maxVal = numericValues.length ? Math.max(...numericValues) : 0;
    // Floor min at 0 so the gradient starts at zero (otherwise a chart whose
    // lowest value is 5% would map 5% to the palest color, hiding the meaning).
    // Also guard against a degenerate min==max case by ensuring at least a
    // 1-unit span.
    const vmMin = 0;
    const vmMax = Math.max(maxVal, minVal + 1, 1);

    // Cell data — no per-cell color override. The visualMap maps value[2]
    // (the adoption %) onto the gradient. Empty cells (value == null) are
    // represented as "-" and rendered with a tiny fallback opacity.
    // Highlighted columns: tag each cell whose column is in highlightedCols.
    // We render the highlight as a thick red border on every cell in the column.
    // Adjacent cells share their top/bottom edges, so the 3 stacked borders
    // visually form a continuous column outline. (markArea on a category axis
    // is unreliable for this — we tried `xAxis: col` patterns and ECharts
    // either ignores them or renders zero-width.)
    const highlightedCols = data.highlighted_cols ?? [];
    const hlSet = new Set(highlightedCols);

    const series = data.data.map(cell => {
      const isHl = hlSet.has(cell.region);
      return {
        value: [
          regionIdx.get(cell.region),
          techIdx.get(cell.tech),
          cell.value == null ? "-" : cell.value,
          cell.cap,
        ],
        itemStyle: isHl
          ? { borderColor: "#E11C2A", borderWidth: 2.5 }
          : undefined,
      };
    });

    // Layout decisions based on column count
    const hasZoom = xs.length > ZOOM_THRESHOLD;
    const initialEndPct = hasZoom
      ? Math.min(100, (ZOOM_THRESHOLD / xs.length) * 100)
      : 100;

    // Rotate x labels when many columns or any label is long
    const maxXLen = xs.reduce((m, l) => Math.max(m, l.length), 0);
    const rotateX = xs.length > 6 || maxXLen > 10;

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
        formatter: (p: { value?: unknown; componentType?: string; name?: string }) => {
          // markArea elements trigger tooltip too but have no `value` array —
          // return empty string so ECharts hides the tooltip for them.
          if (!Array.isArray(p.value) || p.value.length < 4) return "";
          const [xi, yi, v, cap] = p.value as [number, number, number | string, number];
          const colName = xs[xi];
          const tech    = ys[yi];
          if (colName === undefined || tech === undefined) return "";
          const valStr = v === "-" ? "No capacity" : `${(v as number).toFixed(1)}%`;
          return `
            <div style="font-weight:700;margin-bottom:4px;color:#0f172a">${tech} · ${colName}</div>
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
      // Bottom margin: x-labels + slider (when shown) + visualMap (color scale).
      // - No zoom:   80px (labels ~30 + visualMap ~30 + spacing)
      // - With zoom: 120px (labels ~30 + slider ~16 + visualMap ~30 + spacing)
      grid: {
        left: 130, right: 30, top: 28,
        bottom: hasZoom ? 120 : 80,
      },
      xAxis: {
        type: "category",
        data: xs,
        splitArea: { show: true },
        axisLabel: {
          fontSize: 11, color: "#475569", fontFamily: F,
          interval: 0,
          rotate: rotateX ? 30 : 0,
          // Truncate very long country names; tooltip shows full name.
          formatter: (v: string) => v.length > 14 ? v.slice(0, 12) + "…" : v,
        },
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
      // Color scale at the very bottom of the chart
      // visualMap drives cell colors: cells with value at vmMax render as
      // the deepest green, cells at vmMin render as palest. Calculable: true
      // would let users drag the handles to narrow the range — leaving it
      // off so the gradient stays anchored to the data.
      visualMap: {
        min: vmMin,
        max: vmMax,
        calculable: false,
        show: true,
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
      // Zoom — inside (wheel/drag) + visible slider — only when many columns.
      // The slider sits BETWEEN the x-axis labels and the visualMap so it
      // doesn't collide with either.
      dataZoom: hasZoom ? [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: initialEndPct,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          start: 0,
          end: initialEndPct,
          height: 12,
          bottom: 38,            // above visualMap (which sits at bottom:0),
                                  // below x-axis labels (which live above ~80px from bottom)
          left: 130,             // align with grid.left
          right: 30,             // align with grid.right
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
        },
      ] : undefined,
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
          formatter: (p: { value?: unknown }) => {
            if (!Array.isArray(p.value) || p.value.length < 3) return "";
            const v = p.value[2];
            if (v === "-" || v == null) return "—";
            return `${(v as number).toFixed(1)}%`;
          },
        },
        itemStyle: {
          // Default white grid border for non-highlighted cells. Highlighted
          // cells override this with a red border via per-cell itemStyle.
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
        animationDurationUpdate: 0,
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

  // Bump chart height a touch when zoom slider is present so labels and
  // slider both have room without the cells getting squished.
  const effectiveHeight = (data.regions.length > ZOOM_THRESHOLD ? height + 40 : height);

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: effectiveHeight }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
      <div style={{
        fontSize: 10.5, color: "#94a3b8", marginTop: 2,
        fontFamily: F, textAlign: "right", paddingRight: 16,
      }}>
        Cell value = {data.unit ?? "% of regional capacity"}.
        {data.regions.length > ZOOM_THRESHOLD && " Drag the slider or scroll to navigate."}
      </div>
    </div>
  );
}