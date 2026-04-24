// PATH: frontend/components/charts/GeoMap.tsx
"use client";
import { useEffect, useRef } from "react";
import type { PlantRow } from "@/lib/types";

interface Props {
  plants: PlantRow[];
  companyColors: Record<string, string>;
  compareSelected: string[];
  height?: number;
}

function scaleRadius(cap: number, capMin: number, capMax: number): number {
  if (capMax === capMin) return 40000;
  return 20000 + ((cap - capMin) / (capMax - capMin)) * 100000;
}

export default function GeoMap({ plants, companyColors, compareSelected, height = 560 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const layerGroupRef = useRef<unknown>(null);
  const legendRef    = useRef<unknown>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [39.5, -98.35],
        zoom: 4,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
        {
          attribution: '',
          crossOrigin: true,
          subdomains: "abcd",
          maxZoom: 19,
        }
      ).addTo(map);

      mapRef.current      = map;
      layerGroupRef.current = L.layerGroup().addTo(map);
    })();

    return () => { cancelled = true; };
  }, []);

  // Redraw circles + legend whenever data changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) {
      const t = setTimeout(() => {
        if (!mapRef.current || !layerGroupRef.current || !plants.length) return;
        drawPlants();
      }, 500);
      return () => clearTimeout(t);
    }
    drawPlants();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plants, companyColors, compareSelected]);

  function drawPlants() {
    if (!layerGroupRef.current || !mapRef.current) return;

    (async () => {
      const L   = (await import("leaflet")).default;
      const lg  = layerGroupRef.current as ReturnType<typeof L.layerGroup>;
      const map = mapRef.current as ReturnType<typeof L.map>;
      lg.clearLayers();

      // Remove old legend
      if (legendRef.current) {
        (legendRef.current as { remove: () => void }).remove();
        legendRef.current = null;
      }

      if (!plants.length) return;

      const capMin = Math.min(...plants.map((p) => p.cement_capacity_mta));
      const capMax = Math.max(...plants.map((p) => p.cement_capacity_mta));

      plants.forEach((plant) => {
        const isHighlighted = compareSelected.length === 0 || compareSelected.includes(plant.company);
        const hexColor      = companyColors[plant.company] ?? "#888888";
        const color         = isHighlighted ? hexColor : "#C8C8C8";
        const fillOpacity   = isHighlighted ? 0.82 : 0.25;
        const radiusMeters  = scaleRadius(plant.cement_capacity_mta, capMin, capMax);

        const circle = L.circle([plant.lat, plant.lon], {
          radius:      radiusMeters,
          color:       isHighlighted ? "rgba(255,255,255,0.7)" : "rgba(200,200,200,0.4)",
          weight:      1,
          fillColor:   color,
          fillOpacity,
        });

        circle.bindTooltip(
          `<div style="font-family:Arial,Helvetica,sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:12px;color:#0f172a;margin-bottom:4px">${plant.company}</div>
            <div style="font-size:11px;color:#475569;margin-bottom:2px">${plant.plant}</div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:11px">
              <span style="color:#64748b">Capacity</span>
              <span style="font-weight:600;color:#1e293b">${plant.cement_capacity_mta} Mta</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px;font-size:11px">
              <span style="color:#64748b">Location</span>
              <span style="font-weight:600;color:#1e293b">${plant.city}, ${plant.state}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:2px;font-size:11px">
              <span style="color:#64748b">Type</span>
              <span style="font-weight:600;color:#1e293b">${plant.cement_type ?? "—"}</span>
            </div>
          </div>`,
          {
            sticky: true,
            opacity: 1,
            className: "cemiq-tooltip",
          }
        );

        // Highlight on hover
        circle.on("mouseover", () => {
          circle.setStyle({ weight: 2, color: "#ffffff", fillOpacity: 1 });
          circle.bringToFront();
        });
        circle.on("mouseout", () => {
          circle.setStyle({ weight: 1, color: isHighlighted ? "rgba(255,255,255,0.7)" : "rgba(200,200,200,0.4)", fillOpacity });
        });

        lg.addLayer(circle);
      });

      // Fit bounds
      const bounds = L.latLngBounds(plants.map((p) => [p.lat, p.lon] as [number, number]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 6 });
      }

      // Build legend — unique companies in current plants
      const companiesInView = [...new Set(plants.map((p) => p.company))].sort();
      if (companiesInView.length > 0) {
        const legend = new (L.Control.extend({
          options: { position: "bottomright" },
          onAdd() {
            const div = L.DomUtil.create("div");
            div.style.cssText = `
              background: rgba(255,255,255,0.96);
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 10px 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.10);
              font-family: Arial, Helvetica, sans-serif;
              font-size: 11px;
              max-height: 200px;
              overflow-y: auto;
              min-width: 160px;
            `;
            // Prevent map zoom when scrolling inside legend
            L.DomEvent.disableScrollPropagation(div);
            L.DomEvent.disableClickPropagation(div);
            const title = document.createElement("div");
            title.style.cssText = "font-weight:700;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:7px;";
            title.textContent = "Companies";
            div.appendChild(title);

            companiesInView.forEach((company) => {
              const row = document.createElement("div");
              row.style.cssText = "display:flex;align-items:center;gap:7px;margin-bottom:4px;";
              const dot = document.createElement("span");
              dot.style.cssText = `width:10px;height:10px;border-radius:50%;background:${companyColors[company] ?? "#888"};flex-shrink:0;display:inline-block;`;
              const label = document.createElement("span");
              label.style.cssText = "color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;";
              label.textContent = company;
              row.appendChild(dot);
              row.appendChild(label);
              div.appendChild(row);
            });
            return div;
          },
        }))();
        legend.addTo(map);
        legendRef.current = legend;
      }
    })();
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <style>{`
        .leaflet-pane,
        .leaflet-top,
        .leaflet-bottom { z-index: 1 !important; }
        .leaflet-control { z-index: 2 !important; }
        .cemiq-tooltip {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 8px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.12) !important;
          padding: 10px 12px !important;
        }
        .cemiq-tooltip::before { display: none !important; }
        .leaflet-tooltip.cemiq-tooltip { white-space: normal !important; }
      `}</style>
      <div style={{ position: "relative", zIndex: 0, isolation: "isolate" }}>
        <div
          ref={containerRef}
          style={{ height, width: "100%", borderRadius: 8, overflow: "hidden" }}
        />
      </div>
    </>
  );
}
