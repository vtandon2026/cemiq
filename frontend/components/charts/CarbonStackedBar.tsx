// PATH: frontend/components/charts/CarbonStackedBar.tsx
"use client";
import ReactECharts from "echarts-for-react";
import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import type { CarbonHeroRow } from "@/lib/types";

interface Props {
  data:             CarbonHeroRow[];
  xAxisType:        "company" | "plant";
  height?:          number;
  unit?:            string;
  onBarToggle?:     (label: string) => void;
  onClearAll?:      () => void;
  highlightLabels?: string[];
  /** Fires AFTER user finishes a zoom/pan gesture (not during). */
  onZoomChange?:    (range: { startIdx: number; endIdx: number; total: number }) => void;
}

export interface CarbonStackedBarHandle {
  resetZoom: () => void;
  getVisibleRange: () => { startIdx: number; endIdx: number; total: number } | null;
}

const COLOR_DRY   = "#2D7D46";
const COLOR_WET   = "#E11C2A";
const COLOR_MIXED = "#F0B400";
const F = "Arial, Helvetica, sans-serif";

function pctToIndices(startPct: number, endPct: number, total: number): { startIdx: number; endIdx: number } {
  if (total <= 0) return { startIdx: 0, endIdx: 0 };
  const startIdx  = Math.max(0, Math.floor((startPct / 100) * total));
  const endIdxRaw = Math.ceil((endPct / 100) * total) - 1;
  const endIdx    = Math.max(startIdx, Math.min(total - 1, endIdxRaw));
  return { startIdx, endIdx };
}

