// // "use client";
// // // PATH: frontend/app/cement-specific/capacity-concentration/page.tsx
// // import { useEffect, useState, useCallback } from "react";
// // import PageHeader from "@/components/layout/PageHeader";
// // import Sidebar, {
// //   FilterLabel, FilterSelect, FilterCheckbox, FilterDivider,
// // } from "@/components/layout/Sidebar";
// // import CapacityConcentrationChart, {
// //   type ConcentrationRow,
// // } from "@/components/charts/CapacityConcentrationChart";
// // import ChatPanel from "@/components/chat/ChatPanel";
// // import ChartActions from "@/components/ui/ChartActions";
// // import { downloadBlob } from "@/lib/chartHelpers";
// // import api from "@/lib/api"; // uses the axios instance already configured

// // // ── API helpers ───────────────────────────────────────────────────────────────
// // const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// // async function fetchMeta(): Promise<{ statuses: string[]; countries: string[] }> {
// //   const r = await fetch(`${BASE}/cement-specific/capacity-concentration/meta`);
// //   return r.json();
// // }

// // async function fetchChart(body: {
// //   statuses: string[] | null;
// //   countries: string[] | null;
// //   top_n_countries: number;
// // }): Promise<{ data: ConcentrationRow[] }> {
// //   const r = await fetch(`${BASE}/cement-specific/capacity-concentration/chart`, {
// //     method: "POST",
// //     headers: { "Content-Type": "application/json" },
// //     body: JSON.stringify(body),
// //   });
// //   return r.json();
// // }

// // // ── Component ─────────────────────────────────────────────────────────────────
// // export default function CapacityConcentrationPage() {
// //   // Meta
// //   const [allStatuses, setAllStatuses]   = useState<string[]>([]);
// //   const [allCountries, setAllCountries] = useState<string[]>([]);

// //   // Filters
// //   const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
// //   const [topN, setTopN]                         = useState(10);
// //   const [customCountries, setCustomCountries]   = useState<string[]>([]);   // [] = use topN
// //   const [addCountry, setAddCountry]             = useState("");

// //   // Data
// //   const [chartData, setChartData] = useState<ConcentrationRow[]>([]);
// //   const [loading, setLoading]     = useState(false);
// //   const [chartCtx, setChartCtx]  = useState<Record<string, unknown>>({});

// //   // ── Load meta once ─────────────────────────────────────────────────────────
// //   useEffect(() => {
// //     fetchMeta().then(({ statuses, countries }) => {
// //       setAllStatuses(statuses);
// //       setAllCountries(countries);
// //       // Default: only "operating"
// //       const def = statuses.includes("operating") ? new Set(["operating"]) : new Set(statuses);
// //       setSelectedStatuses(def);
// //     });
// //   }, []);

// //   // ── Fetch chart data whenever filters change ───────────────────────────────
// //   const load = useCallback(() => {
// //     if (!allStatuses.length) return;
// //     setLoading(true);
// //     const statuses = selectedStatuses.size === allStatuses.length
// //       ? null   // all = no filter
// //       : [...selectedStatuses];
// //     const countries = customCountries.length ? customCountries : null;
// //     fetchChart({ statuses, countries, top_n_countries: topN })
// //       .then(res => {
// //         setChartData(res.data);
// //         setChartCtx({ statuses, countries, topN });
// //       })
// //       .finally(() => setLoading(false));
// //   }, [allStatuses, selectedStatuses, customCountries, topN]);

// //   useEffect(() => { load(); }, [load]);

// //   // ── Toggle status checkbox ─────────────────────────────────────────────────
// //   const toggleStatus = (s: string, checked: boolean) => {
// //     setSelectedStatuses(prev => {
// //       const next = new Set(prev);
// //       checked ? next.add(s) : next.delete(s);
// //       return next;
// //     });
// //   };

// //   // ── Country management ─────────────────────────────────────────────────────
// //   const addCustomCountry = () => {
// //     if (addCountry && !customCountries.includes(addCountry)) {
// //       setCustomCountries(prev => [...prev, addCountry]);
// //     }
// //     setAddCountry("");
// //   };

// //   const removeCountry = (c: string) =>
// //     setCustomCountries(prev => prev.filter(x => x !== c));

