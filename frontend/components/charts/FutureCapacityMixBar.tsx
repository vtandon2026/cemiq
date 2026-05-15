// PATH: frontend/components/charts/FutureCapacityMixBar.tsx
// Supporting Chart 2 — Future Capacity Mix.
// 100% stacked bar: Legacy (red) / Transitioning (yellow) / Future-Ready (green)
// per region or company. Supports mouse-wheel zoom + slider drag when the
// dataset has more entries than fit comfortably on screen.
"use client";
import ReactECharts from "echarts-for-react";
import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import type { GreenCapacityMixRow } from "@/lib/types";

interface Props {
  data:    GreenCapacityMixRow[];
  height?: number;
  groupBy?: "company" | "region";
  // When true, tooltip includes the country line (Region filter active in page).
  showCountry?: boolean;
}

export interface FutureCapacityMixBarHandle {
  resetZoom: () => void;
}

const F = "Arial, Helvetica, sans-serif";

const COLOR_LEGACY        = "#E11C2A";   // red
const COLOR_TRANSITIONING = "#F59E0B";   // amber
const COLOR_FUTURE_READY  = "#10B981";   // emerald

const FutureCapacityMixBar = forwardRef<FutureCapacityMixBarHandle, Props>(
  function FutureCapacityMixBar({ data, height = 380, groupBy = "region", showCountry = false }, ref) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const echartsRef = useRef<any>(null);
    const [isZoomed, setIsZoomed] = useState(false);

    // Stable content signature so option only rebuilds on real data changes,
    // not every parent re-render. Critical for zoom-state preservation.
    const dataSignature = useMemo(() => {
      if (!data?.length) return "empty";
      return `${groupBy}|${data.length}|${data[0]?.label ?? ""}|${data[data.length - 1]?.label ?? ""}`;
    }, [data, groupBy]);

    const option = useMemo(() => {
      if (!data?.length) return {};

      const labels = data.map(r => r.label);
      const maxLen = labels.reduce((m, l) => Math.max(m, l.length), 0);

      const shouldRotate =
        labels.length > 8 ||
        (labels.length >= 5 && maxLen > 12) ||
        maxLen > 16;

      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "axis",
          axisPointer: { type: "shadow" },
          backgroundColor: "#fff",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
          extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
          confine: true,
          formatter: (params: { axisValueLabel: string; seriesName: string; value: number; marker: string; dataIndex: number }[]) => {
            if (!params?.length) return "";
            const idx = params[0].dataIndex;
            const row = data[idx];
            if (!row) return "";
            // Full untruncated name in tooltip
            let html = `<div style="font-weight:700;margin-bottom:2px;color:#0f172a">${row.label}</div>`;
            // Country line: only when showCountry is true AND it adds info
            // (i.e. country isn't the same as the bar label).
            if (showCountry && row.country && row.country !== row.label) {
              html += `<div style="font-size:11px;color:#64748b;margin-bottom:4px">${row.country}</div>`;
            }
            html += `<div style="font-size:11px;color:#94a3b8;margin-bottom:6px">Total: ${row.total.toFixed(2)} Mtpa</div>`;
            const tiers = [
              { name: "Future-Ready",  pct: row.pct_future_ready,  abs: row.future_ready,  color: COLOR_FUTURE_READY },
              { name: "Transitioning", pct: row.pct_transitioning, abs: row.transitioning, color: COLOR_TRANSITIONING },
              { name: "Legacy",        pct: row.pct_legacy,        abs: row.legacy,        color: COLOR_LEGACY },
            ];
            tiers.forEach(t => {
              html += `<div style="display:flex;justify-content:space-between;gap:16px;margin-top:3px;font-size:11.5px">
                <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${t.color};margin-right:5px"></span>${t.name}</span>
                <span style="font-weight:600">${t.pct.toFixed(1)}% · ${t.abs.toFixed(2)} Mtpa</span>
              </div>`;
            });
            return html;
          },
        },
        legend: {
          bottom: 0,
          itemGap: 18,
          textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
          data: [
            { name: "Legacy",        itemStyle: { color: COLOR_LEGACY } },
            { name: "Transitioning", itemStyle: { color: COLOR_TRANSITIONING } },
            { name: "Future-Ready",  itemStyle: { color: COLOR_FUTURE_READY } },
          ],
        },
        // Bottom margin: legend + slider + rotated labels (when needed)
        grid: {
          left: 64, right: 24, top: 16,
          bottom: shouldRotate ? 140 : 100,
        },
        xAxis: {
          type: "category",
          data: labels,
          axisLabel: {
            fontSize: labels.length > 6 ? 10 : 11,
            color: "#475569", fontFamily: F,
            interval: 0,
            rotate: shouldRotate ? 35 : 0,
            margin: 10,
            formatter: (v: string) =>
              shouldRotate && v.length > 22 ? v.slice(0, 20) + "…" : v,
          },
          axisLine:  { lineStyle: { color: "#e2e8f0" } },
          axisTick:  { show: false },
          splitLine: { show: false },
        },
        yAxis: {
          type: "value",
          max: 100,
          axisLabel: {
            fontSize: 11, color: "#94a3b8", fontFamily: F,
            formatter: (v: number) => `${v}%`,
          },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
        },
        series: [
          {
            name: "Legacy",
            type: "bar",
            stack: "mix",
            barMaxWidth: 56,
            data: data.map(r => ({
              value: r.pct_legacy,
              itemStyle: {
                color: COLOR_LEGACY,
                ...(r.highlighted ? { borderColor: "#E11C2A", borderWidth: 2 } : {}),
              },
            })),
          },
          {
            name: "Transitioning",
            type: "bar",
            stack: "mix",
            barMaxWidth: 56,
            data: data.map(r => ({
              value: r.pct_transitioning,
              itemStyle: {
                color: COLOR_TRANSITIONING,
                ...(r.highlighted ? { borderColor: "#E11C2A", borderWidth: 2 } : {}),
              },
            })),
          },
          {
            name: "Future-Ready",
            type: "bar",
            stack: "mix",
            barMaxWidth: 56,
            data: data.map(r => ({
              value: r.pct_future_ready,
              itemStyle: {
                color: COLOR_FUTURE_READY,
                borderRadius: [3, 3, 0, 0],
                ...(r.highlighted ? { borderColor: "#E11C2A", borderWidth: 2 } : {}),
              },
            })),
          },
        ],
        // dataZoom: inside (wheel + drag) + visible slider for navigation.
        // No initial windowing — full data shown by default; the slider just
        // lives at 0–100 until the user drags it or zooms in.
        dataZoom: [
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
            bottom: 32,
            borderColor: "#e2e8f0",
            backgroundColor: "#f8fafc",
            fillerColor: "rgba(225,28,42,0.10)",
            handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
            textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
            showDetail: false,
            brushSelect: false,
          },
        ],
        animation: true,
        animationDuration: 450,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, groupBy, showCountry]);

    // Track whether the user is currently zoomed (controls the reset button).
    // We consider the chart "zoomed" whenever the visible window is narrower
    // than the full dataset — including the initial windowed view, since the
    // user explicitly needs a way to expand to "show all".
    useEffect(() => {
      if (dataSignature === "empty") return;
      const initTimer = setTimeout(() => {
        const inst = echartsRef.current?.getEchartsInstance?.();
        if (!inst) return;

        const readState = () => {
          const opt = inst.getOption();
          const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
          if (dzArr.length === 0) return;
          let startPct = 0, endPct = 100;
          for (const dz of dzArr) {
            const s = dz?.start ?? 0;
            const e = dz?.end   ?? 100;
            if (s > startPct) startPct = s;
            if (e < endPct)   endPct   = e;
          }
          const fullView = startPct < 0.5 && endPct > 99.5;
          setIsZoomed(!fullView);
        };

        // Initial read — show reset button immediately if data > threshold
        readState();

        inst.off("datazoom");
        inst.on("datazoom", readState);
      }, 0);

      return () => {
        clearTimeout(initTimer);
        const inst = echartsRef.current?.getEchartsInstance?.();
        try { inst?.off("datazoom"); } catch { /* disposed */ }
      };
    }, [dataSignature]);

    // Imperative API for parent (in case page wants to programmatically reset)
    useImperativeHandle(ref, () => ({
      resetZoom: () => {
        const inst = echartsRef.current?.getEchartsInstance?.();
        if (!inst) return;
        inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
        setIsZoomed(false);
      },
    }), []);

    const showAllHandler = () => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      inst.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
      setIsZoomed(false);
    };

    if (!data?.length) {
      return (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height, color: "#94a3b8", fontSize: 13, fontFamily: F,
        }}>
          No data for the current filters
        </div>
      );
    }

    return (
      <div
        style={{ position: "relative", width: "100%", cursor: "grab" }}
        onMouseDown={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grabbing"; }}
        onMouseUp={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
      >
        <ReactECharts
          ref={echartsRef}
          option={option}
          style={{ height }}
          // notMerge: full replace each render so old bars/colors never persist
          // across filter changes. Trade-off: dataZoom resets on each render,
          // but the page-level force-remount key already resets the chart on
          // filter changes anyway, so we lose nothing.
          notMerge
          opts={{ renderer: "canvas" }}
        />

        {/* Reset zoom button — appears only when the chart is zoomed */}
        {isZoomed && (
          <button
            onClick={showAllHandler}
            title="Reset zoom"
            aria-label="Reset zoom"
            style={{
              position: "absolute",
              top: 8, right: 8,
              width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "#fff", color: "#475569",
              border: "1px solid #cbd5e1", borderRadius: 6,
              cursor: "pointer", padding: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.10)",
              transition: "background 0.15s, color 0.15s, border-color 0.15s",
              zIndex: 7,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "#fef2f2";
              (e.currentTarget as HTMLElement).style.color = "#E11C2A";
              (e.currentTarget as HTMLElement).style.borderColor = "#E11C2A";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "#fff";
              (e.currentTarget as HTMLElement).style.color = "#475569";
              (e.currentTarget as HTMLElement).style.borderColor = "#cbd5e1";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              xmlns="http://www.w3.org/2000/svg"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 14l-4 -4l4 -4" />
              <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
            </svg>
          </button>
        )}

        <div style={{
          fontSize: 10.5, color: "#94a3b8", marginTop: 4,
          fontFamily: F, textAlign: "right", paddingRight: 16,
        }}>
          Grouped by {groupBy}. Scroll, drag, or use the slider to navigate.
          {" "}Future-Ready &gt; Transitioning &gt; Legacy (highest tier wins).
        </div>
      </div>
    );
  }
);

export default FutureCapacityMixBar;