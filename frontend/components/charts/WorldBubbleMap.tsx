// PATH: frontend/components/charts/WorldBubbleMap.tsx
// View 1 — Bubble map: size = market value, color = weighted avg CAGR
"use client";
import { useEffect, useRef } from "react";

interface BubbleRow {
  country: string;
  region: string;
  value: number;
  yoy_growth: number | null;
  rank: number;
}

interface Props {
  data: BubbleRow[];
  year: number;
  height?: number;
  cagrStart?: number;  // start year for CAGR label, default "Forecast"
  cagrEnd?: number;
}

// Country name → [lat, lon] centroid — comprehensive list
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "Afghanistan": [33.93, 67.71], "Albania": [41.15, 20.17], "Algeria": [28.03, 1.66],
  "Angola": [-11.20, 17.87], "Argentina": [-38.42, -63.62], "Armenia": [40.07, 45.04],
  "Australia": [-25.27, 133.78], "Austria": [47.52, 14.55], "Azerbaijan": [40.14, 47.58],
  "Bahrain": [26.00, 50.55], "Bangladesh": [23.68, 90.36], "Belarus": [53.71, 27.95],
  "Belgium": [50.50, 4.47], "Benin": [9.31, 2.32], "Bolivia": [-16.29, -63.59],
  "Bosnia and Herzegovina": [43.92, 17.68], "Botswana": [-22.33, 24.68],
  "Brazil": [-14.24, -51.93], "Bulgaria": [42.73, 25.49], "Burkina Faso": [12.36, -1.53],
  "Cambodia": [12.57, 104.99], "Cameroon": [3.85, 11.50], "Canada": [56.13, -106.35],
  "Chile": [-35.68, -71.54], "China": [35.86, 104.20], "Colombia": [4.57, -74.30],
  "Congo": [-0.23, 15.83], "Costa Rica": [9.75, -83.75], "Côte d'Ivoire": [7.54, -5.55],
  "Ivory Coast": [7.54, -5.55], "Croatia": [45.10, 15.20], "Czech Republic": [49.82, 15.47],
  "Czechia": [49.82, 15.47], "Denmark": [56.26, 9.50], "Dominican Republic": [18.74, -70.16],
  "DR Congo": [-4.04, 21.76], "Ecuador": [-1.83, -78.18], "Egypt": [26.82, 30.80],
  "El Salvador": [13.79, -88.90], "Estonia": [58.60, 25.01], "Ethiopia": [9.15, 40.49],
  "Finland": [61.92, 25.75], "France": [46.23, 2.21], "Gabon": [-0.80, 11.61],
  "Georgia": [42.32, 43.36], "Germany": [51.17, 10.45], "Ghana": [7.95, -1.02],
  "Greece": [39.07, 21.82], "Guatemala": [15.78, -90.23], "Honduras": [15.20, -86.24],
  "Hong Kong": [22.30, 114.18], "Hungary": [47.16, 19.50], "India": [20.59, 78.96],
  "Indonesia": [-0.79, 113.92], "Iran": [32.43, 53.69], "Iraq": [33.22, 43.68],
  "Ireland": [53.41, -8.24], "Israel": [31.05, 34.85], "Italy": [41.87, 12.57],
  "Japan": [36.20, 138.25], "Jordan": [30.59, 36.24], "Kazakhstan": [48.02, 66.92],
  "Kenya": [-0.02, 37.91], "Korea": [35.91, 127.77], "South Korea": [35.91, 127.77],
  "Kuwait": [29.31, 47.48], "Latvia": [56.88, 24.60], "Lebanon": [33.85, 35.86],
  "Libya": [26.34, 17.23], "Lithuania": [55.17, 23.88], "Luxembourg": [49.82, 6.13],
  "Malaysia": [4.21, 108.0], "Mexico": [23.63, -102.55], "Moldova": [47.41, 28.37],
  "Mongolia": [46.86, 103.85], "Morocco": [31.79, -7.09], "Mozambique": [-18.67, 35.53],
  "Myanmar": [21.92, 95.96], "Namibia": [-22.96, 18.49], "Nepal": [28.39, 84.12],
  "Netherlands": [52.13, 5.29], "New Zealand": [-40.90, 174.89], "Nicaragua": [12.87, -85.21],
  "Nigeria": [9.08, 8.68], "North Macedonia": [41.61, 21.75], "Norway": [60.47, 8.47],
  "Oman": [21.51, 55.92], "Pakistan": [30.38, 69.35], "Panama": [8.54, -80.78],
  "Paraguay": [-23.44, -58.44], "Peru": [-9.19, -75.02], "Philippines": [12.88, 121.77],
  "Poland": [51.92, 19.15], "Portugal": [39.40, -8.22], "Qatar": [25.35, 51.18],
  "Romania": [45.94, 24.97], "Russia": [61.52, 105.32], "Rwanda": [-1.94, 29.87],
  "Saudi Arabia": [23.89, 45.08], "Senegal": [14.50, -14.45], "Serbia": [44.02, 21.01],
  "Singapore": [1.35, 103.82], "Slovakia": [48.67, 19.70], "Slovenia": [46.15, 14.99],
  "South Africa": [-30.56, 22.94], "Spain": [40.46, -3.75], "Sri Lanka": [7.87, 80.77],
  "Sudan": [12.86, 30.22], "Sweden": [60.13, 18.64], "Switzerland": [46.82, 8.23],
  "Syria": [34.80, 38.99], "Taiwan": [23.70, 121.0], "Tanzania": [-6.37, 34.89],
  "Thailand": [15.87, 100.99], "Tunisia": [33.89, 9.54], "Turkey": [38.96, 35.24],
  "Turkmenistan": [38.97, 59.56], "Uganda": [1.37, 32.29], "Ukraine": [48.38, 31.17],
  "United Arab Emirates": [23.42, 53.85], "United Kingdom": [55.38, -3.44],
  "United States": [37.09, -95.71], "United States of America": [37.09, -95.71],
  "Uruguay": [-32.52, -55.77], "Uzbekistan": [41.38, 64.59], "Venezuela": [6.42, -66.59],
  "Vietnam": [14.06, 108.28], "Yemen": [15.55, 48.52], "Zambia": [-13.13, 27.85],
  "Zimbabwe": [-19.02, 29.15],
  // Additional entries
  "Macau (SAR)": [22.20, 113.55],
  "Papua New Guinea": [-6.31, 143.96],
  "Tajikistan": [38.86, 71.28],
  "Kyrgyzstan": [41.20, 74.77],
  "North Korea": [40.34, 127.51],
};