// //   // ── CSV download ───────────────────────────────────────────────────────────
// //   const downloadCsv = () => {
// //     const header = "Country,Total Capacity (Mt),Top3 Capacity (Mt),Top3 Share (%),Other Share (%),Top3 Owner 1,Top3 Owner 2,Top3 Owner 3";
// //     const rows = chartData.map(r => {
// //       const owners = r.top3_owners.map(o => o.owner);
// //       return `${r.country},${r.total_capacity},${r.top3_capacity},${r.top3_share},${r.other_share},${owners[0] ?? ""},${owners[1] ?? ""},${owners[2] ?? ""}`;
// //     });
// //     downloadBlob(
// //       new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
// //       "capacity_concentration.csv",
// //     );
// //   };

// //   const usingCustom = customCountries.length > 0;

// //   return (
// //     <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
// //       <PageHeader
// //         title="Top 3 Share of Local Production Capacity"
// //         subtitle="Cement Specific · GEM Tracker · Capacity Concentration by Country"
// //       />

// //       <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

// //         {/* ── Sidebar ─────────────────────────────────────────────────── */}
// //         <Sidebar title="Filters">

// //           {/* Operating status */}
// //           <div>
// //             <FilterLabel>Operating Status</FilterLabel>
// //             <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
// //               {allStatuses.map(s => (
// //                 <FilterCheckbox
// //                   key={s}
// //                   label={s.charAt(0).toUpperCase() + s.slice(1)}
// //                   checked={selectedStatuses.has(s)}
// //                   onChange={v => toggleStatus(s, v)}
// //                 />
// //               ))}
// //             </div>
// //           </div>

// //           <FilterDivider />

// //           {/* Top N (only when not using custom country list) */}
// //           {!usingCustom && (
// //             <div>
// //               <FilterLabel>Top Countries: <strong>{topN}</strong></FilterLabel>
// //               <input
// //                 type="range" min={5} max={50} value={topN}
// //                 onChange={e => setTopN(Number(e.target.value))}
// //                 style={{ width: "100%", accentColor: "var(--bain-red)", marginTop: 4 }}
// //               />
// //               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
// //                 <span>5</span><span>50</span>
// //               </div>
// //             </div>
// //           )}

// //           <FilterDivider />

// //           {/* Custom country picker */}
// //           <div>
// //             <FilterLabel>Add Country</FilterLabel>
// //             <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
// //               <FilterSelect
// //                 value={addCountry}
// //                 onChange={e => setAddCountry(e.target.value)}
// //                 style={{ flex: 1 }}
// //               >
// //                 <option value="">Select…</option>
// //                 {allCountries
// //                   .filter(c => !customCountries.includes(c))
// //                   .map(c => <option key={c}>{c}</option>)}
// //               </FilterSelect>
// //               <button
// //                 onClick={addCustomCountry}
// //                 disabled={!addCountry}
// //                 style={{
// //                   padding: "6px 9px", fontSize: 12, fontWeight: 700,
// //                   background: addCountry ? "var(--bain-red)" : "#e2e8f0",
// //                   color: addCountry ? "#fff" : "#94a3b8",
// //                   border: "none", borderRadius: 6, cursor: addCountry ? "pointer" : "default",
// //                   transition: "all 0.15s",
// //                 }}
// //               >+</button>
// //             </div>

// //             {usingCustom && (
// //               <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
// //                 {customCountries.map(c => (
// //                   <div key={c} style={{
// //                     display: "flex", alignItems: "center", justifyContent: "space-between",
// //                     background: "#fef2f2", borderRadius: 5, padding: "3px 7px",
// //                     fontSize: 11, color: "#dc2626",
// //                   }}>
// //                     <span>{c}</span>
// //                     <button
// //                       onClick={() => removeCountry(c)}
// //                       style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
// //                     >×</button>
// //                   </div>
// //                 ))}
// //                 <button
// //                   onClick={() => setCustomCountries([])}
// //                   style={{
// //                     marginTop: 4, fontSize: 10, color: "#94a3b8",
// //                     background: "none", border: "none", cursor: "pointer",
// //                     textAlign: "left", padding: 0,
// //                   }}
// //                 >
// //                   Clear — revert to Top {topN}
// //                 </button>
// //               </div>
// //             )}
// //           </div>
// //         </Sidebar>

// //         {/* ── Main content ─────────────────────────────────────────────── */}
// //         <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
// //           <div style={{ flex: 1, minWidth: 0 }}>