const CarbonStackedBar = forwardRef<CarbonStackedBarHandle, Props>(function CarbonStackedBar({
  data,
  xAxisType,
  height = 460,
  unit = "Mtpa",
  onBarToggle,
  onClearAll,
  highlightLabels = [],
  onZoomChange,
}, ref) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const echartsRef = useRef<any>(null);
  const [isZoomed, setIsZoomed] = useState(false);

  const highlightSet = useMemo(() => new Set(highlightLabels), [highlightLabels]);
  const hasHighlight = highlightSet.size > 0;

  // Stable content signature — used as dep so we don't rebuild option on every
  // parent render (new array reference) but only when contents actually change.
  const dataSignature = useMemo(() => {
    if (!data?.length) return "empty";
    return `${data.length}|${data[0]?.label ?? ""}|${data[data.length - 1]?.label ?? ""}`;
  }, [data]);

  // ── Build the ECharts option (only when content changes) ──────────────────
  const option = useMemo(() => {
    if (!data?.length) return {};

    const labels   = data.map((d) => d.label);
    const truncate = (s: string, n = 18) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
    const hasZoom  = data.length > 12;

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
            itemStyle: { color: COLOR_DRY, opacity: opacityFor(d.label) },
          })),
          barMaxWidth: 38,
        },
        {
          name: "Mixed",
          type: "bar",
          stack: "total",
          data: data.map((d) => ({
            value: d.mixed,
            itemStyle: { color: COLOR_MIXED, opacity: opacityFor(d.label) },
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
        left: 70, right: 24, top: 32,
        bottom: hasZoom ? 96 : 56,
      },
      // NOTE: no `start`/`end` here — ECharts preserves user zoom across
      // option updates because we use lazyUpdate (no notMerge re-init).
      dataZoom: hasZoom ? [
        {
          type: "inside",
          xAxisIndex: 0,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
          moveOnMouseWheel: false,
          preventDefaultMouseMove: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 14,
          bottom: 30,
          borderColor: "#e2e8f0",
          backgroundColor: "#f8fafc",
          fillerColor: "rgba(225,28,42,0.10)",
          handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
          textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
          showDetail: false,
          brushSelect: false,
        },
      ] : undefined,
      animation: false,   // turn animation OFF — re-renders during interaction
                          // were animating zoom snap-backs, looking glitchy
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature, unit, highlightSet, hasHighlight]);

  // ── Empty-canvas click + double-click clear (zrender hooks) ───────────────
  useEffect(() => {
    if (!onClearAll || xAxisType !== "company") return;
    const inst = echartsRef.current?.getEchartsInstance?.();
    if (!inst) return;
    const zr = inst.getZr();
    if (!zr) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const singleClick = (event: any) => { if (!event?.target) onClearAll(); };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doubleClick = (_event: any) => { onClearAll(); };
    zr.on("click", singleClick);
    zr.on("dblclick", doubleClick);
    return () => {
      zr.off("click", singleClick);
      zr.off("dblclick", doubleClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClearAll, xAxisType, dataSignature]);

  // ── Zoom event handling ───────────────────────────────────────────────────
  // We use a ref for onZoomChange so the listener never needs to rebind when
  // the parent passes a new callback identity.
  const onZoomChangeRef = useRef(onZoomChange);
  useEffect(() => { onZoomChangeRef.current = onZoomChange; }, [onZoomChange]);

  // Bind the datazoom listener ONCE per chart-instance lifecycle. We use the
  // lowercase "datazoom" event name (correct for the instance API) and
  // throttle parent updates to the end of a gesture via a debounce timer.
  useEffect(() => {
    if (dataSignature === "empty") return;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const SETTLE_MS = 150;  // user has stopped dragging for this long → push to parent

    const readAndForward = () => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      const opt = inst.getOption();
      // Check BOTH dataZoom entries (inside + slider). See getVisibleRange.
      const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
      let startPct = 0;
      let endPct   = 100;
      for (const dz of dzArr) {
        const s = dz?.start ?? 0;
        const e = dz?.end   ?? 100;
        if (s > startPct) startPct = s;
        if (e < endPct)   endPct   = e;
      }
      // Local state — immediate so Reset button appears as soon as user drags
      setIsZoomed(startPct > 0 || endPct < 100);
      // Parent forward — only AFTER user stops moving the slider for 150ms.
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const cb = onZoomChangeRef.current;
        if (cb && data?.length) {
          const { startIdx, endIdx } = pctToIndices(startPct, endPct, data.length);
          cb({ startIdx, endIdx, total: data.length });
        }
      }, SETTLE_MS);
    };

    // Wait one tick for ECharts to finish initializing this instance
    const initTimer = setTimeout(() => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      inst.off("datazoom");
      inst.on("datazoom", readAndForward);
    }, 0);

    return () => {
      clearTimeout(initTimer);
      if (debounceTimer) clearTimeout(debounceTimer);
      const inst = echartsRef.current?.getEchartsInstance?.();
      try { inst?.off("datazoom"); } catch { /* disposed */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature]);

  // ── Reset zoom when fresh data lands ──────────────────────────────────────
  useEffect(() => {
    setIsZoomed(false);
    const t = setTimeout(() => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      try {
        inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      } catch { /* disposed */ }
    }, 0);
    return () => clearTimeout(t);
  }, [dataSignature]);

  // ── Imperative API for parent ─────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    resetZoom: () => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      setIsZoomed(false);
    },
    getVisibleRange: () => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst || !data?.length) return null;
      const opt = inst.getOption();
      // Check BOTH dataZoom entries (inside + slider). Either may carry the
      // current zoom state, depending on how the user interacted (mouse wheel
      // vs slider drag) and what ECharts last synced.
      const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
      let startPct = 0;
      let endPct   = 100;
      for (const dz of dzArr) {
        const s = dz?.start ?? 0;
        const e = dz?.end   ?? 100;
        // Pick the most-zoomed entry — i.e. whichever has the narrowest window.
        if (s > startPct) startPct = s;
        if (e < endPct)   endPct   = e;
      }
      const { startIdx, endIdx } = pctToIndices(startPct, endPct, data.length);
      return { startIdx, endIdx, total: data.length };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [dataSignature]);

  // ── EARLY RETURN ──────────────────────────────────────────────────────────
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

  // Bar-click handler (only on Companies axis). dataZoom is bound via the
  // instance API above, so we don't add it here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEvents: Record<string, (params: any) => void> = {};
  if (onBarToggle && xAxisType === "company") {
    handleEvents.click = (params: { name: string; componentType: string; dataIndex: number }) => {
      if (params?.componentType !== "series") return;
      const row = data[params.dataIndex];
      if (!row) return;
      if (row.is_other) return;
      onBarToggle(row.label);
    };
  }

  const resetZoomHandler = () => {
    const inst = echartsRef.current?.getEchartsInstance?.();
    if (!inst) return;
    inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
    setIsZoomed(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height }}>
      <ReactECharts
        ref={echartsRef}
        option={option}
        style={{
          height,
          cursor: onBarToggle && xAxisType === "company" ? "pointer" : "default",
        }}
        onEvents={handleEvents}
        // IMPORTANT: lazyUpdate (NOT notMerge) — this is the key to preserving
        // user zoom state across re-renders. notMerge wipes ECharts internal
        // state including dataZoom position, causing the glitchy snap-back.
        // lazyUpdate diff-merges options without disturbing user interaction.
        lazyUpdate
        opts={{ renderer: "canvas" }}
      />

      {/* Floating Reset Zoom button — top-right, offset 36px left of
          the ChartCardShell's Expand button so they don't overlap. */}
      {isZoomed && (
        <button
          onClick={resetZoomHandler}
          title="Reset zoom"
          aria-label="Reset zoom"
          style={{
            position: "absolute",
            top: 8, right: 44,
            width: 28, height: 28,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#ffffff",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: 6,
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
            transition: "background 0.15s, color 0.15s, border-color 0.15s",
            padding: 0,
            zIndex: 7,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = "#fef2f2";
            (e.currentTarget as HTMLElement).style.color = "#E11C2A";
            (e.currentTarget as HTMLElement).style.borderColor = "#E11C2A";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = "#ffffff";
            (e.currentTarget as HTMLElement).style.color = "#475569";
            (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
          }}
        >
          {/* Undo arrow (Tabler ti-arrow-back-up shape) */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 14l-4 -4l4 -4" />
            <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
          </svg>
        </button>
      )}
    </div>
  );
});

export default CarbonStackedBar;