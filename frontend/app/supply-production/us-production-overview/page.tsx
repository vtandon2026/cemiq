// PATH: frontend/app/supply-production/us-production-overview/page.tsx
"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterCheckbox, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getGeoMapMeta, getGeoMapMekko, exportPptx } from "@/lib/api";
import { downloadBlob, producerColor, BAIN_RED } from "@/lib/chartHelpers";
import type { UsMekkoRow } from "@/lib/types";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const GRID_LEFT   = 60;
const GRID_RIGHT  = 20;
const GRID_BOTTOM = 130;
const CHART_H     = 640;
const GRID_TOP_PX = 60;

export default function UsProductionOverviewPage() {
  const [statuses,  setStatuses]  = useState<string[]>([]);
  const [regions,   setRegions]   = useState<string[]>([]);
  const [selStatus, setSelStatus] = useState<string[]>(["Operational"]);
  const [selRegion, setSelRegion] = useState<string[]>([]);
  const [selType,   setSelType]   = useState<string[]>([]);
  const [topN,      setTopN]      = useState(5);
  const [data,      setData]      = useState<UsMekkoRow[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chartCtx,  setChartCtx]  = useState<Record<string, unknown>>({});
  const containerRef    = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<unknown>(null);
  const mountedRef      = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    getGeoMapMeta().then((r) => {
      setStatuses(r.data.statuses);
      setRegions(r.data.us_regions);
      setSelStatus(r.data.statuses.includes("Operational") ? ["Operational"] : []);
      setSelRegion(r.data.us_regions);
      setSelType(r.data.cement_types);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getGeoMapMekko({
      status:      selStatus.length ? selStatus : undefined,
      cement_type: selType.length   ? selType   : undefined,
      us_region:   selRegion.length ? selRegion : [],
      top_n_state: topN,
    }).then((r) => {
      setData(r.data.data);
      setChartCtx({ view: "us_mekko", filters: { selStatus, selRegion, selType } });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selStatus, selRegion, selType, topN]);

  // ── Compute chart data ────────────────────────────────────────────────────
  const emptyChart = {
    grandTotal: 0,
    seriesData: [] as object[],
    colorMap:   {} as Record<string, string>,
    xTicks:     [] as { value: number; label: string; total: number }[],
    regionBands:[] as { xStart: number; xEnd: number; region: string; totalMta: number }[],
    legendProducers: [] as string[],
  };

  const chartData = (() => {
    if (!data.length) return emptyChart;

    const stateMap = new Map<string, { total: number; rows: UsMekkoRow[]; region: string }>();
    data.forEach((r) => {
      if (!stateMap.has(r.State)) stateMap.set(r.State, { total: r.StateTotal, rows: [], region: r["US Region"] });
      stateMap.get(r.State)!.rows.push(r);
    });

    const grandTotal = [...stateMap.values()].reduce((s, v) => s + v.total, 0);
    if (!grandTotal) return emptyChart;

    const allProducers = [...new Set(data.map((r) => r.Producer))].filter((p) => p !== "Other");
    const colorMap: Record<string, string> = {};
    allProducers.forEach((p, i) => { colorMap[p] = producerColor(p, i); });
    colorMap["Other"] = "#C8C8C8";

    const regionOrder = [...new Set(data.map((r) => r["US Region"]))];
    const sortedStates = [...stateMap.entries()].sort((a, b) => {
      const rA = regionOrder.indexOf(a[1].region);
      const rB = regionOrder.indexOf(b[1].region);
      return rA !== rB ? rA - rB : b[1].total - a[1].total;
    });

    const seriesData: object[] = [];
    const xTicks:     { value: number; label: string; total: number }[] = [];
    const regionBands:{ xStart: number; xEnd: number; region: string; totalMta: number }[] = [];
    let xOff = 0, curRegion = "", regionStart = 0, regionTotal = 0;

    // ── USA aggregate bar (leftmost) ──────────────────────────────────────
    const usaWidth = 8; // fixed 8% width for the USA summary bar
    const usaProducerTotals = new Map<string, number>();
    data.forEach((r) => {
      usaProducerTotals.set(r.Producer, (usaProducerTotals.get(r.Producer) ?? 0) + r.Capacity);
    });
    const usaRows = [...usaProducerTotals.entries()]
      .sort((a, b) => b[1] - a[1]);
    xTicks.push({ value: usaWidth / 2, label: "USA", total: grandTotal });
    let usaYBase = 0;
    usaRows.forEach(([producer, cap]) => {
      const h = (cap / grandTotal) * 100;
      if (h < 0.5) return;
      const barWidthPx  = (usaWidth / 100) * 900;
      const barHeightPx = (h / 100) * 580;
      const showLabel   = h >= 5;
      const useVertical = barWidthPx < 28 && barHeightPx > 40;
      const maxChars    = useVertical ? Math.floor(barHeightPx / 7) : Math.floor(barWidthPx / 7);
      const labelText   = producer.length > maxChars ? producer.slice(0, maxChars - 1) + "…" : producer;
      seriesData.push({
        value:     [usaWidth / 2, usaYBase, usaYBase + h, usaWidth],
        itemStyle: { color: colorMap[producer] ?? "#999", opacity: 0.88 },
        label: {
          show: showLabel, formatter: () => labelText,
          color: "#ffffff", fontSize: 11,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: h > 15 ? 600 : 400,
          overflow: "truncate", rotate: useVertical ? 90 : 0,
        },
        tooltip: {
          formatter: () =>
            `<div style="font-family:Arial,sans-serif;min-width:150px">
              <div style="font-weight:700;color:#0f172a;margin-bottom:4px">${producer}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">Scope</span><span style="font-weight:600">USA Total</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">Capacity</span><span style="font-weight:600">${cap.toFixed(1)} MtA</span></div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">Share</span><span style="font-weight:700;color:#E60000">${((cap/grandTotal)*100).toFixed(1)}%</span></div>
            </div>`,
        },
      });
      usaYBase += h;
    });
    // USA region band
    regionBands.push({ xStart: 0, xEnd: usaWidth, region: "USA", totalMta: grandTotal });
    xOff = usaWidth + 1; // 1% gap after USA bar

    sortedStates.forEach(([state, { total, rows, region }]) => {
      const w = (total / grandTotal) * 100;
      if (region !== curRegion) {
        if (curRegion) regionBands.push({ xStart: regionStart, xEnd: xOff, region: curRegion, totalMta: regionTotal });
        curRegion = region; regionStart = xOff; regionTotal = 0;
      }
      regionTotal += total;
      xTicks.push({ value: xOff + w / 2, label: state, total });

      let yBase = 0;
      rows.sort((a, b) => b.Capacity - a.Capacity).forEach((r) => {
        const h = r.Share * 100;
        // Estimate pixel dimensions (chart ~900px wide, 580px tall plot area)
        const barWidthPx  = (w  / 100) * 900;
        const barHeightPx = (h  / 100) * 580;
        const showLabel   = h >= 5 && w >= 1.5;
        // Vertical if bar is narrow but tall enough to read vertically
        const useVertical = barWidthPx < 28 && barHeightPx > 40;
        // For horizontal: truncate to fit width; for vertical: truncate to fit height
        const charsHoriz  = Math.max(3, Math.floor(barWidthPx  / 7));
        const charsVert   = Math.max(3, Math.floor(barHeightPx / 7));
        const maxChars    = useVertical ? charsVert : charsHoriz;
        const labelText   = r.Producer.length > maxChars
          ? r.Producer.slice(0, maxChars - 1) + "…"
          : r.Producer;
        seriesData.push({
          value:     [xOff + w / 2, yBase, yBase + h, w],
          itemStyle: { color: colorMap[r.Producer] ?? "#999", opacity: 0.88 },
          label: {
            show:      showLabel,
            formatter: () => labelText,
            color:     "#ffffff",
            fontSize:  barWidthPx > 40 ? 11 : 9,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: h > 15 ? 600 : 400,
            overflow:  "truncate",
            rotate:    useVertical ? 90 : 0,
          },
          tooltip: {
            formatter: () =>
              `<div style="font-family:Arial,sans-serif;min-width:150px">
                <div style="font-weight:700;color:#0f172a;margin-bottom:4px">${r.Producer}</div>
                <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">State</span><span style="font-weight:600">${state}</span></div>
                <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">Capacity</span><span style="font-weight:600">${r.Capacity.toFixed(1)} MtA</span></div>
                <div style="display:flex;justify-content:space-between;gap:12px;font-size:11px;margin-top:3px"><span style="color:#64748b">Share</span><span style="font-weight:700;color:#E60000">${(r.Share*100).toFixed(1)}%</span></div>
              </div>`,
          },
        });
        yBase += h;
      });
      xOff += w;
    });
    if (curRegion) regionBands.push({ xStart: regionStart, xEnd: xOff, region: curRegion, totalMta: regionTotal });

    return { grandTotal, seriesData, colorMap, xTicks, regionBands, legendProducers: [...new Set(data.map((r) => r.Producer))] };
  })();

  const { grandTotal, seriesData, colorMap, xTicks, regionBands, legendProducers } = chartData;

  // ── SVG overlay ───────────────────────────────────────────────────────────
  const drawOverlay = useCallback((chart: { getWidth: () => number; convertToPixel: (coord: unknown, val: unknown) => number } | null) => {
    if (!chart) return;
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll(".mekko-us-overlay").forEach((el) => el.remove());
    if (!xTicks.length) return;

    let totalW: number;
    const toPixel = (xVal: number) => chart.convertToPixel({ xAxisIndex: 0 }, xVal) as number;
    try {
      totalW = chart.getWidth();
      if (!totalW || totalW <= 0) return;
      // Validate convertToPixel is ready (returns 0 before chart is mounted)
      const testPx = toPixel(50);
      if (!testPx || testPx <= 0) return;
    } catch { return; }
    const plotW  = totalW - GRID_LEFT - GRID_RIGHT;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "mekko-us-overlay");
    svg.setAttribute("width",  String(totalW));
    svg.setAttribute("height", String(CHART_H));
    // clipPath so overlay never renders outside the plot area
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clip.setAttribute("id", "mekko-clip");
    const clipRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    clipRect.setAttribute("x",      String(GRID_LEFT));
    clipRect.setAttribute("y",      "0");
    clipRect.setAttribute("width",  String(totalW - GRID_LEFT - GRID_RIGHT));
    clipRect.setAttribute("height", String(CHART_H));
    clip.appendChild(clipRect);
    defs.appendChild(clip);
    svg.appendChild(defs);
    // Wrap all overlay content in a clipped group
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("clip-path", "url(#mekko-clip)");
    Object.assign(svg.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", overflow: "hidden" });

    // Region header bands
    regionBands.forEach((band) => {
      const x1 = toPixel(band.xStart);
      const x2 = toPixel(band.xEnd);
      const cx = (x1 + x2) / 2;
      const bw = x2 - x1;

      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(x1)); rect.setAttribute("y", "0");
      rect.setAttribute("width", String(Math.max(bw - 1, 0))); rect.setAttribute("height", "18");
      rect.setAttribute("fill", "#f1f5f9"); rect.setAttribute("rx", "2");
      svg.appendChild(rect);

      const rLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
      rLabel.setAttribute("x", String(cx)); rLabel.setAttribute("y", "13");
      rLabel.setAttribute("text-anchor", "middle"); rLabel.setAttribute("font-size", "10");
      rLabel.setAttribute("font-weight", "700"); rLabel.setAttribute("font-family", "Arial, Helvetica, sans-serif");
      rLabel.setAttribute("fill", "#1e293b"); rLabel.textContent = band.region;
      svg.appendChild(rLabel);

      const mta = document.createElementNS("http://www.w3.org/2000/svg", "text");
      mta.setAttribute("x", String(cx)); mta.setAttribute("y", "30");
      mta.setAttribute("text-anchor", "middle"); mta.setAttribute("font-size", "9");
      mta.setAttribute("font-family", "Arial, Helvetica, sans-serif"); mta.setAttribute("fill", "#64748b");
      mta.textContent = `${band.totalMta.toFixed(0)} MtA`;
      g.appendChild(mta);

      if (band.xStart > 0) {
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", String(x1)); line.setAttribute("y1", "0");
        line.setAttribute("x2", String(x1)); line.setAttribute("y2", String(CHART_H - GRID_BOTTOM));
        line.setAttribute("stroke", "#E60000"); line.setAttribute("stroke-width", "1.5");
        line.setAttribute("stroke-dasharray", "4,3"); line.setAttribute("opacity", "0.6");
        g.appendChild(line);
      }
    });

    // State capacity annotations — only if bar is wide enough
    xTicks.forEach((tick, i) => {
      const cx   = toPixel(tick.value);
      // Estimate bar pixel width from adjacent tick positions
      const prevX = i > 0 ? toPixel(xTicks[i - 1].value) : GRID_LEFT;
      const nextX = i < xTicks.length - 1 ? toPixel(xTicks[i + 1].value) : totalW - GRID_RIGHT;
      const barPx = Math.min(cx - prevX, nextX - cx) * 2;
      // Only show if number fits (~18px minimum for a short number)
      if (barPx < 14) return;

      const label = tick.total >= 10 ? tick.total.toFixed(0) : tick.total.toFixed(1);
      const cap = document.createElementNS("http://www.w3.org/2000/svg", "text");
      cap.setAttribute("x", String(cx)); cap.setAttribute("y", "44");
      cap.setAttribute("text-anchor", "middle"); cap.setAttribute("font-size", "8");
      cap.setAttribute("font-family", "Arial, Helvetica, sans-serif"); cap.setAttribute("fill", "#94a3b8");
      cap.textContent = label;
      g.appendChild(cap);
    });

    // State labels — all vertical (-90°)
    xTicks.forEach((tick) => {
      const cx = toPixel(tick.value);
      const ty = CHART_H - GRID_BOTTOM + 6;

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "0");
      text.setAttribute("y", "0");
      text.setAttribute("text-anchor", "end");
      text.setAttribute("font-size", "10");
      text.setAttribute("font-family", "Arial, Helvetica, sans-serif");
      text.setAttribute("fill", "#475569");
      text.setAttribute("transform", `translate(${cx + 3}, ${ty}) rotate(-90)`);
      text.textContent = tick.label;
      g.appendChild(text);
    });

    svg.appendChild(g);
    container.style.position = "relative";
    container.appendChild(svg);
  }, [xTicks, regionBands]);

  const onChartReady = useCallback((chart: unknown) => {
    chartInstanceRef.current = chart;
    if (!chart) return;
    const c = chart as {
      getWidth: () => number;
      convertToPixel: (coord: unknown, val: unknown) => number;
      on: (event: string, fn: () => void) => void;
      off: (event: string) => void;
    };
    // Delay so ECharts finishes mounting before we call convertToPixel
    setTimeout(() => {
      drawOverlay(c);
      try { c.off("datazoom"); } catch (_) {}
      c.on("datazoom", () => drawOverlay(c));
    }, 150);
  }, [drawOverlay]);

  // Redraw overlay when data changes (xTicks/regionBands updated after fetch)
  // Also fires when filters change — ECharts needs time to re-render before we draw
  useEffect(() => {
    if (!chartInstanceRef.current) return;
    const c = chartInstanceRef.current as {
      getWidth: () => number;
      convertToPixel: (coord: unknown, val: unknown) => number;
      on: (event: string, fn: () => void) => void;
    };
    // Multiple delays — first clears stale overlay immediately, then redraws after ECharts settles
    const container = containerRef.current;
    if (container) container.querySelectorAll(".mekko-us-overlay").forEach((el) => el.remove());
    const t1 = setTimeout(() => drawOverlay(c), 50);
    const t2 = setTimeout(() => drawOverlay(c), 300);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [xTicks, regionBands, drawOverlay, data]);

  // ── PPT export ────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    if (!data.length || !grandTotal) return;
    setExporting(true);
    const tc = (v: string | number | null) =>
      v == null ? null : typeof v === "number" ? { number: v } : { string: v };
    try {
      const states    = [...new Set(data.map((r) => r.State))];
      const producers = [...new Set(data.map((r) => r.Producer))];
      const header    = [null, ...states.map((s) => tc(s))];
      const rows      = producers.map((p) => {
        const row: (ReturnType<typeof tc>)[] = [tc(p)];
        states.forEach((s) => {
          const match = data.find((r) => r.Producer === p && r.State === s);
          row.push(tc(match ? match.Share * 100 : null));
        });
        return row;
      });
      const res = await exportPptx({
        template: "mekko",
        filename: "us_production_mekko.pptx",
        data:     [{ name: "MekkoChart", table: [header, ...rows] }],
      });
      downloadBlob(
        new Blob([res.data], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }),
        "us_production_mekko.pptx",
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // ── CSV export ────────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const csv = [
      "US Region,State,Producer,Capacity,StateTotal,Share",
      ...data.map((r) => `${r["US Region"]},${r.State},${r.Producer},${r.Capacity},${r.StateTotal},${(r.Share * 100).toFixed(2)}%`),
    ].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), "us_production_mekko.csv");
  };

  // ── ECharts option ────────────────────────────────────────────────────────
  const buildOption = () => {
    if (!data.length || !grandTotal) return {};
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
        type: "value", min: 0, max: 100,
        axisLabel: { show: false }, axisTick: { show: false },
        axisLine:  { show: true, lineStyle: { color: "#e2e8f0" } },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value", min: 0, max: 100,
        axisLabel: { formatter: (v: number) => `${v}%`, fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif" },
        axisLine: { show: false }, axisTick: { show: false },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.35)" } },
      },
      series: [{
        type: "custom",
        renderItem: (
          _: unknown,
          api: { value: (i: number) => number; coord: (v: number[]) => number[]; style: (o: object) => object }
        ) => {
          const cx = api.value(0), yL = api.value(1), yH = api.value(2), bw = api.value(3);
          const [x1, y1] = api.coord([cx - bw / 2, yH]);
          const [x2, y2] = api.coord([cx + bw / 2, yL]);
          return {
            type: "rect",
            shape: { x: x1, y: y1, width: Math.max(x2 - x1, 0.5), height: Math.max(y2 - y1, 0.5) },
            style: api.style({ stroke: "#ffffff", lineWidth: 0.8 }),
          };
        },
        data: seriesData,
        encode: { x: 0, y: [1, 2] },
        label:  { show: true, position: "inside", overflow: "truncate" },
      }],
      grid: { left: GRID_LEFT, right: GRID_RIGHT, top: GRID_TOP_PX, bottom: GRID_BOTTOM },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 8,
          borderColor: "#e2e8f0",
          fillerColor: "rgba(230,0,0,0.08)",
          handleStyle: { color: "#E60000", borderColor: "#E60000" },
          textStyle: { color: "#94a3b8", fontSize: 10 },
          showDetail: false,
        },
      ],
      animation: true, animationDuration: 400, animationEasing: "cubicOut" as const,
    };
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader title="US Cement Capacity by Producer" subtitle="Supply & Production · CemNet · 100% Mekko" />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ──────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {statuses.map((s) => (
                <FilterCheckbox key={s} label={s}
                  checked={selStatus.includes(s)}
                  onChange={(v) => setSelStatus(v ? [...selStatus, s] : selStatus.filter((x) => x !== s))}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>US Region</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {regions.map((r) => (
                <FilterCheckbox key={r} label={r}
                  checked={selRegion.includes(r)}
                  onChange={(v) => setSelRegion(v ? [...selRegion, r] : selRegion.filter((x) => x !== r))}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Top N producers per state: <strong>{topN}</strong></FilterLabel>
            <input type="range" min={2} max={20} value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              style={{ width: "100%", accentColor: BAIN_RED, marginTop: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
              <span>2</span><span>20</span>
            </div>
          </div>
        </Sidebar>

        {/* ── Main ─────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            <div style={{ background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
                    US Cement Production Capacity
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    Market share by state & producer · MtA capacity
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv} csvDisabled={data.length === 0}
                    showPpt={true} onPpt={exportPpt}
                    pptDisabled={data.length === 0} pptLoading={exporting}
                  />
                </div>
              </div>
              
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: CHART_H, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                <div ref={containerRef} style={{ position: "relative" }}>
                  <ReactECharts
                    option={buildOption()}
                    style={{ height: CHART_H }}
                    notMerge
                    opts={{ renderer: "canvas" }}
                    onChartReady={onChartReady}
                    onEvents={{
                      datazoom: () => {
                        if (!chartInstanceRef.current) return;
                        const c = chartInstanceRef.current as {
                          getWidth: () => number;
                          convertToPixel: (coord: unknown, val: unknown) => number;
                          on: (event: string, fn: () => void) => void;
                        };
                        drawOverlay(c);
                      },
                      rendered: () => {
                        if (!chartInstanceRef.current) return;
                        const c = chartInstanceRef.current as {
                          getWidth: () => number;
                          convertToPixel: (coord: unknown, val: unknown) => number;
                          on: (event: string, fn: () => void) => void;
                        };
                        drawOverlay(c);
                      },
                    }}
                  />
                </div>
              )}

              {legendProducers.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
                  {legendProducers.map((p) => (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: colorMap[p] ?? "#999", display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: "#475569" }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CemNet</p>
            </div>
          </div>

          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ selStatus, selRegion, topN }}
              chartContext={chartCtx}
              dataScope="geomap"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}