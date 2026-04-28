// PATH: frontend/components/charts/WorldChoroplethMap.tsx
"use client";
import { useEffect, useRef } from "react";

interface ChoroplethRow {
  country:    string;
  region:     string;
  value:      number;
  yoy_growth: number | null;
}

interface Props {
  data:    ChoroplethRow[];
  metric:  string;
  year:    number;
  height?: number;
}

// Comprehensive alias map: GeoJSON name → our data name
const GEOJSON_TO_DATA: Record<string, string> = {
  "United States of America":      "United States",
  "USA":                           "United States",
  "Russian Federation":            "Russia",
  "Korea, Republic of":            "South Korea",
  "Republic of Korea":             "South Korea",
  "Iran (Islamic Republic of)":    "Iran",
  "Czechia":                       "Czech Republic",
  "Czech Rep.":                    "Czech Republic",
  "Taiwan, Province of China":     "Taiwan",
  "Bosnia and Herz.":              "Bosnia and Herzegovina",
  "Dominican Rep.":                "Dominican Republic",
  "UAE":                           "United Arab Emirates",
  "U.A.E.":                        "United Arab Emirates",
  "UK":                            "United Kingdom",
  "Britain":                       "United Kingdom",
  "Congo":                         "Republic of Congo",
  "Dem. Rep. Congo":               "Democratic Republic of Congo",
  "S. Sudan":                      "South Sudan",
  "Central African Rep.":          "Central African Republic",
  "Eq. Guinea":                    "Equatorial Guinea",
  "W. Sahara":                     "Western Sahara",
  "Solomon Is.":                   "Solomon Islands",
  "Lao PDR":                       "Laos",
  "Viet Nam":                      "Vietnam",
  "Syrian Arab Republic":          "Syria",
  "Palestine":                     "Palestinian Territory",
  "Brunei Darussalam":             "Brunei",
  "North Macedonia":               "Macedonia",
  "Republic of Serbia":            "Serbia",
  "Côte d'Ivoire":                 "Ivory Coast",
  "eSwatini":                      "Swaziland",
};

function resolveCountryName(geoName: string, lookup: Map<string, ChoroplethRow>): ChoroplethRow | undefined {
  // 1. Direct match
  let row = lookup.get(geoName.toLowerCase());
  if (row) return row;
  // 2. Alias match
  const aliased = GEOJSON_TO_DATA[geoName];
  if (aliased) {
    row = lookup.get(aliased.toLowerCase());
    if (row) return row;
  }
  // 3. Partial match — data country starts with GeoJSON name
  for (const [key, val] of lookup) {
    if (key.includes(geoName.toLowerCase()) || geoName.toLowerCase().includes(key)) {
      return val;
    }
  }
  return undefined;
}

function buildLookup(data: ChoroplethRow[]): Map<string, ChoroplethRow> {
  const map = new Map<string, ChoroplethRow>();
  data.forEach((row) => map.set(row.country.toLowerCase(), row));
  return map;
}

function interpolateColor(t: number): string {
  const stops = [
    [190,  75,  50],  // dark orange-red
    [210, 110,  60],  // orange
    [225, 150,  80],  // light orange
    [235, 185, 100],  // yellow-orange
    [220, 210, 120],  // yellow
    [170, 200, 100],  // yellow-green
    [100, 170,  90],  // medium green
    [ 50, 130,  80],  // green
    [ 20,  90,  70],  // dark teal-green
  ];
  const clampedT = Math.max(0, Math.min(1, t));
  const i = Math.min(Math.floor(clampedT * (stops.length - 1)), stops.length - 2);
  const f = clampedT * (stops.length - 1) - i;
  const r = Math.round(stops[i][0] + f * (stops[i + 1][0] - stops[i][0]));
  const g = Math.round(stops[i][1] + f * (stops[i + 1][1] - stops[i][1]));
  const b = Math.round(stops[i][2] + f * (stops[i + 1][2] - stops[i][2]));
  return `rgb(${r},${g},${b})`;
}

// Cache GeoJSON so we only fetch once
let geojsonCache: unknown = null;