// //             {/* Chart card */}
// //             <div style={{
// //               background: "#ffffff", border: "1px solid #e9ecef",
// //               borderRadius: 10, padding: 16,
// //               boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
// //             }}>
// //               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
// //                 <div>
// //                   <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
// //                     Top 3 Producers Share of Local Capacity
// //                   </div>
// //                   <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
// //                     {usingCustom
// //                       ? `${customCountries.length} selected countries`
// //                       : `Top ${topN} countries by Top-3 share`}
// //                     {" · "}
// //                     {selectedStatuses.size === allStatuses.length
// //                       ? "All statuses"
// //                       : [...selectedStatuses].join(", ")}
// //                   </div>
// //                 </div>
// //                 <ChartActions
// //                   onCsv={downloadCsv}
// //                   csvDisabled={chartData.length === 0}
// //                   showPpt={false}
// //                 />
// //               </div>

// //               {loading ? (
// //                 <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
// //                   Loading…
// //                 </div>
// //               ) : (
// //                 <CapacityConcentrationChart data={chartData} />
// //               )}

// //               <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
// //                 Source: Global Cement &amp; Concrete Tracker, GEM (July 2025)
// //               </p>
// //             </div>

// //             {/* Summary table */}
// //             {!loading && chartData.length > 0 && (
// //               <div style={{
// //                 marginTop: 16, background: "#ffffff", border: "1px solid #e9ecef",
// //                 borderRadius: 10, overflow: "hidden",
// //                 boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
// //               }}>
// //                 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif" }}>
// //                   <thead>
// //                     <tr style={{ background: "#fafafa", borderBottom: "1px solid #e9ecef" }}>
// //                       {["Country", "Total Capacity (Mt)", "Top 3 Share", "Top 3 Owners"].map(h => (
// //                         <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
// //                       ))}
// //                     </tr>
// //                   </thead>
// //                   <tbody>
// //                     {chartData.map((row, i) => (
// //                       <tr key={row.country} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
// //                         <td style={{ padding: "7px 12px", fontWeight: 600, color: "#1e293b" }}>{row.country}</td>
// //                         <td style={{ padding: "7px 12px", color: "#475569" }}>{row.total_capacity.toFixed(1)}</td>
// //                         <td style={{ padding: "7px 12px" }}>
// //                           <span style={{
// //                             background: "#fef2f2", color: "#dc2626",
// //                             padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11,
// //                           }}>
// //                             {row.top3_share.toFixed(1)}%
// //                           </span>
// //                         </td>
// //                         <td style={{ padding: "7px 12px", color: "#475569" }}>
// //                           {row.top3_owners.map(o => o.owner).join(" · ")}
// //                         </td>
// //                       </tr>
// //                     ))}
// //                   </tbody>
// //                 </table>
// //               </div>
// //             )}
// //           </div>

// //           {/* ── Chat ───────────────────────────────────────────────────── */}
// //           <div style={{ width: 288, flexShrink: 0 }}>
// //             <ChatPanel
// //               currentFilters={{ statuses: [...selectedStatuses], topN, customCountries }}
// //               chartContext={chartCtx}
// //               dataScope="cement_specific"
// //               title="Cement Lens"
// //             />
// //           </div>
// //         </div>
// //       </div>
// //     </div>
// //   );
// // }











// "use client";
// // PATH: frontend/app/cement-specific/capacity-concentration/page.tsx
// import { useEffect, useState, useCallback } from "react";
// import PageHeader from "@/components/layout/PageHeader";
// import Sidebar, {
//   FilterLabel, FilterSelect, FilterCheckbox, FilterDivider,
// } from "@/components/layout/Sidebar";
// import CapacityConcentrationChart, {
//   type ConcentrationRow,
// } from "@/components/charts/CapacityConcentrationChart";
// import ChatPanel from "@/components/chat/ChatPanel";
// import ChartActions from "@/components/ui/ChartActions";
// import { downloadBlob } from "@/lib/chartHelpers";
// // ── API helpers ───────────────────────────────────────────────────────────────
// const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// async function fetchMeta(): Promise<{ statuses: string[]; countries: string[] }> {
//   const r = await fetch(`${BASE}/cement-specific/capacity-concentration/meta`);
//   return r.json();
// }

