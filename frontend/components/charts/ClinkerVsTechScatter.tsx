// PATH: frontend/components/charts/ClinkerVsTechScatter.tsx
// Supporting Chart 1 — Clinker Dependency vs Future-Tech Adoption.
// Bubble scatter: X = clinker/cement ratio, Y = adoption score [0,1],
// size = total cement capacity, color = region.
//
// Interaction:
//   • Mouse wheel / trackpad pinch → zoom in/out (centered on cursor)
//   • Click-and-drag inside the plot → pan in any direction
//   • Reset button (top-right when zoomed) → restore default view
//
// Uses the documented ECharts pattern: two `inside` dataZoom entries,
//   one horizontal (x-axis), one vertical (y-axis, with orient: "vertical").
"use client";
import ReactECharts from "echarts-for-react";
import {
  forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState,
} from "react";
import type { GreenScatterPoint } from "@/lib/types";

interface Props {
  data:    GreenScatterPoint[];
  height?: number;
  groupBy?: "company" | "region";
}

export interface ClinkerVsTechScatterHandle {
  resetZoom: () => void;
}

const F = "Arial, Helvetica, sans-serif";

const REGION_COLORS: Record<string, string> = {
  "Europe":         "#0EA5E9",
  "North America":  "#8B5CF6",
  "China":          "#E11C2A",
  "APAC":           "#10B981",
  "MEA":            "#F59E0B",
  "South America":  "#EC4899",
  "Other":          "#94A3B8",
};
const regionColor = (r: string) => REGION_COLORS[r] ?? "#94a3b8";

// Format a 0–1 value as a percent string, with decimal precision that scales
// with zoom level. At 1× zoom integer steps are fine; at 2× and beyond ticks
// land on half-integers or quarter-integers, so we need decimals to show that.
//   zoomScale 1   → "60%"
//   zoomScale 2   → "60.5%"
//   zoomScale 4   → "60.25%"
//   zoomScale 8+  → "60.13%"
function formatPercent(v: number, zoomScale: number): string {
  const pct = v * 100;
  let decimals = 0;
  if      (zoomScale >= 8) decimals = 2;
  else if (zoomScale >= 4) decimals = 2;
  else if (zoomScale >= 2) decimals = 1;
  // Trim trailing zeros so "60.00%" doesn't appear when the value is integral
  const s = pct.toFixed(decimals);
  return `${parseFloat(s)}%`;
}

