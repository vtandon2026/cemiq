// PATH: frontend/components/charts/GreenTechMap.tsx
// Green Technology Adoption Map.
// Bubble size = cement capacity; color = primary green tech (CCUS / Clay / Alt Fuel).
// Same Leaflet pattern as CarbonBubbleMap (popup-as-tooltip to avoid clipping).
"use client";
import { useEffect, useRef } from "react";
import type { GreenMapPoint } from "@/lib/types";

interface Props {
  data:    GreenMapPoint[];
  height?: number;
}

// Innovation-forward palette — distinct from the carbon page's red/green wet/dry.
// CCUS = electric blue (capture/storage feel)
// Clay = warm amber (clay/earth)
// Alt Fuel = vibrant green (sustainable fuel)
const COLOR_CCUS = "#0EA5E9";
const COLOR_CLAY = "#F59E0B";
const COLOR_ALT  = "#10B981";

const colorFor = (t: string) => {
  if (t === "ccus")     return COLOR_CCUS;
  if (t === "clay")     return COLOR_CLAY;
  if (t === "alt_fuel") return COLOR_ALT;
  return "#94a3b8";
};

const labelFor = (t: string) => {
  if (t === "ccus")     return "CCUS";
  if (t === "clay")     return "Clay Calcination";
  if (t === "alt_fuel") return "Alternative Fuel";
  return "Other";
};