// async function fetchChart(body: {
//   statuses: string[] | null;
//   countries: string[] | null;
//   top_n_countries: number;
// }): Promise<{ data: ConcentrationRow[] }> {
//   const r = await fetch(`${BASE}/cement-specific/capacity-concentration/chart`, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });
//   return r.json();
// }

// // ── Component ─────────────────────────────────────────────────────────────────
// export default function CapacityConcentrationPage() {
//   // Meta
//   const [allStatuses, setAllStatuses]   = useState<string[]>([]);
//   const [allCountries, setAllCountries] = useState<string[]>([]);

//   // Filters
//   const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
//   const [topN, setTopN]                         = useState(10);
//   const DEFAULT_COUNTRIES = [
//     "Nigeria", "Australia", "Algeria", "Japan", "Thailand",
//     "Indonesia", "Mexico", "Canada", "France", "United Kingdom",
//     "Italy", "Poland", "Brazil", "Spain", "Germany",
//     "Egypt", "India", "United States",
//   ];
//   const [customCountries, setCustomCountries] = useState<string[]>(DEFAULT_COUNTRIES);
//   const [addCountry, setAddCountry]             = useState("");

//   // Data
//   const [chartData, setChartData] = useState<ConcentrationRow[]>([]);
//   const [loading, setLoading]     = useState(false);
//   const [chartCtx, setChartCtx]  = useState<Record<string, unknown>>({});

//   // ── Load meta once ─────────────────────────────────────────────────────────
//   useEffect(() => {
//     fetchMeta().then(({ statuses, countries }) => {
//       setAllStatuses(statuses);
//       setAllCountries(countries);
//       // Default: only "operating"
//       const def = statuses.includes("operating") ? new Set(["operating"]) : new Set(statuses);
//       setSelectedStatuses(def);
//     });
//   }, []);

//   // ── Fetch chart data whenever filters change ───────────────────────────────
//   const load = useCallback(() => {
//     if (!allStatuses.length) return;
//     setLoading(true);
//     const statuses = selectedStatuses.size === allStatuses.length
//       ? null   // all = no filter
//       : [...selectedStatuses];
//     const countries = customCountries.length ? customCountries : null;
//     fetchChart({ statuses, countries, top_n_countries: topN })
//       .then(res => {
//         setChartData(res.data);
//         setChartCtx({ statuses, countries, topN });
//       })
//       .finally(() => setLoading(false));
//   }, [allStatuses, selectedStatuses, customCountries, topN]);

//   useEffect(() => { load(); }, [load]);

//   // ── Toggle status checkbox ─────────────────────────────────────────────────
//   const toggleStatus = (s: string, checked: boolean) => {
//     setSelectedStatuses(prev => {
//       const next = new Set(prev);
//       checked ? next.add(s) : next.delete(s);
//       return next;
//     });
//   };

//   // ── Country management ─────────────────────────────────────────────────────
//   const addCustomCountry = () => {
//     if (addCountry && !customCountries.includes(addCountry)) {
//       setCustomCountries(prev => [...prev, addCountry]);
//     }
//     setAddCountry("");
//   };

//   const removeCountry = (c: string) =>
//     setCustomCountries(prev => prev.filter(x => x !== c));

//   // ── CSV download ───────────────────────────────────────────────────────────
//   const downloadCsv = () => {
//     const header = "Country,Total Capacity (Mt),Top3 Capacity (Mt),Top3 Share (%),Other Share (%),Top3 Owner 1,Top3 Owner 2,Top3 Owner 3";
//     const rows = chartData.map(r => {
//       const owners = r.top3_owners.map(o => o.owner);
//       return `${r.country},${r.total_capacity},${r.top3_capacity},${r.top3_share},${r.other_share},${owners[0] ?? ""},${owners[1] ?? ""},${owners[2] ?? ""}`;
//     });
//     downloadBlob(
//       new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
//       "capacity_concentration.csv",
//     );
//   };

//   const usingCustom = customCountries.length > 0;

//   return (
//     <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
//       <PageHeader
//         title="Top 3 Share of Local Production Capacity"
//         subtitle="Cement Specific · GEM Tracker · Capacity Concentration by Country"
//       />

//       <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

//         {/* ── Sidebar ─────────────────────────────────────────────────── */}
//         <Sidebar title="Filters">