export default function WorldChoroplethMap({ data, metric, year, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<unknown>(null);
  const geoLayerRef  = useRef<unknown>(null);
  const legendRef    = useRef<unknown>(null);
  const mountedRef   = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
        worldCopyJump: false,
      });

      // Clean white basemap — no labels, just ocean color
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
        attribution: "© Mapbox © OpenStreetMap",
        subdomains: "abcd", maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!data.length) return;
    const timer = setTimeout(() => drawChoropleth(), 400);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, year]);

  async function drawChoropleth() {
    if (!mapRef.current || !mountedRef.current) return;
    const L = (await import("leaflet")).default;
    const map = mapRef.current as ReturnType<typeof L.map>;

    // Remove old layers
    if (geoLayerRef.current) {
      map.removeLayer(geoLayerRef.current as ReturnType<typeof L.geoJSON>);
      geoLayerRef.current = null;
    }
    if (legendRef.current) {
      (legendRef.current as { remove: () => void }).remove();
      legendRef.current = null;
    }

    // Fetch + cache GeoJSON
    if (!geojsonCache) {
      const res = await fetch(
        "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
      );
      if (!res.ok || !mountedRef.current) return;
      geojsonCache = await res.json();
    }
    if (!mountedRef.current) return;

    const lookup = buildLookup(data);

    const vals = data
      .map((d) => metric === "yoy_growth" ? d.yoy_growth : d.value)
      .filter((v): v is number => v != null);
    const minVal = vals.length ? Math.min(...vals) : 0;
    const maxVal = vals.length ? Math.max(...vals) : 1;

    // Debug: log unmatched countries
    const matched = new Set<string>();

    const geoLayer = L.geoJSON(geojsonCache as Parameters<typeof L.geoJSON>[0], {
      style: (feature) => {
        if (!feature) return { fillColor: "#dde1e7", fillOpacity: 0.5, color: "#ffffff", weight: 0.5 };
        const props = feature.properties as Record<string, string>;
        // Try multiple name fields in the GeoJSON
        const nameCandidates = [
          props.NAME, props.ADMIN, props.NAME_LONG,
          props.FORMAL_EN, props.NAME_EN, props.SOVEREIGNT,
        ].filter(Boolean);

        let row: ChoroplethRow | undefined;
        for (const name of nameCandidates) {
          row = resolveCountryName(name, lookup);
          if (row) { matched.add(row.country); break; }
        }

        if (!row) {
          return { fillColor: "#dde1e7", fillOpacity: 0.55, color: "#ffffff", weight: 0.5 };
        }

        const rawVal = metric === "yoy_growth" ? row.yoy_growth : row.value;
        const t = (rawVal != null && maxVal !== minVal)
          ? (rawVal - minVal) / (maxVal - minVal) : 0.5;

        return {
          fillColor:   interpolateColor(t),
          fillOpacity: 0.85,
          color:       "#ffffff",
          weight:      0.7,
        };
      },

      onEachFeature: (feature, layer) => {
        if (!feature) return;
        const props = feature.properties as Record<string, string>;
        const nameCandidates = [props.NAME, props.ADMIN, props.NAME_LONG].filter(Boolean);
        let row: ChoroplethRow | undefined;
        for (const name of nameCandidates) {
          row = resolveCountryName(name, lookup);
          if (row) break;
        }

        if (row) {
          const dispVal = metric === "yoy_growth"
            ? (row.yoy_growth != null ? `${(row.yoy_growth * 100).toFixed(1)}%` : "N/A")
            : `$${row.value.toFixed(1)}B`;
          const label = metric === "yoy_growth" ? "YoY Growth" : "Market Value";

          (layer as ReturnType<typeof L.geoJSON>).bindTooltip(
            `<div style="font-family:Arial,Helvetica,sans-serif;min-width:170px">
              <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px">${row.country}</div>
              <div style="font-size:11px;color:#64748b;margin-bottom:6px">${row.region}</div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:3px">
                <span style="color:#64748b">${label}</span>
                <span style="font-weight:700">${dispVal}</span>
              </div>
              <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px">
                <span style="color:#64748b">Market Value</span>
                <span style="font-weight:600">$${row.value.toFixed(1)}B</span>
              </div>
            </div>`,
            { sticky: true }
          );
        }
      },
    });

    geoLayer.addTo(map);
    geoLayerRef.current = geoLayer;

    // Legend
    const LControl = L.Control.extend({
      onAdd: function() {
        const div  = L.DomUtil.create("div");
        const lbl  = metric === "yoy_growth" ? `YoY Growth ${year}` : `Market Value ${year}`;
        const fmtMin = metric === "yoy_growth" ? `${(minVal*100).toFixed(1)}%` : `$${minVal.toFixed(0)}B`;
        const fmtMax = metric === "yoy_growth" ? `${(maxVal*100).toFixed(1)}%` : `$${maxVal.toFixed(0)}B`;
        div.innerHTML = `
          <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:150px">
            <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:6px">${lbl}</div>
            <div style="height:10px;width:130px;background:linear-gradient(to right,rgb(190,75,50),rgb(225,150,80),rgb(235,185,100),rgb(220,210,120),rgb(100,170,90),rgb(20,90,70));border-radius:4px;margin-bottom:4px"></div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:6px">
              <span>${fmtMin}</span><span>${fmtMax}</span>
            </div>
            <div style="font-size:10px;color:#94a3b8">Grey = no data</div>
          </div>`;
        return div;
      },
    });
    const legend = new LControl({ position: "topright" });
    legend.addTo(map);
    legendRef.current = legend;
  }

  return (
    <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", zIndex: 0, isolation: "isolate" }}>
      <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />
    </div>
  );
}