// CAGR → color (red=low/negative, yellow=mid, green=high)
function cagrToColor(cagr: number | null): string {
  if (cagr == null) return "#94a3b8";
  // Scale: <0 = red, 0–5% = yellow-green, >5% = deep green
  if (cagr < 0) return `#dc2626`;
  if (cagr < 0.02) return `#f97316`;
  if (cagr < 0.04) return `#eab308`;
  if (cagr < 0.06) return `#84cc16`;
  if (cagr < 0.10) return `#22c55e`;
  return `#15803d`;
}

function cagrToColorScale(cagr: number | null, minCagr: number, maxCagr: number): string {
  if (cagr == null) return "#94a3b8";
  const t = maxCagr === minCagr ? 0.5 : (cagr - minCagr) / (maxCagr - minCagr);
  // Red → Orange → Yellow → Light green → Dark green
  const stops = [
    [220, 38, 38],  // red
    [249, 115, 22],  // orange
    [234, 179, 8],  // yellow
    [132, 204, 22],  // lime
    [21, 128, 61],  // dark green
  ];
  const i = Math.min(Math.floor(t * (stops.length - 1)), stops.length - 2);
  const f = t * (stops.length - 1) - i;
  const r = Math.round(stops[i][0] + f * (stops[i + 1][0] - stops[i][0]));
  const g = Math.round(stops[i][1] + f * (stops[i + 1][1] - stops[i][1]));
  const b = Math.round(stops[i][2] + f * (stops[i + 1][2] - stops[i][2]));
  return `rgb(${r},${g},${b})`;
}