//           {/* Operating status */}
//           <div>
//             <FilterLabel>Operating Status</FilterLabel>
//             <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
//               {allStatuses.map(s => (
//                 <FilterCheckbox
//                   key={s}
//                   label={s.charAt(0).toUpperCase() + s.slice(1)}
//                   checked={selectedStatuses.has(s)}
//                   onChange={v => toggleStatus(s, v)}
//                 />
//               ))}
//             </div>
//           </div>

//           <FilterDivider />

//           {/* Top N (only when not using custom country list) */}
//           {!usingCustom && (
//             <div>
//               <FilterLabel>Top Countries: <strong>{topN}</strong></FilterLabel>
//               <input
//                 type="range" min={5} max={50} value={topN}
//                 onChange={e => setTopN(Number(e.target.value))}
//                 style={{ width: "100%", accentColor: "var(--bain-red)", marginTop: 4 }}
//               />
//               <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
//                 <span>5</span><span>50</span>
//               </div>
//             </div>
//           )}

//           <FilterDivider />

//           {/* Custom country picker */}
//           <div>
//             <FilterLabel>Add Country</FilterLabel>
//             <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
//               <FilterSelect
//                 value={addCountry}
//                 onChange={e => setAddCountry(e.target.value)}
//                 style={{ flex: 1 }}
//               >
//                 <option value="">Select…</option>
//                 {allCountries
//                   .filter(c => !customCountries.includes(c))
//                   .map(c => <option key={c}>{c}</option>)}
//               </FilterSelect>
//               <button
//                 onClick={addCustomCountry}
//                 disabled={!addCountry}
//                 style={{
//                   padding: "6px 9px", fontSize: 12, fontWeight: 700,
//                   background: addCountry ? "var(--bain-red)" : "#e2e8f0",
//                   color: addCountry ? "#fff" : "#94a3b8",
//                   border: "none", borderRadius: 6, cursor: addCountry ? "pointer" : "default",
//                   transition: "all 0.15s",
//                 }}
//               >+</button>
//             </div>

//             {usingCustom && (
//               <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
//                 {customCountries.map(c => (
//                   <div key={c} style={{
//                     display: "flex", alignItems: "center", justifyContent: "space-between",
//                     background: "#fef2f2", borderRadius: 5, padding: "3px 7px",
//                     fontSize: 11, color: "#dc2626",
//                   }}>
//                     <span>{c}</span>
//                     <button
//                       onClick={() => removeCountry(c)}
//                       style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
//                     >×</button>
//                   </div>
//                 ))}
//                 <button
//                   onClick={() => setCustomCountries([])}
//                   style={{
//                     marginTop: 4, fontSize: 10, color: "#94a3b8",
//                     background: "none", border: "none", cursor: "pointer",
//                     textAlign: "left", padding: 0,
//                   }}
//                 >
//                   Clear — revert to Top {topN}
//                 </button>
//               </div>
//             )}
//           </div>
//         </Sidebar>

//         {/* ── Main content ─────────────────────────────────────────────── */}
//         <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
//           <div style={{ flex: 1, minWidth: 0 }}>

//             {/* Chart card */}
//             <div style={{
//               background: "#ffffff", border: "1px solid #e9ecef",
//               borderRadius: 10, padding: 16,
//               boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
//             }}>
//               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
//                 <div>
//                   <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
//                     Top 3 Producers Share of Local Capacity
//                   </div>
//                   <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
//                     {usingCustom
//                       ? `${customCountries.length} selected countries`
//                       : `Top ${topN} countries by Top-3 share`}
//                     {" · "}
//                     {selectedStatuses.size === allStatuses.length
//                       ? "All statuses"
//                       : [...selectedStatuses].join(", ")}
//                   </div>
//                 </div>
//                 <ChartActions
//                   onCsv={downloadCsv}
//                   csvDisabled={chartData.length === 0}
//                   showPpt={false}
//                 />
//               </div>

//               {loading ? (
//                 <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
//                   Loading…
//                 </div>
//               ) : (
//                 <CapacityConcentrationChart data={chartData} />
//               )}

//               <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
//                 Source: Global Cement &amp; Concrete Tracker, GEM (July 2025)
//               </p>
//             </div>