// // PATH: frontend/components/charts/WorldChoroplethMap.tsx
// "use client";
// import { useEffect, useRef } from "react";

// interface ChoroplethRow {
//   country:    string;
//   region:     string;
//   value:      number;
//   yoy_growth: number | null;
// }

// interface Props {
//   data:    ChoroplethRow[];
//   metric:  string;
//   year:    number;
//   height?: number;
// }

// // Comprehensive alias map: GeoJSON name → our data name
// const GEOJSON_TO_DATA: Record<string, string> = {
//   "United States of America":      "United States",
//   "USA":                           "United States",
//   "Russian Federation":            "Russia",
//   "Korea, Republic of":            "South Korea",
//   "Republic of Korea":             "South Korea",
//   "Iran (Islamic Republic of)":    "Iran",
//   "Czechia":                       "Czech Republic",
//   "Czech Rep.":                    "Czech Republic",
//   "Taiwan, Province of China":     "Taiwan",
//   "Bosnia and Herz.":              "Bosnia and Herzegovina",
//   "Dominican Rep.":                "Dominican Republic",
//   "UAE":                           "United Arab Emirates",
//   "U.A.E.":                        "United Arab Emirates",
//   "UK":                            "United Kingdom",
//   "Britain":                       "United Kingdom",
//   "Congo":                         "Republic of Congo",
//   "Dem. Rep. Congo":               "Democratic Republic of Congo",
//   "S. Sudan":                      "South Sudan",
//   "Central African Rep.":          "Central African Republic",
//   "Eq. Guinea":                    "Equatorial Guinea",
//   "W. Sahara":                     "Western Sahara",
//   "Solomon Is.":                   "Solomon Islands",
//   "Lao PDR":                       "Laos",
//   "Viet Nam":                      "Vietnam",
//   "Syrian Arab Republic":          "Syria",
//   "Palestine":                     "Palestinian Territory",
//   "Brunei Darussalam":             "Brunei",
//   "North Macedonia":               "Macedonia",
//   "Republic of Serbia":            "Serbia",
//   "Côte d'Ivoire":                 "Ivory Coast",
//   "eSwatini":                      "Swaziland",
// };

// function resolveCountryName(geoName: string, lookup: Map<string, ChoroplethRow>): ChoroplethRow | undefined {
//   // 1. Direct match
//   let row = lookup.get(geoName.toLowerCase());
//   if (row) return row;
//   // 2. Alias match
//   const aliased = GEOJSON_TO_DATA[geoName];
//   if (aliased) {
//     row = lookup.get(aliased.toLowerCase());
//     if (row) return row;
//   }
//   // 3. Partial match — data country starts with GeoJSON name
//   for (const [key, val] of lookup) {
//     if (key.includes(geoName.toLowerCase()) || geoName.toLowerCase().includes(key)) {
//       return val;
//     }
//   }
//   return undefined;
// }

// function buildLookup(data: ChoroplethRow[]): Map<string, ChoroplethRow> {
//   const map = new Map<string, ChoroplethRow>();
//   data.forEach((row) => map.set(row.country.toLowerCase(), row));
//   return map;
// }

