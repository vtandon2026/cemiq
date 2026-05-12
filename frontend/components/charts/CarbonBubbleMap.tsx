// PATH: frontend/components/charts/CarbonBubbleMap.tsx
// Carbon Exposure Map — bubble size = clinker capacity, color = production type.
// Uses Popup (not Tooltip) for hover content because popups can render outside
// the map's clipping bounds, while tooltips get cut off by overflow:hidden.
"use client";
import { useEffect, useRef } from "react";
import type { CarbonMapPoint } from "@/lib/types";

interface Props {
  data:    CarbonMapPoint[];
  height?: number;
}

const COLOR_DRY   = "#2D7D46";   // Bain green
const COLOR_WET   = "#E11C2A";   // Bain red
const COLOR_MIXED = "#F0B400";   // Bain yellow

const colorFor = (t: string) => {
  if (t === "wet")   return COLOR_WET;
  if (t === "dry")   return COLOR_DRY;
  if (t === "mixed") return COLOR_MIXED;
  return "#94a3b8";
};

export default function CarbonBubbleMap({ data, height = 460 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const layerRef     = useRef<unknown>(null);
  const legendRef    = useRef<unknown>(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Init map (once)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Style overrides: rounded popup, no arrow, autoPan keeps it inside the map
      const styleId = "carbon-bubble-leaflet-style";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
.leaflet-popup-content-wrapper { background: #fff !important; border-radius: 10px !important; padding: 0 !important; box-shadow: 0 4px 14px rgba(0,0,0,0.12) !important; border: 0.5px solid #e2e8f0 !important; }
.leaflet-popup-content { margin: 0 !important; padding: 0 !important; min-width: 230px !important; }
.leaflet-popup-tip-container { display: none !important; }
.leaflet-popup-close-button { display: none !important; }
.carbon-popup .leaflet-popup-content-wrapper { padding: 0 !important; }
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

      // Pixel radius (circleMarker) → consistent size across all zooms
      const caps = data.map((d) => d.clinker_capacity).filter((v) => v > 0);
      const maxCap = caps.length ? Math.max(...caps) : 1;
      const minCap = caps.length ? Math.min(...caps) : 0;

      const scaleR = (cap: number) => {
        if (cap <= 0) return 4;
        if (maxCap === minCap) return 10;
        const t = Math.sqrt((cap - minCap) / (maxCap - minCap));
        return 4 + t * 18;
      };

      // Bigger first → smaller bubbles render on top (clickable)
      const ordered = [...data].sort((a, b) => b.clinker_capacity - a.clinker_capacity);

      ordered.forEach((row) => {
        const color  = colorFor(row.production_type);
        const radius = scaleR(row.clinker_capacity);

        const circle = L.circleMarker([row.lat, row.lon], {
          radius,
          fillColor:   color,
          fillOpacity: 0.7,
          color:       "rgba(255,255,255,0.85)",
          weight:      1.2,
        });

        const altFuelStr = row.alt_fuel === true ? "Yes" : row.alt_fuel === false ? "No" : "—";
        const ccsStr     = row.ccs      === true ? "Yes" : row.ccs      === false ? "No" : "—";
        const cementCapStr = row.cement_capacity != null ? `${row.cement_capacity.toFixed(2)} Mtpa` : "—";
        const prodLabel = row.production_type.charAt(0).toUpperCase() + row.production_type.slice(1);

        const popupHtml = `<div style="font-family:Arial,Helvetica,sans-serif;padding:12px 14px">
            <div style="font-size:13px;font-weight:600;color:#0f172a;margin-bottom:2px">${escapeHtml(row.plant_name || "Unknown plant")}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:10px;display:flex;align-items:center;gap:5px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0"></span>
              ${prodLabel} · ${escapeHtml(row.country)}
            </div>
            <div style="border-top:0.5px solid #f1f5f9;padding-top:8px;display:flex;flex-direction:column;gap:5px">
              ${kvRow("Company",          escapeHtml(row.company))}
              ${kvRow("Cement Capacity",  cementCapStr)}
              ${kvRow("Clinker Capacity", `${row.clinker_capacity.toFixed(2)} Mtpa`)}
              ${kvRow("Plant Type",       escapeHtml(row.plant_type || "—"))}
              ${kvRow("Alternative Fuel", altFuelStr)}
              ${kvRow("CCS / CCUS",       ccsStr)}
            </div>
          </div>`;

        // Use POPUP (not tooltip) — popups auto-pan to fit inside the map bounds
        circle.bindPopup(popupHtml, {
          className: "carbon-popup",
          closeButton: false,
          autoPan: true,
          autoPanPadding: [16, 16],
          keepInView: true,
          offset: [0, -radius - 2],
          maxWidth: 280,
        });

        // Hover-to-open + leave-to-close (popup acts like tooltip)
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
            <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:170px">
              <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:8px">Production Type</div>
              ${legendDot(COLOR_DRY,   "Dry")}
              ${legendDot(COLOR_MIXED, "Mixed")}
              ${legendDot(COLOR_WET,   "Wet")}
              <div style="font-size:11px;font-weight:700;color:#1e293b;margin:10px 0 6px">Clinker capacity (Mtpa)</div>
              <div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:4px">
                ${sizeLegendDot(5,  fmtCap(minCap))}
                ${sizeLegendDot(11, fmtCap((minCap + maxCap) / 2))}
                ${sizeLegendDot(20, fmtCap(maxCap))}
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
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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