//             {/* Summary table */}
//             {!loading && chartData.length > 0 && (
//               <div style={{
//                 marginTop: 16, background: "#ffffff", border: "1px solid #e9ecef",
//                 borderRadius: 10, overflow: "hidden",
//                 boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
//               }}>
//                 <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "Arial, Helvetica, sans-serif" }}>
//                   <thead>
//                     <tr style={{ background: "#fafafa", borderBottom: "1px solid #e9ecef" }}>
//                       {["Country", "Total Capacity (Mt)", "Top 3 Share", "Top 3 Owners"].map(h => (
//                         <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
//                       ))}
//                     </tr>
//                   </thead>
//                   <tbody>
//                     {chartData.map((row, i) => (
//                       <tr key={row.country} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
//                         <td style={{ padding: "7px 12px", fontWeight: 600, color: "#1e293b" }}>{row.country}</td>
//                         <td style={{ padding: "7px 12px", color: "#475569" }}>{row.total_capacity.toFixed(1)}</td>
//                         <td style={{ padding: "7px 12px" }}>
//                           <span style={{
//                             background: "#fef2f2", color: "#dc2626",
//                             padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11,
//                           }}>
//                             {row.top3_share.toFixed(1)}%
//                           </span>
//                         </td>
//                         <td style={{ padding: "7px 12px", color: "#475569" }}>
//                           {row.top3_owners.map(o => o.owner).join(" · ")}
//                         </td>
//                       </tr>
//                     ))}
//                   </tbody>
//                 </table>
//               </div>
//             )}
//           </div>

//           {/* ── Chat ───────────────────────────────────────────────────── */}
//           <div style={{ width: 288, flexShrink: 0 }}>
//             <ChatPanel
//               currentFilters={{ statuses: [...selectedStatuses], topN, customCountries }}
//               chartContext={chartCtx}
//               dataScope="cement_specific"
//               title="Cement Lens"
//             />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }







"use client";
// PATH: frontend/app/cement-specific/capacity-concentration/page.tsx
import { useEffect, useState, useCallback } from "react";
import PageHeader from "@/components/layout/PageHeader";
import Sidebar, {
  FilterLabel, FilterSelect, FilterCheckbox, FilterDivider,
} from "@/components/layout/Sidebar";
import CapacityConcentrationChart, {
  type ConcentrationRow,
} from "@/components/charts/CapacityConcentrationChart";
import ChatPanel from "@/components/chat/ChatPanel";
import ChartActions from "@/components/ui/ChartActions";
import { downloadBlob } from "@/lib/chartHelpers";
import { exportPptx } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchMeta(): Promise<{ statuses: string[]; countries: string[] }> {
  const r = await fetch(`${BASE}/cement-specific/capacity-concentration/meta`);
  return r.json();
}