export default function WorldBubbleMap({ data, year, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const layerRef = useRef<unknown>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [20, 10], zoom: 2,
        zoomControl: true,
        attributionControl: false,
        minZoom: 1, maxZoom: 8,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© Mapbox © OpenStreetMap",
        subdomains: "abcd", maxZoom: 19,
      }).addTo(map);

      // Country labels layer
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19, pane: "shadowPane",
      }).addTo(map);

      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();
    return () => { cancelled = true; };
  }, []);

  // Draw bubbles
  useEffect(() => {
    if (!data.length) return;
    const timer = setTimeout(() => drawBubbles(), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, year]);

  function drawBubbles() {
    if (!mapRef.current || !layerRef.current || !mountedRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const lg = layerRef.current as ReturnType<typeof L.layerGroup>;
      lg.clearLayers();

      if (!data.length) return;

      const values = data.map((d) => d.value).filter((v) => v > 0);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      const cagrs = data.map((d) => d.yoy_growth).filter((v) => v != null) as number[];
      const minCagr = cagrs.length ? Math.min(...cagrs) : 0;
      const maxCagr = cagrs.length ? Math.max(...cagrs) : 0.1;

      // Scale bubble radius: 60k–800k meters
      const scaleR = (v: number) => {
        if (maxVal === minVal) return 300000;
        return 100000 + ((v - minVal) / (maxVal - minVal)) * 900000;
      };

      data.forEach((row) => {
        const coords = COUNTRY_COORDS[row.country];
        if (!coords) return;

        const color = cagrToColorScale(row.yoy_growth, minCagr, maxCagr);
        const radius = scaleR(row.value);

        const circle = L.circle(coords, {
          radius,
          fillColor: color,
          fillOpacity: 0.75,
          color: "rgba(255,255,255,0.6)",
          weight: 1,
        });

        circle.bindTooltip(
          `<div style="font-family:Arial,Helvetica,sans-serif;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:4px">${row.country}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:6px">${row.region}</div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:3px">
              <span style="color:#64748b">Market Value</span>
              <span style="font-weight:600">$${row.value.toFixed(1)}B</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px">
              <span style="color:#64748b">Wtd Avg CAGR</span>
              <span style="font-weight:700;color:${color}">${row.yoy_growth != null ? (row.yoy_growth * 100).toFixed(1) + "%" : "N/A"}</span>
            </div>
            <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-top:3px">
              <span style="color:#64748b">Rank</span>
              <span style="font-weight:600">#${row.rank}</span>
            </div>
          </div>`,
          { sticky: false, direction: "top", offset: [0, -8] }
        );

        circle.addTo(lg as ReturnType<typeof L.layerGroup>);

        // Add country label for larger bubbles
        if (radius > 300000) {
          L.marker(coords, {
            icon: L.divIcon({
              className: "",
              html: `<div style="font-family:Arial,sans-serif;font-size:10px;font-weight:600;color:#1e293b;white-space:nowrap;text-shadow:0 0 3px #fff,0 0 3px #fff">${row.country}</div>`,
              iconAnchor: [40, -radius / 80000],
            }),
          }).addTo(lg as ReturnType<typeof L.layerGroup>);
        }
      });

      // Legend
      const map = mapRef.current as ReturnType<typeof L.map>;
      const legend = (L.control as any)({ position: "topright" });
      legend.onAdd = function () {
        const div = L.DomUtil.create("div");
        div.innerHTML = `
          <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:160px">
            <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:6px">Weighted Average<br>CAGR ${year}–${year + 4}</div>
            <div style="height:10px;width:130px;background:linear-gradient(to right,#dc2626,#f97316,#eab308,#84cc16,#15803d);border-radius:4px;margin-bottom:4px"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:12px">
              <span>${(minCagr * 100).toFixed(1)}%</span>
              <span>${(maxCagr * 100).toFixed(1)}%</span>
            </div>
            <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:6px">Current market value<br>(in $B)</div>
            ${[1, Math.round(maxVal * 0.25), Math.round(maxVal * 0.5), Math.round(maxVal * 0.75), Math.round(maxVal)].map((v, i) => `
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
                <div style="width:${6 + i * 6}px;height:${6 + i * 6}px;border-radius:50%;background:#94a3b8;border:1px solid #e2e8f0;flex-shrink:0"></div>
                <span style="font-size:10px;color:#64748b">${v.toLocaleString()}</span>
              </div>`).join("")}
          </div>`;
        return div;
      };
      legend.addTo(map);
    })();
  }

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", zIndex: 0, isolation: "isolate" }}>
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />
    </div>
  );
}