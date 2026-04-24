// PATH: frontend/app/supply-production/us-plant-insights/page.tsx
"use client";
import { useEffect, useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, { FilterLabel, FilterDivider } from "@/components/layout/Sidebar";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { getGeoMapMeta, getGeoMapPlants } from "@/lib/api";
import { downloadBlob, BAIN_RED } from "@/lib/chartHelpers";
import type { PlantRow } from "@/lib/types";

const GeoMap = dynamic(() => import("@/components/charts/GeoMap"), { ssr: false });

const DISTINCT_HEX = [
  "#2A465C","#E60000","#4E7F96","#C6AA3D","#507867",
  "#973B74","#3D6478","#AB8933","#104C3E","#640A40",
  "#5E96AE","#E9CD49","#83AC9A","#BA749F","#2D5A72",
  "#1E3D52","#D9ABC6","#BBCABA","#EED6E5","#DCE2D6",
  "#46647B","#7891AA","#A3BCD3","#DCE5EA","#333333",
];

function extractTranslate(transform: string): { x: number; y: number } {
  if (!transform || transform === "none") return { x: 0, y: 0 };
  const matrix3d = transform.match(/^matrix3d\((.+)\)$/);
  if (matrix3d) {
    const values = matrix3d[1].split(",").map((v) => Number(v.trim()));
    return { x: values[12] ?? 0, y: values[13] ?? 0 };
  }
  const matrix = transform.match(/^matrix\((.+)\)$/);
  if (matrix) {
    const values = matrix[1].split(",").map((v) => Number(v.trim()));
    return { x: values[4] ?? 0, y: values[5] ?? 0 };
  }
  return { x: 0, y: 0 };
}

export default function UsPlantInsightsPage() {
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [capMin,       setCapMin]       = useState(0);
  const [capMax,       setCapMax]       = useState(10);
  const [selCompanies, setSelCompanies] = useState<string[]>([]);
  const [compareList,  setCompareList]  = useState<string[]>([]);
  const [filterCapMin, setFilterCapMin] = useState(0);
  const [filterCapMax, setFilterCapMax] = useState(10);
  const [plants,       setPlants]       = useState<PlantRow[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [downloading,  setDownloading]  = useState(false);
  const [showTable,    setShowTable]    = useState(false);
  const [chartCtx,     setChartCtx]     = useState<Record<string, unknown>>({});
  const mapWrapRef = useRef<HTMLDivElement>(null);
  const [metaLoaded,   setMetaLoaded]   = useState(false);

  const companyColors = useMemo(() => {
    const map: Record<string, string> = {};
    allCompanies.forEach((c, i) => { map[c] = DISTINCT_HEX[i % DISTINCT_HEX.length]; });
    return map;
  }, [allCompanies]);

  useEffect(() => {
    getGeoMapMeta().then((r) => {
      setAllCompanies(r.data.companies);
      setSelCompanies(r.data.companies); // start with all selected
      setMetaLoaded(true);
      setCapMin(r.data.cap_min);
      setCapMax(r.data.cap_max);
      setFilterCapMin(r.data.cap_min);
      setFilterCapMax(r.data.cap_max);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    getGeoMapPlants({
      companies: selCompanies,
      cap_min:   filterCapMin,
      cap_max:   filterCapMax,
    }).then((r) => {
      setPlants(r.data.plants);
      setChartCtx({
        view: "geomap",
        rows_filtered: r.data.filtered,
        rows_total:    r.data.total,
        companies_selected: selCompanies,
        compare_selected: compareList,
        cap_range: [filterCapMin, filterCapMax],
      });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selCompanies, filterCapMin, filterCapMax]);

  const downloadCsv = () => {
    const csv = [
      "Company,Plant,Capacity (Mta),Cement Type,State,City,US Region,Lat,Lon",
      ...plants.map((p) =>
        `"${p.company}","${p.plant}",${p.cement_capacity_mta},"${p.cement_type}","${p.state}","${p.city}","${p.us_region}",${p.lat},${p.lon}`
      ),
    ].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv" }), "us_plant_insights.csv");
  };

  const downloadMapPng = async () => {
    if (!mapWrapRef.current) return;
    setDownloading(true);
    let exportNodes: HTMLElement[] = [];
    try {
      const html2canvas = (await import("html2canvas")).default;
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      exportNodes = Array.from(
        mapWrapRef.current.querySelectorAll<HTMLElement>(
          ".leaflet-map-pane, .leaflet-tile-pane, .leaflet-overlay-pane, .leaflet-shadow-pane, .leaflet-marker-pane, .leaflet-tooltip-pane, .leaflet-popup-pane, .leaflet-control-container",
        ),
      );
      const snapshots = exportNodes.map((node, index) => {
        const computed = window.getComputedStyle(node);
        const { x, y } = extractTranslate(computed.transform);
        const exportId = `leaflet-export-${index}`;
        node.dataset.exportId = exportId;
        return {
          exportId,
          x,
          y,
          width: computed.width,
          height: computed.height,
          position: computed.position,
        };
      });
      const canvas = await html2canvas(mapWrapRef.current, {
        useCORS: true,
        allowTaint: false,
        scale: 2,          // 2x for retina quality
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
          snapshots.forEach((snapshot) => {
            const clonedNode = clonedDoc.querySelector<HTMLElement>(`[data-export-id="${snapshot.exportId}"]`);
            if (!clonedNode) return;
            clonedNode.style.transform = "none";
            clonedNode.style.left = `${snapshot.x}px`;
            clonedNode.style.top = `${snapshot.y}px`;
            clonedNode.style.width = snapshot.width;
            clonedNode.style.height = snapshot.height;
            clonedNode.style.position = snapshot.position === "fixed" ? "absolute" : snapshot.position;
            clonedNode.style.transformOrigin = "top left";
          });
        },
      });
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, "us_cement_plants_map.png");
      }, "image/png");
    } catch (e) {
      console.error("Map download failed:", e);
    } finally {
      exportNodes.forEach((node) => {
        delete node.dataset.exportId;
      });
      setDownloading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: 72, border: "1px solid #e2e8f0", borderRadius: 6,
    padding: "4px 8px", fontSize: 12, color: "#374151",
    fontFamily: "Arial, Helvetica, sans-serif", outline: "none",
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader title="US Cement Plants — GeoMap" subtitle="Supply & Production · CemNet" />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Capacity range (Mta)</FilterLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={filterCapMin} min={capMin} max={filterCapMax} step={0.1}
                onChange={(e) => setFilterCapMin(Number(e.target.value))} style={inputStyle} />
              <span style={{ color: "#94a3b8", fontSize: 12 }}>—</span>
              <input type="number" value={filterCapMax} min={filterCapMin} max={capMax} step={0.1}
                onChange={(e) => setFilterCapMax(Number(e.target.value))} style={inputStyle} />
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Companies</FilterLabel>
            <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {!metaLoaded && <span style={{ fontSize: 11, color: "#94a3b8" }}>Loading…</span>}
              {metaLoaded && allCompanies.map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox"
                    checked={selCompanies.includes(c)}
                    onChange={(e) => setSelCompanies(e.target.checked ? [...selCompanies, c] : selCompanies.filter((x) => x !== c))}
                    style={{ accentColor: BAIN_RED, width: 13, height: 13 }} />
                  <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, background: companyColors[c] ?? "#888", display: "inline-block" }} />
                  <span style={{ fontSize: 11 }}>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <FilterDivider />

          <div>
            <FilterLabel>Compare / highlight</FilterLabel>
            <div style={{ maxHeight: 140, overflowY: "auto", display: "flex", flexDirection: "column", gap: 5 }}>
              {allCompanies.map((c) => (
                <label key={c} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#374151", cursor: "pointer" }}>
                  <input type="checkbox" checked={compareList.includes(c)}
                    onChange={(e) => setCompareList(e.target.checked ? [...compareList, c] : compareList.filter((x) => x !== c))}
                    style={{ accentColor: BAIN_RED, width: 13, height: 13 }} />
                  <span style={{ fontSize: 11 }}>{c}</span>
                </label>
              ))}
            </div>
          </div>

          <FilterDivider />
          <p style={{ fontSize: 11, color: "#94a3b8" }}>Showing {plants.length} plants</p>
        </Sidebar>

        {/* ── Main content ─────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Map card */}
            <div style={{ background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Chart title */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16, paddingRight: 4 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
                    US Cement Plant Locations
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", marginTop: 2 }}>
                    Geographic distribution of production capacity
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <ChartActions
                    onCsv={downloadCsv}
                    csvDisabled={plants.length === 0}
                    showPng={true}
                    onPng={downloadMapPng}
                    pngDisabled={plants.length === 0}
                    pngLoading={downloading}
                    showPpt={false}
                    onPpt={() => {}}
                  />
                </div>
              </div>
              
              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 560, color: "#94a3b8", fontSize: 13 }}>
                  Loading map…
                </div>
              ) : (
                <div ref={mapWrapRef}>
                  <GeoMap plants={plants} companyColors={companyColors} compareSelected={compareList} height={560} />
                </div>
              )}
              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>Source: CemNet</p>
            </div>

            {/* Collapsible data table */}
            <div style={{ marginTop: 12, background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <button onClick={() => setShowTable((v) => !v)} style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "Arial, Helvetica, sans-serif",
              }}>
                <span>Data shown ({plants.length} plants)</span>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", borderTop: "1px solid #f1f5f9" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Company","Plant","Capacity","Type","State","City","Region"].map((h) => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plants.slice(0, 200).map((p, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b" }}>
                            <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: companyColors[p.company] ?? "#888", marginRight: 6 }} />
                            {p.company}
                          </td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151" }}>{p.plant}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{p.cement_capacity_mta}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{p.cement_type}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{p.state}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{p.city}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{p.us_region}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ── Chat ──────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ companies_selected: selCompanies.length ? selCompanies : allCompanies, compare_selected: compareList, cap_range: [filterCapMin, filterCapMax] }}
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