async function fetchChart(body: {
  statuses: string[] | null;
  countries: string[] | null;
  top_n_countries: number;
}): Promise<{ data: ConcentrationRow[] }> {
  const r = await fetch(`${BASE}/cement-specific/capacity-concentration/chart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

const DEFAULT_COUNTRIES = [
  "Nigeria", "Australia", "Algeria", "Japan", "Thailand",
  "Indonesia", "Mexico", "Canada", "France", "United Kingdom",
  "Italy", "Poland", "Brazil", "Spain", "Germany",
  "Egypt", "India", "United States",
];

export default function CapacityConcentrationPage() {
  const [allStatuses, setAllStatuses]   = useState<string[]>([]);
  const [allCountries, setAllCountries] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set());
  const [topN, setTopN]                         = useState(10);
  const [customCountries, setCustomCountries]   = useState<string[]>(DEFAULT_COUNTRIES);
  const [addCountry, setAddCountry]             = useState("");
  const [chartData, setChartData] = useState<ConcentrationRow[]>([]);
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [chartCtx, setChartCtx]  = useState<Record<string, unknown>>({});
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    fetchMeta()
      .then(({ statuses, countries }) => {
        setAllStatuses(statuses ?? []);
        setAllCountries(countries ?? []);
        const s = statuses ?? [];
        const def = s.includes("operating") ? new Set(["operating"]) : new Set(s);
        setSelectedStatuses(def);
      })
      .catch(err => console.error("Failed to load meta:", err));
  }, []);

  const load = useCallback(() => {
    if (!allStatuses.length) return;
    setLoading(true);
    const statuses = selectedStatuses.size === allStatuses.length ? null : [...selectedStatuses];
    const countries = customCountries.length ? customCountries : null;
    fetchChart({ statuses, countries, top_n_countries: topN })
      .then(res => {
        setChartData(res.data);
        setChartCtx({ statuses, countries, topN });
      })
      .finally(() => setLoading(false));
  }, [allStatuses, selectedStatuses, customCountries, topN]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = (s: string, checked: boolean) => {
    setSelectedStatuses(prev => {
      const next = new Set(prev);
      checked ? next.add(s) : next.delete(s);
      return next;
    });
  };

  const addCustomCountry = () => {
    if (addCountry && !customCountries.includes(addCountry))
      setCustomCountries(prev => [...prev, addCountry]);
    setAddCountry("");
  };

  const removeCountry = (c: string) =>
    setCustomCountries(prev => prev.filter(x => x !== c));

  // ── PPT export ─────────────────────────────────────────────────────────────
  const exportPpt = async () => {
    if (!chartData.length) return;
    setExporting(true);
    try {
      // Sort by top3_share descending (matches chart order)
      const sorted = [...chartData].sort((a, b) => b.top3_share - a.top3_share);

      // think-cell mekko table format:
      // Row 0 = header: [null, country1, country2, ...]
      // Row 1 = series "Top 3":  [label, top3_capacity, ...]
      // Row 2 = series "Other":  [label, other_capacity, ...]
      const header  = [null, ...sorted.map(r => ({ string: r.country }))];
      const top3Row = [
        { string: "Top 3" },
        ...sorted.map(r => ({ number: parseFloat(r.top3_capacity.toFixed(2)) })),
      ];
      const otherRow = [
        { string: "Other" },
        ...sorted.map(r => ({
          number: parseFloat((r.total_capacity - r.top3_capacity).toFixed(2)),
        })),
      ];

      const res = await exportPptx({
        template: "mekko_rms",
        filename: "capacity_concentration.pptx",
        data: [{ name: "MekkoChart", table: [header, top3Row, otherRow] }],
      });

      downloadBlob(
        new Blob([res.data], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        }),
        "capacity_concentration.pptx",
      );
    } catch (e) {
      console.error("PPT export failed", e);
    } finally {
      setExporting(false);
    }
  };

  // ── CSV download ───────────────────────────────────────────────────────────
  const downloadCsv = () => {
    const header = "Country,Total Capacity (Mt),Top3 Capacity (Mt),Top3 Share (%),Other Share (%),Top3 Owner 1,Top3 Owner 2,Top3 Owner 3";
    const rows = chartData.map(r => {
      const owners = r.top3_owners.map(o => o.owner);
      return `${r.country},${r.total_capacity},${r.top3_capacity},${r.top3_share},${r.other_share},${owners[0] ?? ""},${owners[1] ?? ""},${owners[2] ?? ""}`;
    });
    downloadBlob(
      new Blob([[header, ...rows].join("\n")], { type: "text/csv" }),
      "capacity_concentration.csv",
    );
  };

  return (
    <div style={{ fontFamily: "Arial, Helvetica, sans-serif" }}>
      <PageHeader
        title="Top 3 Share of Local Production Capacity"
        subtitle="Cement Specific · GEM Tracker · Capacity Concentration by Country"
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>

        {/* ── Sidebar ─────────────────────────────────────────────────── */}
        <Sidebar title="Filters">
          <div>
            <FilterLabel>Operating Status</FilterLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {allStatuses.map(s => (
                <FilterCheckbox
                  key={s}
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  checked={selectedStatuses.has(s)}
                  onChange={v => toggleStatus(s, v)}
                />
              ))}
            </div>
          </div>

          <FilterDivider />

          {customCountries.length === 0 && (
            <div>
              <FilterLabel>Top Countries: <strong>{topN}</strong></FilterLabel>
              <input
                type="range" min={5} max={50} value={topN}
                onChange={e => setTopN(Number(e.target.value))}
                style={{ width: "100%", accentColor: "var(--bain-red)", marginTop: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                <span>5</span><span>50</span>
              </div>
            </div>
          )}

          <FilterDivider />

          <div>
            <FilterLabel>Countries</FilterLabel>
            <div style={{
              minHeight: 48, maxHeight: 130, overflowY: "auto",
              border: "1px solid #e2e8f0", borderRadius: 6,
              padding: "4px 6px", marginTop: 4, marginBottom: 6,
              display: "flex", flexWrap: "wrap", gap: 4,
              background: "#fafafa",
            }}>
              {customCountries.length === 0 && (
                <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>
                  Showing top {topN} by Top-3 share
                </span>
              )}
              {customCountries.map(c => (
                <span key={c} style={{
                  display: "inline-flex", alignItems: "center", gap: 3,
                  background: "#fef2f2", border: "1px solid #fecaca",
                  borderRadius: 4, padding: "2px 5px",
                  fontSize: 10, color: "#dc2626", fontWeight: 600, whiteSpace: "nowrap",
                }}>
                  {c}
                  <button
                    onClick={() => removeCountry(c)}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 12, lineHeight: 1, padding: 0, marginTop: 1 }}
                  >×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <FilterSelect value={addCountry} onChange={e => setAddCountry(e.target.value)} style={{ flex: 1 }}>
                <option value="">Add country…</option>
                {allCountries.filter(c => !customCountries.includes(c)).map(c => <option key={c}>{c}</option>)}
              </FilterSelect>
              <button
                onClick={addCustomCountry}
                disabled={!addCountry}
                style={{
                  padding: "6px 9px", fontSize: 12, fontWeight: 700,
                  background: addCountry ? "#dc2626" : "#e2e8f0",
                  color: addCountry ? "#fff" : "#94a3b8",
                  border: "none", borderRadius: 6,
                  cursor: addCountry ? "pointer" : "default",
                  transition: "all 0.15s", flexShrink: 0,
                }}
              >+</button>
            </div>
            {customCountries.length > 0 && (
              <button
                onClick={() => setCustomCountries([])}
                style={{ marginTop: 6, fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: 0 }}
              >
                Clear all
              </button>
            )}
          </div>
        </Sidebar>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Chart card */}
            <div style={{ background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 16 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                    Top 3 Producers Share of Local Capacity
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {customCountries.length > 0
                      ? `${customCountries.length} selected countries`
                      : `Top ${topN} countries by Top-3 share`}
                    {" · "}
                    {selectedStatuses.size === allStatuses.length
                      ? "All statuses"
                      : [...selectedStatuses].join(", ")}
                  </div>
                </div>
                <ChartActions
                  onCsv={downloadCsv}
                  csvDisabled={chartData.length === 0}
                  showPpt={true}
                  onPpt={exportPpt}
                  pptDisabled={chartData.length === 0}
                  pptLoading={exporting}
                />
              </div>

              {loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 260, color: "#94a3b8", fontSize: 13 }}>
                  Loading…
                </div>
              ) : (
                <CapacityConcentrationChart data={chartData} />
              )}

              <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                Source: Global Cement &amp; Concrete Tracker, GEM (July 2025)
              </p>
            </div>

            {/* Collapsible data table */}
            <div style={{ marginTop: 12, background: "#ffffff", border: "1px solid #e9ecef", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
              <button
                onClick={() => setShowTable(v => !v)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "Arial, Helvetica, sans-serif",
                }}
              >
                <span>Data shown ({chartData.length} countries)</span>
                <span style={{ color: "#94a3b8", fontSize: 16 }}>{showTable ? "▲" : "▼"}</span>
              </button>

              {showTable && (
                <div style={{ overflowX: "auto", maxHeight: 280, overflowY: "auto", borderTop: "1px solid #f1f5f9" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "Arial, Helvetica, sans-serif" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Country", "Total Capacity (Mt)", "Top 3 Share", "Top 3 Capacity (Mt)", "Top 3 Owners"].map(h => (
                          <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 11, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chartData.map((row, i) => (
                        <tr key={row.country} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap" }}>{row.country}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{row.total_capacity.toFixed(1)}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9" }}>
                            <span style={{ background: "#fef2f2", color: "#dc2626", padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                              {row.top3_share.toFixed(1)}%
                            </span>
                          </td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#374151", textAlign: "right" }}>{row.top3_capacity.toFixed(1)}</td>
                          <td style={{ padding: "5px 10px", borderBottom: "1px solid #f1f5f9", color: "#475569" }}>{row.top3_owners.map(o => o.owner).join(" · ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>

          {/* ── Chat ───────────────────────────────────────────────────── */}
          <div style={{ width: 288, flexShrink: 0 }}>
            <ChatPanel
              currentFilters={{ statuses: [...selectedStatuses], topN, customCountries }}
              chartContext={chartCtx}
              dataScope="cement_specific"
              title="Construct Lens"
            />
          </div>
        </div>
      </div>
    </div>
  );
}