// // Region → color mapping matching Tableau screenshot
// const REGION_COLORS: Record<string, string> = {
//   "north america":          "#b04a32",  // terracotta / dark brownish-red
//   "europe":                 "#e8a05a",  // warm orange
//   "asia pacific":           "#c8d460",  // yellow-green / lime
//   "russia":                 "#e8c35a",  // golden yellow / amber
//   "eastern europe":         "#e8c35a",  // golden yellow
//   "middle east":            "#2a9d8f",  // teal
//   "middle east and africa": "#2a9d8f",  // teal
//   "africa":                 "#2a9d8f",  // teal
//   "south and central america": "#4a9a5a", // medium green
//   "latin america":          "#4a9a5a",  // medium green
//   "south america":          "#4a9a5a",  // medium green
//   "central america":        "#4a9a5a",  // medium green
//   "oceania":                "#c8d460",  // yellow-green (same as APAC)
// };

// function regionToColor(region: string): string {
//   const key = region.toLowerCase().trim();
//   // Direct match
//   if (REGION_COLORS[key]) return REGION_COLORS[key];
//   // Partial match
//   for (const [k, v] of Object.entries(REGION_COLORS)) {
//     if (key.includes(k) || k.includes(key)) return v;
//   }
//   return "#94a3b8"; // fallback grey
// }

// // Cache GeoJSON so we only fetch once
// let geojsonCache: unknown = null;

// export default function WorldChoroplethMap({ data, metric, year, height = 520 }: Props) {
//   const containerRef = useRef<HTMLDivElement>(null);
//   const mapRef       = useRef<unknown>(null);
//   const geoLayerRef  = useRef<unknown>(null);
//   const legendRef    = useRef<unknown>(null);
//   const mountedRef   = useRef(true);

//   useEffect(() => {
//     mountedRef.current = true;
//     return () => { mountedRef.current = false; };
//   }, []);

//   useEffect(() => {
//     if (!containerRef.current || mapRef.current) return;
//     let cancelled = false;
//     (async () => {
//       const L = (await import("leaflet")).default;
//       await import("leaflet/dist/leaflet.css");
//       if (cancelled || !containerRef.current) return;

//       const map = L.map(containerRef.current, {
//         center: [20, 10], zoom: 2,
//         zoomControl: true,
//         attributionControl: false,
//         minZoom: 1, maxZoom: 8,
//         worldCopyJump: false,
//       });

//       // Clean white basemap — no labels, just ocean color
//       L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
//         attribution: "© Mapbox © OpenStreetMap",
//         subdomains: "abcd", maxZoom: 19,
//       }).addTo(map);

//       mapRef.current = map;
//     })();
//     return () => { cancelled = true; };
//   }, []);

//   useEffect(() => {
//     if (!data.length) return;
//     const timer = setTimeout(() => drawChoropleth(), 400);
//     return () => clearTimeout(timer);
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [data, metric, year]);

//   async function drawChoropleth() {
//     if (!mapRef.current || !mountedRef.current) return;
//     const L = (await import("leaflet")).default;
//     const map = mapRef.current as ReturnType<typeof L.map>;

//     // Remove old layers
//     if (geoLayerRef.current) {
//       map.removeLayer(geoLayerRef.current as ReturnType<typeof L.geoJSON>);
//       geoLayerRef.current = null;
//     }
//     if (legendRef.current) {
//       (legendRef.current as { remove: () => void }).remove();
//       legendRef.current = null;
//     }

//     // Fetch + cache GeoJSON
//     if (!geojsonCache) {
//       const res = await fetch(
//         "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson"
//       );
//       if (!res.ok || !mountedRef.current) return;
//       geojsonCache = await res.json();
//     }
//     if (!mountedRef.current) return;

//     const lookup = buildLookup(data);

//     const vals = data
//       .map((d) => metric === "yoy_growth" ? d.yoy_growth : d.value)
//       .filter((v): v is number => v != null);
//     const minVal = vals.length ? Math.min(...vals) : 0;
//     const maxVal = vals.length ? Math.max(...vals) : 1;

//     // Debug: log unmatched countries
//     const matched = new Set<string>();