export default function GreenTechMap({ data, height = 480 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const layerRef     = useRef<unknown>(null);
  const legendRef    = useRef<unknown>(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      const styleId = "green-tech-leaflet-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
.leaflet-popup-content-wrapper { background: #fff !important; border-radius: 10px !important; padding: 0 !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12) !important; border: 0.5px solid #e2e8f0 !important; }
.leaflet-popup-content { margin: 0 !important; padding: 0 !important; min-width: 240px !important; }
.leaflet-popup-tip-container { display: none !important; }
.leaflet-popup-close-button { display: none !important; }
.green-popup .leaflet-popup-content-wrapper { padding: 0 !important; }
`;
        document.head.appendChild(style);
      }

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [25, 10],
        zoom: 2,
        zoomControl: true,
        attributionControl: false,
        minZoom: 1,
        maxZoom: 10,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap",
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 19,
        pane: "shadowPane",
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();
    return () => { cancelled = true; };
  }, []);

  // Draw bubbles on data change
  useEffect(() => {
    const t = setTimeout(() => drawBubbles(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function drawBubbles() {
    if (!mapRef.current || !layerRef.current || !mountedRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const lg = layerRef.current as ReturnType<typeof L.layerGroup>;
      lg.clearLayers();

      if (!data?.length) return;

      const caps   = data.map(d => d.size_cap).filter(v => v > 0);
      const maxCap = caps.length ? Math.max(...caps) : 1;
      const minCap = caps.length ? Math.min(...caps) : 0;

      const scaleR = (cap: number) => {
        if (cap <= 0) return 4;
        if (maxCap === minCap) return 10;
        const t = Math.sqrt((cap - minCap) / (maxCap - minCap));
        return 5 + t * 20;
      };

      const ordered = [...data].sort((a, b) => b.size_cap - a.size_cap);

      // When any plant carries the highlight flag, we're in "focus mode":
      // highlighted plants render with their normal colors; everyone else is
      // grayed out so the focus pops without needing red borders or size diffs.
      const anyHighlighted = data.some(p => p.highlighted);
      const GRAY = "#cbd5e1";

      ordered.forEach((row) => {
        const useGray = anyHighlighted && !row.highlighted;
        const baseRadius = scaleR(row.size_cap);
        const radius = baseRadius;   // keep all bubbles at normal size in focus mode

        const circle = L.circleMarker([row.lat, row.lon], {
          radius,
          fillColor:   useGray ? GRAY : colorFor(row.tech_tag),
          // Grayed-out bubbles are softer; focused bubbles render at normal opacity.
          fillOpacity: useGray ? 0.35 : 0.78,
          color:       useGray ? "rgba(148,163,184,0.4)" : "rgba(255,255,255,0.9)",
          weight:      useGray ? 0.6 : 1.2,
        });

        const cementStr  = row.cement_capacity != null ? `${row.cement_capacity.toFixed(2)} Mtpa` : "—";
        const clinkerStr = row.clinker_capacity != null ? `${row.clinker_capacity.toFixed(2)} Mtpa` : "—";
        const yn = (v: boolean) => v ? "Yes" : "No";

        const popupHtml = `<div style="font-family:Arial,Helvetica,sans-serif;padding:12px 14px">
            <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:2px">${escapeHtml(row.plant_name || "Unknown plant")}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:10px;display:flex;align-items:center;gap:5px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colorFor(row.tech_tag)};flex-shrink:0"></span>
              ${labelFor(row.tech_tag)} · ${escapeHtml(row.country)}
            </div>
            <div style="border-top:0.5px solid #f1f5f9;padding-top:8px;display:flex;flex-direction:column;gap:5px">
              ${kvRow("Company",          escapeHtml(row.company))}
              ${kvRow("Cement Capacity",  cementStr)}
              ${kvRow("Clinker Capacity", clinkerStr)}
              ${kvRow("CCS / CCUS",       yn(row.ccus))}
              ${kvRow("Clay Calcination", yn(row.clay))}
              ${kvRow("Alternative Fuel", yn(row.alt_fuel))}
            </div>
          </div>`;

        circle.bindPopup(popupHtml, {
          className: "green-popup",
          closeButton: false,
          autoPan: true,
          autoPanPadding: [16, 16],
          keepInView: true,
          offset: [0, -radius - 2],
          maxWidth: 300,
        });

        circle.on("mouseover", function (this: L.CircleMarker) { this.openPopup(); });
        circle.on("mouseout",  function (this: L.CircleMarker) { this.closePopup(); });

        circle.addTo(lg);
      });

      // Auto-fit map to bubbles
      if (ordered.length > 0) {
        const bounds = L.latLngBounds(
          ordered.map(r => [r.lat, r.lon] as [number, number])
        );
        const map = mapRef.current as ReturnType<typeof L.map>;
        if (bounds.isValid()) {
          if (ordered.length === 1) {
            map.setView([ordered[0].lat, ordered[0].lon], 5, { animate: true, duration: 0.6 });
          } else {
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7, animate: true, duration: 0.6 });
          }
        }
      }

      // Legend (init once)
      const map = mapRef.current as ReturnType<typeof L.map>;
      if (!legendRef.current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const legend = (L.control as any)({ position: "topright" });
        legend.onAdd = function () {
          const div = L.DomUtil.create("div");
          div.innerHTML = `
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:180px">
              <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:8px">Technology Type</div>
              ${legendDot(COLOR_CCUS, "CCUS")}
              ${legendDot(COLOR_CLAY, "Clay Calcination")}
              ${legendDot(COLOR_ALT,  "Alternative Fuel")}
              <div style="font-size:11px;font-weight:700;color:#1e293b;margin:10px 0 6px">Cement capacity (Mtpa)</div>
              <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:4px">
                ${sizeLegendDot(6,  fmtCap(minCap))}
                ${sizeLegendDot(12, fmtCap((minCap + maxCap) / 2))}
                ${sizeLegendDot(22, fmtCap(maxCap))}
              </div>
            </div>`;
          return div;
        };
        legend.addTo(map);
        legendRef.current = legend;
      }
    })();
  }

  return (
    <div style={{
      position: "relative", borderRadius: 8, overflow: "hidden",
      zIndex: 0, isolation: "isolate", border: "1px solid #e9ecef",
    }}>
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />
      {!data?.length && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: "rgba(255,255,255,0.85)",
          color: "#94a3b8", fontSize: 13,
          fontFamily: "Arial, Helvetica, sans-serif",
          pointerEvents: "none",
        }}>
          No plants with green-tech adoption match the current filters
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function kvRow(k: string, v: string) {
  return `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px">
    <span style="font-size:11px;color:#64748b">${k}</span>
    <span style="font-size:11.5px;font-weight:600;color:#0f172a;text-align:right">${v}</span>
  </div>`;
}

function legendDot(color: string, label: string) {
  return `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">
    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};border:1px solid rgba(0,0,0,0.05)"></span>
    <span style="font-size:11px;color:#475569">${label}</span>
  </div>`;
}

function sizeLegendDot(diameter: number, label: string) {
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
    <div style="width:${diameter * 2}px;height:${diameter * 2}px;border-radius:50%;background:rgba(100,116,139,0.45);border:1.2px solid rgba(255,255,255,0.85)"></div>
    <span style="font-size:9.5px;color:#64748b">${label}</span>
  </div>`;
}

function fmtCap(v: number): string {
  if (!isFinite(v) || v <= 0) return "—";
  if (v < 1) return v.toFixed(2);
  if (v < 10) return v.toFixed(1);
  return Math.round(v).toString();
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}