const ClinkerVsTechScatter = forwardRef<ClinkerVsTechScatterHandle, Props>(
  function ClinkerVsTechScatter({ data, height = 420, groupBy = "company" }, ref) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const echartsRef = useRef<any>(null);
    const [isZoomed, setIsZoomed] = useState(false);

    // Current zoom factor (1 = full view, >1 = zoomed in). Read by the
    // symbolSize function so bubbles grow when zoomed in. Updated on every
    // datazoom event. Using a ref (not state) because ECharts needs to read
    // the latest value during render without triggering React re-renders.
    const zoomScaleRef = useRef(1);

    const dataSignature = useMemo(() => {
      if (!data?.length) return "empty";
      return `${groupBy}|${data.length}|${data[0]?.label ?? ""}|${data[data.length - 1]?.label ?? ""}`;
    }, [data, groupBy]);

    const option = useMemo(() => {
      if (!data?.length) return {};

      const regions = Array.from(new Set(data.map(d => d.region)));

      const caps   = data.map(d => d.capacity).filter(v => v > 0);
      const maxCap = caps.length ? Math.max(...caps) : 1;
      const minCap = caps.length ? Math.min(...caps) : 0;

      // Base bubble size (in pixels at 100% zoom). The actual rendered size is
      // this multiplied by the current zoom factor — bubbles grow when zoomed
      // in so they keep their visual prominence relative to the surrounding
      // whitespace, like circles on a map zooming in.
      const baseSize = (cap: number) => {
        if (cap <= 0) return 8;
        if (maxCap === minCap) return 18;
        const t = Math.sqrt((cap - minCap) / (maxCap - minCap));
        return 10 + t * 30;
      };

      const series = regions.map((region) => ({
        name: region,
        type: "scatter",
        data: data
          .filter(d => d.region === region)
          .map(d => ({
            value: [d.clinker_dependency, d.adoption_score, d.capacity, d.plant_count],
            name:  d.label,
            // baseSize stored in value[4] so the symbolSize function can read it
            // without needing a closure over the point.
            itemStyle: {
              color:        regionColor(region),
              opacity:      0.72,
              borderColor:  "rgba(255,255,255,0.9)",
              borderWidth:  1,
            },
            emphasis: {
              itemStyle: {
                opacity:     0.95,
                borderColor: "#0f172a",
                borderWidth: 1.6,
              },
            },
            _baseSize: baseSize(d.capacity),
          })),
        // symbolSize as a function — receives the raw value array and the params.
        // Reads the current zoom factor from zoomScaleRef so bubbles grow on
        // zoom-in. Capped so they don't get comically huge at extreme zoom.
        symbolSize: (_value: number[], params: { data: { _baseSize: number } }) => {
          const base  = params?.data?._baseSize ?? 12;
          const scale = Math.min(zoomScaleRef.current, 4);   // cap at 4× growth
          return base * scale;
        },
      }));

      return {
        backgroundColor: "transparent",
        tooltip: {
          trigger: "item",
          backgroundColor: "#fff",
          borderColor: "#e2e8f0",
          borderWidth: 1,
          padding: [10, 14],
          textStyle: { fontSize: 12, color: "#1e293b", fontFamily: F },
          extraCssText: "box-shadow:0 4px 16px rgba(0,0,0,0.10);border-radius:8px;",
          confine: true,
          formatter: (p: { name: string; seriesName: string; value: number[]; color: string }) => {
            const [cd, ad, cap, pc] = p.value;
            return `
              <div style="font-weight:700;margin-bottom:6px;color:#0f172a">${p.name}</div>
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;font-size:11px;color:#64748b">
                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
                ${p.seriesName}
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;font-size:11.5px">
                <div style="display:flex;justify-content:space-between;gap:16px">
                  <span style="color:#64748b">Clinker dependency</span>
                  <span style="font-weight:600">${(cd * 100).toFixed(1)}%</span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:16px">
                  <span style="color:#64748b">Adoption score</span>
                  <span style="font-weight:600">${(ad * 100).toFixed(1)}%</span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:16px">
                  <span style="color:#64748b">Cement capacity</span>
                  <span style="font-weight:600">${cap.toFixed(2)} Mtpa</span>
                </div>
                <div style="display:flex;justify-content:space-between;gap:16px">
                  <span style="color:#64748b">Plants</span>
                  <span style="font-weight:600">${pc}</span>
                </div>
              </div>`;
          },
        },
        legend: {
          bottom: 0,
          itemGap: 14,
          textStyle: { fontSize: 11, color: "#475569", fontFamily: F },
          data: regions.map(r => ({
            name: r,
            itemStyle: { color: regionColor(r) },
          })),
        },
        grid: { left: 60, right: 56, top: 16, bottom: 90 },
        xAxis: {
          type: "value",
          min: 0,
          max: 1.2,
          axisLabel: {
            fontSize: 11, color: "#94a3b8", fontFamily: F,
            // Show decimals when zoomed in so tick labels stay informative.
            // At 1× zoom: "60%". At 2×: "60.5%". At 4×: "60.25%".
            formatter: (v: number) => formatPercent(v, zoomScaleRef.current),
          },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        yAxis: {
          type: "value",
          min: 0,
          max: 1,
          axisLabel: {
            fontSize: 11, color: "#94a3b8", fontFamily: F,
            formatter: (v: number) => formatPercent(v, zoomScaleRef.current),
          },
          splitLine: { lineStyle: { color: "#f1f5f9" } },
          axisLine: { show: false },
          axisTick: { show: false },
        },
        // ── DataZoom — documented pattern for 2D scatter zoom ──────────────
        // TWO inside-zoom entries:
        //   1. xAxisIndex: 0 (default horizontal orientation) — zooms x
        //   2. yAxisIndex: 0 + orient: "vertical" — zooms y
        // ECharts routes scroll-wheel events to whichever entry matches the
        // cursor's axis affinity, and routes drag-pan to both. This is the
        // pattern shown in ECharts' own scatter-zoom examples.
        dataZoom: [
          // Inside zoom — pinch (ctrl+wheel) zooms x, drag pans x.
          // Plain wheel events are intercepted by the wrapper div for panning.
          // filterMode: "none" → keep all data points, only the visible window
          // changes (otherwise points outside the window are removed, which can
          // cause symbol rescaling and an empty-looking chart at high zoom).
          {
            type: "inside",
            xAxisIndex: 0,
            start: 0,
            end: 100,
            filterMode: "none",
            zoomOnMouseWheel: "ctrl",
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            preventDefaultMouseMove: false,
          },
          {
            type: "inside",
            yAxisIndex: 0,
            orient: "vertical",
            start: 0,
            end: 100,
            filterMode: "none",
            zoomOnMouseWheel: "ctrl",
            moveOnMouseMove: true,
            moveOnMouseWheel: false,
            preventDefaultMouseMove: false,
          },
          // Horizontal slider — sits in the bottom margin BETWEEN the x-axis
          // labels (which live at ~46–80px from bottom) and the legend (0–18px).
          {
            type: "slider",
            xAxisIndex: 0,
            filterMode: "none",
            height: 12,
            bottom: 24,
            left: 60,
            right: 56,
            borderColor: "#e2e8f0",
            backgroundColor: "#f8fafc",
            fillerColor: "rgba(225,28,42,0.10)",
            handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
            textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
            showDetail: false,
            brushSelect: false,
          },
          // Vertical slider — right margin, aligned with plot top/bottom
          {
            type: "slider",
            yAxisIndex: 0,
            filterMode: "none",
            width: 12,
            right: 26,
            top: 16,
            bottom: 90,
            borderColor: "#e2e8f0",
            backgroundColor: "#f8fafc",
            fillerColor: "rgba(225,28,42,0.10)",
            handleStyle: { color: "#fff", borderColor: "#E11C2A", borderWidth: 1.5 },
            textStyle: { fontSize: 10, color: "#94a3b8", fontFamily: F },
            showDetail: false,
            brushSelect: false,
          },
        ],
        series,
        animation: true,
        animationDuration: 450,
        // No animation on updates — pan/zoom dispatch actions trigger update
        // tweens that make pan feel laggy. Set 0 so changes apply instantly.
        animationDurationUpdate: 0,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dataSignature]);

    // Track zoom state for the reset button
    useEffect(() => {
      if (dataSignature === "empty") return;
      const initTimer = setTimeout(() => {
        const inst = echartsRef.current?.getEchartsInstance?.();
        if (!inst) return;

        const readState = () => {
          const opt = inst.getOption();
          const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
          const anyZoomed = dzArr.some(dz => {
            const s = dz?.start ?? 0;
            const e = dz?.end   ?? 100;
            return s > 0.5 || e < 99.5;
          });
          setIsZoomed(anyZoomed);

          // Compute zoom factor from the narrowest visible axis. Both x and y
          // can have different zoom levels; we use whichever is more zoomed so
          // bubbles match the most-zoomed axis.
          let narrowest = 100;   // pct
          for (const dz of dzArr) {
            const s = dz?.start ?? 0;
            const e = dz?.end   ?? 100;
            const span = Math.max(1, e - s);   // avoid /0
            if (span < narrowest) narrowest = span;
          }
          const scale = 100 / narrowest;   // 1× at full view, 4× at 25% window
          if (Math.abs(scale - zoomScaleRef.current) > 0.01) {
            zoomScaleRef.current = scale;
            // Force ECharts to re-render the points so symbolSize() re-evaluates.
            // setOption with an empty object + lazyUpdate diffs cheaply.
            try { inst.setOption({}, { lazyUpdate: true }); } catch { /* disposed */ }
          }
        };

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

    const doReset = () => {
      const inst = echartsRef.current?.getEchartsInstance?.();
      if (!inst) return;
      // Reset both dataZoom entries (indices 0 = x, 1 = y) to 0–100
      inst.dispatchAction({
        type: "dataZoom",
        batch: [
          { dataZoomIndex: 0, start: 0, end: 100 },
          { dataZoomIndex: 1, start: 0, end: 100 },
        ],
      });
      setIsZoomed(false);
    };

    useImperativeHandle(ref, () => ({ resetZoom: doReset }), []);

    // ── Wheel-to-pan handler ──────────────────────────────────────────────
    // Two-finger trackpad swipe (or scroll wheel) → pan the chart by adjusting
    // the dataZoom window. Pinch gestures (which generate ctrl+wheel events on
    // every browser) are ignored here and fall through to ECharts where the
    // inside-zoom entries handle them as zoom.
    const wrapperRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const el = wrapperRef.current;
      if (!el) return;

      // ── Wheel-to-pan with rAF throttling ─────────────────────────────────
      // Trackpads fire wheel events at 60–120 Hz. Calling dispatchAction on
      // every event triggers a full ECharts layout each time → sluggish feel.
      // We accumulate deltas in pendingDx/Dy and flush once per animation
      // frame, so dispatchAction runs at most ~60 Hz no matter how fast the
      // events arrive.
      let pendingDx = 0;
      let pendingDy = 0;
      let rafId: number | null = null;

      const flush = () => {
        rafId = null;
        const inst = echartsRef.current?.getEchartsInstance?.();
        if (!inst) { pendingDx = 0; pendingDy = 0; return; }

        const opt = inst.getOption();
        const dzArr = (opt?.dataZoom || []) as Array<{ start?: number; end?: number }>;
        if (dzArr.length < 2) { pendingDx = 0; pendingDy = 0; return; }

        // PAN_FACTOR controls how far one pixel of wheel delta moves the chart.
        // Bumped up from 0.4 because rAF throttling combines multiple wheel
        // events into one dispatch — without this, panning feels too slow.
        const PAN_FACTOR = 1.0;

        const xStart = dzArr[0]?.start ?? 0;
        const xEnd   = dzArr[0]?.end   ?? 100;
        const yStart = dzArr[1]?.start ?? 0;
        const yEnd   = dzArr[1]?.end   ?? 100;
        const xWidth  = xEnd - xStart;
        const yHeight = yEnd - yStart;

        const dxPct = (pendingDx / el.clientWidth)  * xWidth  * PAN_FACTOR;
        const dyPct = (pendingDy / el.clientHeight) * yHeight * PAN_FACTOR;
        pendingDx = 0;
        pendingDy = 0;

        // Clamp so we don't pan past 0–100
        let newXStart = xStart + dxPct;
        let newXEnd   = xEnd   + dxPct;
        if (newXStart < 0)   { newXEnd   -= newXStart;   newXStart = 0;   }
        if (newXEnd   > 100) { newXStart -= (newXEnd - 100); newXEnd = 100; }

        let newYStart = yStart - dyPct;   // invert for natural scroll feel
        let newYEnd   = yEnd   - dyPct;
        if (newYStart < 0)   { newYEnd   -= newYStart;   newYStart = 0;   }
        if (newYEnd   > 100) { newYStart -= (newYEnd - 100); newYEnd = 100; }

        // Skip dispatch if nothing changed (saves a layout pass when at edges)
        if (Math.abs(newXStart - xStart) < 0.01 &&
            Math.abs(newYStart - yStart) < 0.01) return;

        inst.dispatchAction({
          type: "dataZoom",
          batch: [
            { dataZoomIndex: 0, start: newXStart, end: newXEnd },
            { dataZoomIndex: 1, start: newYStart, end: newYEnd },
          ],
        });
      };

      const onWheel = (e: WheelEvent) => {
        // Pinch (ctrl/cmd+wheel) → ECharts inside-zoom handles it. Don't intercept.
        if (e.ctrlKey || e.metaKey) return;

        e.preventDefault();
        pendingDx += e.deltaX;
        pendingDy += e.deltaY;
        if (rafId === null) {
          rafId = requestAnimationFrame(flush);
        }
      };

      // Capture phase: intercept wheel BEFORE ECharts' own canvas-level listener.
      el.addEventListener("wheel", onWheel, { passive: false, capture: true });
      return () => {
        el.removeEventListener("wheel", onWheel, { capture: true } as EventListenerOptions);
        if (rafId !== null) cancelAnimationFrame(rafId);
      };
    }, []);

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
        ref={wrapperRef}
        style={{ position: "relative", width: "100%", cursor: "grab" }}
        onMouseDown={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grabbing"; }}
        onMouseUp={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.cursor = "grab"; }}
      >
        <ReactECharts
          ref={echartsRef}
          option={option}
          style={{ height }}
          lazyUpdate
          opts={{ renderer: "canvas" }}
        />

        {isZoomed && (
          <button
            onClick={doReset}
            title="Reset zoom"
            aria-label="Reset zoom"
            style={{
              position: "absolute",
              top: 8, right: 48,
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
          Grouped by {groupBy}. Bubble size = total cement capacity (Mtpa). Pinch/scroll to zoom, drag to pan.
        </div>
      </div>
    );
  }
);

export default ClinkerVsTechScatter;