//     const geoLayer = L.geoJSON(geojsonCache as Parameters<typeof L.geoJSON>[0], {
//       style: (feature) => {
//         if (!feature) return { fillColor: "#dde1e7", fillOpacity: 0.5, color: "#ffffff", weight: 0.5 };
//         const props = feature.properties as Record<string, string>;
//         // Try multiple name fields in the GeoJSON
//         const nameCandidates = [
//           props.NAME, props.ADMIN, props.NAME_LONG,
//           props.FORMAL_EN, props.NAME_EN, props.SOVEREIGNT,
//         ].filter(Boolean);

//         let row: ChoroplethRow | undefined;
//         for (const name of nameCandidates) {
//           row = resolveCountryName(name, lookup);
//           if (row) { matched.add(row.country); break; }
//         }

//         if (!row) {
//           return { fillColor: "#dde1e7", fillOpacity: 0.55, color: "#ffffff", weight: 0.5 };
//         }

//         return {
//           fillColor:   regionToColor(row.region),
//           fillOpacity: 0.85,
//           color:       "#ffffff",
//           weight:      0.7,
//         };
//       },

//       onEachFeature: (feature, layer) => {
//         if (!feature) return;
//         const props = feature.properties as Record<string, string>;
//         const nameCandidates = [props.NAME, props.ADMIN, props.NAME_LONG].filter(Boolean);
//         let row: ChoroplethRow | undefined;
//         for (const name of nameCandidates) {
//           row = resolveCountryName(name, lookup);
//           if (row) break;
//         }

//         if (row) {
//           const dispVal = metric === "yoy_growth"
//             ? (row.yoy_growth != null ? `${(row.yoy_growth * 100).toFixed(1)}%` : "N/A")
//             : `$${row.value.toFixed(1)}B`;
//           const label = metric === "yoy_growth" ? "YoY Growth" : "Market Value";

//           (layer as ReturnType<typeof L.geoJSON>).bindTooltip(
//             `<div style="font-family:Arial,Helvetica,sans-serif;min-width:170px">
//               <div style="font-weight:700;font-size:13px;color:#0f172a;margin-bottom:3px">${row.country}</div>
//               <div style="font-size:11px;color:#64748b;margin-bottom:6px">${row.region}</div>
//               <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px;margin-bottom:3px">
//                 <span style="color:#64748b">${label}</span>
//                 <span style="font-weight:700">${dispVal}</span>
//               </div>
//               <div style="display:flex;justify-content:space-between;gap:12px;font-size:12px">
//                 <span style="color:#64748b">Market Value</span>
//                 <span style="font-weight:600">$${row.value.toFixed(1)}B</span>
//               </div>
//             </div>`,
//             { sticky: true }
//           );
//         }
//       },
//     });

//     geoLayer.addTo(map);
//     geoLayerRef.current = geoLayer;

//     // Legend
//     const LControl = L.Control.extend({
//       onAdd: function() {
//         const div  = L.DomUtil.create("div");
//         const lbl  = `Construction Activity ${year}`;
//         // Build unique regions from data
//         const regionEntries = [...new Set(data.map(d => d.region))]
//           .map(r => ({ region: r, color: regionToColor(r) }));

//         div.innerHTML = `
//           <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;font-family:Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:160px">
//             <div style="font-size:11px;font-weight:700;color:#1e293b;margin-bottom:8px">${lbl}</div>
//             ${regionEntries.map(({ region, color }) => `
//               <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
//                 <div style="width:12px;height:12px;border-radius:2px;background:${color};flex-shrink:0"></div>
//                 <span style="font-size:11px;color:#374151">${region}</span>
//               </div>`).join("")}
//             <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
//               <div style="width:12px;height:12px;border-radius:2px;background:#dde1e7;flex-shrink:0"></div>
//               <span style="font-size:11px;color:#94a3b8">No data</span>
//             </div>
//           </div>`;
//         return div;
//       },
//     });
//     const legend = new LControl({ position: "topright" });
//     legend.addTo(map);
//     legendRef.current = legend;
//   }

//   return (
//     <div style={{ position: "relative", borderRadius: 8, overflow: "hidden" }}>
//       <div ref={containerRef} style={{ height, width: "100%", borderRadius: 8 }} />
//     </div>
//   );
// }
