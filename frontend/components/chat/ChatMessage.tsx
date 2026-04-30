// // PATH: frontend/components/chat/ChatMessage.tsx
// "use client";
// import ReactMarkdown from "react-markdown";
// import remarkGfm from "remark-gfm";

// interface Props {
//   role: "user" | "assistant";
//   content: string;
// }

// const F = "Arial, Helvetica, sans-serif";

// export default function ChatMessage({ role, content }: Props) {
//   const isUser = role === "user";

//   return (
//     <div style={{
//       display: "flex",
//       alignItems: "flex-start",
//       justifyContent: isUser ? "flex-end" : "flex-start",
//       gap: 8,
//       marginBottom: 14,
//     }}>
//       {/* Assistant avatar */}
//       {!isUser && (
//         <div style={{
//           width: 26, height: 26, borderRadius: "50%",
//           background: "var(--bain-red)",
//           display: "flex", alignItems: "center", justifyContent: "center",
//           fontSize: 10, fontWeight: 800, color: "#fff",
//           flexShrink: 0, marginTop: 2, fontFamily: F,
//           boxShadow: "0 1px 4px rgba(230,0,0,0.3)",
//         }}>C</div>
//       )}

//       {/* Bubble */}
//       <div style={{
//         width: isUser ? "auto" : "100%",
//         maxWidth: isUser ? "82%" : "100%",
//         padding: isUser ? "8px 12px" : "14px 16px",
//         borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
//         fontFamily: F,
//         background: isUser ? "#fff1f1" : "#ffffff",
//         border: isUser ? "1px solid #fecaca" : "1px solid #e2e8f0",
//         color: "#1e293b",
//         boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
//         minWidth: 0,
//         overflowWrap: "break-word",
//         wordBreak: "break-word",
//       }}>
//         {isUser ? (
//           <span style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", fontWeight: 500 }}>
//             {content}
//           </span>
//         ) : (
//           <>
//             <style>{`
//               /* ── Base ── */
//               .chat-md {
//                 font-size: 13.5px;
//                 line-height: 1.75;
//                 color: #1e293b;
//                 font-family: Arial, Helvetica, sans-serif;
//               }

//               /* ── Paragraphs ── */
//               .chat-md p { margin: 0 0 10px 0; }
//               .chat-md p:last-child { margin-bottom: 0; }

//               /* ── Headings ── */
//               .chat-md h1 {
//                 font-size: 15px; font-weight: 700; color: #0f172a;
//                 margin: 14px 0 6px 0;
//                 padding-bottom: 5px;
//                 border-bottom: 2px solid #E60000;
//               }
//               .chat-md h2 {
//                 font-size: 14px; font-weight: 700; color: #0f172a;
//                 margin: 12px 0 5px 0;
//                 padding-bottom: 3px;
//                 border-bottom: 1px solid #f1f5f9;
//               }
//               .chat-md h3 {
//                 font-size: 13px; font-weight: 700; color: #1e293b;
//                 margin: 10px 0 4px 0;
//               }
//               .chat-md h4 {
//                 font-size: 12.5px; font-weight: 600; color: #334155;
//                 margin: 8px 0 3px 0;
//               }
//               .chat-md h1:first-child,
//               .chat-md h2:first-child,
//               .chat-md h3:first-child { margin-top: 0; }

//               /* ── Lists ── */
//               .chat-md ul, .chat-md ol {
//                 margin: 6px 0 10px 0;
//                 padding-left: 22px;
//               }
//               .chat-md li {
//                 margin-bottom: 5px;
//                 font-size: 13.5px;
//                 line-height: 1.65;
//                 color: #1e293b;
//               }
//               .chat-md li:last-child { margin-bottom: 0; }
//               .chat-md li > p { margin: 0; }
//               /* Nested lists */
//               .chat-md li ul, .chat-md li ol {
//                 margin: 4px 0 4px 0;
//               }

//               /* ── Inline code ── */
//               .chat-md code {
//                 font-size: 12px;
//                 font-family: 'Courier New', monospace;
//                 background: #f1f5f9;
//                 color: #be123c;
//                 padding: 2px 6px;
//                 border-radius: 4px;
//                 border: 1px solid #e2e8f0;
//               }

//               /* ── Code blocks ── */
//               .chat-md pre {
//                 background: #f8fafc;
//                 border: 1px solid #e2e8f0;
//                 border-radius: 8px;
//                 padding: 12px 14px;
//                 overflow-x: auto;
//                 margin: 10px 0;
//               }
//               .chat-md pre code {
//                 background: none; border: none; padding: 0;
//                 color: #334155; font-size: 12px; line-height: 1.65;
//               }

//               /* ── Formula callout (blockquote) ── */
//               .chat-md blockquote {
//                 border-left: 4px solid #E60000;
//                 margin: 10px 0;
//                 padding: 8px 14px;
//                 background: linear-gradient(90deg, #fff7f7 0%, #fffafa 100%);
//                 border-radius: 0 8px 8px 0;
//                 color: #1e293b;
//               }
//               .chat-md blockquote p {
//                 margin: 0 0 4px 0;
//                 font-size: 13px;
//                 line-height: 1.65;
//               }
//               .chat-md blockquote p:last-child { margin-bottom: 0; }

//               /* ── Tables ── */
//               .chat-md table {
//                 width: 100%;
//                 border-collapse: collapse;
//                 font-size: 12.5px;
//                 margin: 12px 0;
//                 border: 1px solid #e2e8f0;
//                 border-radius: 8px;
//                 overflow: hidden;
//               }
//               .chat-md th {
//                 background: #f1f5f9;
//                 font-weight: 700;
//                 padding: 7px 12px;
//                 text-align: left;
//                 border-bottom: 1px solid #e2e8f0;
//                 border-right: 1px solid #e2e8f0;
//                 color: #1e293b;
//                 font-size: 11.5px;
//                 text-transform: uppercase;
//                 letter-spacing: 0.05em;
//               }
//               .chat-md th:last-child { border-right: none; }
//               .chat-md td {
//                 padding: 7px 12px;
//                 border-bottom: 1px solid #f1f5f9;
//                 border-right: 1px solid #f1f5f9;
//                 color: #334155;
//                 vertical-align: top;
//                 line-height: 1.55;
//               }
//               .chat-md td:last-child { border-right: none; }
//               .chat-md tr:last-child td { border-bottom: none; }
//               .chat-md tr:nth-child(even) td { background: #fafafa; }

//               /* ── Misc ── */
//               .chat-md a {
//                 color: #E60000;
//                 text-decoration: underline;
//                 word-break: break-all;
//                 overflow-wrap: anywhere;
//               }
//               .chat-md hr { border: none; border-top: 1px solid #f1f5f9; margin: 12px 0; }
//               .chat-md strong { font-weight: 700; color: #0f172a; }
//               .chat-md em { font-style: italic; color: #475569; }
//             `}</style>
//             <div className="chat-md">
//               {/* @ts-ignore */}
//               <ReactMarkdown
//                 remarkPlugins={[remarkGfm]}
//                 components={{
//                   a: ({ href, children }) => (
//                     <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
//                   ),
//                 }}
//               >
//                 {content
//                   // Convert standalone **Title** lines to ### headings
//                   .replace(/^\*\*(.+?)\*\*$/gm, "### $1")
//                   // Convert ANY indented line (2+ spaces) to a markdown bullet
//                   .replace(/^([ \t]{2,})(\S)/gm, "- $2")
//                   .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_: string, inner: string) =>
//                     inner
//                       .replace(/\\text\{([^}]+)\}/g, "$1")
//                       .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
//                       .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
//                       .replace(/\\times/g, "×").replace(/\\cdot/g, "·")
//                       .replace(/\s+/g, " ").trim()
//                   )
//                   .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_: string, inner: string) =>
//                     inner
//                       .replace(/\\text\{([^}]+)\}/g, "$1")
//                       .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
//                       .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
//                       .replace(/\\times/g, "×").replace(/\s+/g, " ").trim()
//                   )
//                   .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
//                   .replace(/\\[a-zA-Z]+/g, "")
//                 }
//               </ReactMarkdown>
//             </div>
//           </>
//         )}
//       </div>

//       {/* User avatar */}
//       {isUser && (
//         <div style={{
//           width: 26, height: 26, borderRadius: "50%",
//           background: "#e2e8f0",
//           display: "flex", alignItems: "center", justifyContent: "center",
//           fontSize: 10, fontWeight: 700, color: "#64748b",
//           flexShrink: 0, marginTop: 2, fontFamily: F,
//         }}>U</div>
//       )}
//     </div>
//   );
// }















"use client";
// PATH: frontend/components/chat/ChatMessage.tsx
import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ReactECharts from "echarts-for-react";
import type { ChatChartBlock, ChatTableBlock, ChatDerivationBlock } from "@/lib/types";

interface Props {
  role: "user" | "assistant";
  content: string;
  chart?: ChatChartBlock;
  table?: ChatTableBlock;
  derivation?: ChatDerivationBlock;
}

const F = "Arial, Helvetica, sans-serif";
const BAIN_RED = "#E11C2A";

// ── Shared small button ───────────────────────────────────────────────────────
function DownloadBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 3,
        fontSize: 9, color: "#64748b", background: "#f8fafc",
        border: "1px solid #e2e8f0", borderRadius: 4,
        padding: "2px 6px", cursor: "pointer",
        fontFamily: F, whiteSpace: "nowrap", lineHeight: 1.4,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
    >
      {icon}{label}
    </button>
  );
}

const CsvIcon = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

const PngIcon = () => (
  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
  </svg>
);

// ── Inline chart ──────────────────────────────────────────────────────────────
function InlineChart({ block }: { block: ChatChartBlock }) {
  const chartRef    = useRef<any>(null);
  const modalRef    = useRef<any>(null);
  const [modal, setModal] = useState(false);

  const downloadCsv = () => {
    const headers = [block.x_key, ...block.series.map(s => s.name)];
    const rows = block.data.map(d =>
      [String(d[block.x_key]), ...block.series.map(s => String(d[s.data_key] ?? ""))]
    );
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "chart_data.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPng = (ref: any) => {
    try {
      const instance = ref?.current?.getEchartsInstance?.();
      if (!instance) return;
      const url = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#fff" });
      const a = document.createElement("a"); a.href = url; a.download = "chart.png"; a.click();
    } catch (e) { console.error("PNG download failed", e); }
  };

  const ExpandIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
      <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  );

  const CollapseIcon = () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
      <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
    </svg>
  );

  const buildOption = (confine: boolean) => {
    if (block.type === "pie") {
      const pieSeries = block.series[0];
      return {
        tooltip: { trigger: "item", confine },
        legend: { bottom: 0, textStyle: { fontSize: 12 } },
        series: [{
          type: "pie", radius: ["35%", "65%"],
          label: { fontSize: 11 },
          data: block.data.map(d => ({
            name: String(d[block.x_key]),
            value: d[pieSeries?.data_key ?? "value"],
          })),
        }],
      };
    }

    const barSeries = block.series.filter(s => s.type === "bar" || (!s.type && block.type === "bar"));
    const lineSeries = block.series.filter(s => s.type === "line");
    const xData = block.data.map(d => String(d[block.x_key]));

    const series: object[] = [
      ...barSeries.map(s => ({
        name: s.name, type: "bar", yAxisIndex: 0,
        data: block.data.map(d => d[s.data_key] ?? null),
        itemStyle: { color: s.color ?? "#1A1A1A", borderRadius: [2, 2, 0, 0] },
        barMaxWidth: 40,
      })),
      ...lineSeries.map(s => ({
        name: s.name, type: "line",
        yAxisIndex: lineSeries.length > 0 ? 1 : 0,
        data: block.data.map(d => d[s.data_key] ?? null),
        lineStyle: { color: s.color ?? BAIN_RED, width: 2 },
        itemStyle: { color: s.color ?? BAIN_RED },
        symbol: "circle", symbolSize: 5, smooth: 0.2,
      })),
    ];

    const yAxes: object[] = [{
      type: "value", name: block.y_label ?? "",
      nameTextStyle: { fontSize: 11, color: "#94a3b8" },
      axisLabel: { fontSize: 11, color: "#94a3b8" },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false }, axisTick: { show: false },
    }];
    if (lineSeries.length > 0) {
      yAxes.push({
        type: "value", name: block.y2_label ?? "",
        nameTextStyle: { fontSize: 11, color: "#94a3b8" },
        axisLabel: { fontSize: 11, color: "#94a3b8" },
        splitLine: { show: false },
        axisLine: { show: false }, axisTick: { show: false },
      });
    }

    return {
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, confine, appendToBody: false },
      legend: { bottom: 0, textStyle: { fontSize: 11 } },
      grid: { left: 52, right: lineSeries.length > 0 ? 52 : 16, top: 28, bottom: 64 },
      xAxis: {
        type: "category", data: xData,
        axisLabel: { fontSize: 11, color: "#94a3b8", rotate: xData.length > 5 ? -30 : 0, interval: 0, overflow: "truncate", width: 70 },
        axisLine: { lineStyle: { color: "#e2e8f0" } }, axisTick: { show: false },
      },
      yAxis: yAxes,
      series,
      animation: true,
    };
  };

  const btnRow = (
    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center", marginTop: 4 }}>
      <DownloadBtn label="CSV" icon={<CsvIcon />} onClick={downloadCsv} />
      <DownloadBtn label="PNG" icon={<PngIcon />} onClick={() => downloadPng(chartRef)} />
    </div>
  );

  return (
    <>
      {/* ── Inline chart with expand button overlay ── */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setModal(true)}
          title="Expand chart"
          style={{
            position: "absolute", top: 4, right: 4, zIndex: 10,
            width: 22, height: 22,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(255,255,255,0.92)", border: "1px solid #e2e8f0",
            borderRadius: 5, cursor: "pointer", color: "#64748b",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
        >
          <ExpandIcon />
        </button>
        <ReactECharts
          ref={chartRef}
          option={buildOption(true)}
          style={{ height: block.type === "pie" ? 200 : 220 }}
          notMerge
          opts={{ renderer: "canvas" }}
        />
      </div>
      {btnRow}

      {/* ── Modal overlay ── */}
      {modal && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          onClick={() => setModal(false)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 14, padding: 24,
              width: "min(90vw, 900px)", maxHeight: "85vh",
              boxShadow: "0 24px 64px rgba(0,0,0,0.25)",
              position: "relative", overflow: "hidden",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              {block.title && (
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", fontFamily: F }}>
                  {block.title}
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <DownloadBtn label="CSV" icon={<CsvIcon />} onClick={downloadCsv} />
                <DownloadBtn label="PNG" icon={<PngIcon />} onClick={() => downloadPng(modalRef)} />
                <button
                  onClick={() => setModal(false)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: 6,
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                    cursor: "pointer", color: "#64748b",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = BAIN_RED; e.currentTarget.style.color = BAIN_RED; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
                >
                  <CollapseIcon />
                </button>
              </div>
            </div>
            {/* Modal chart */}
            <ReactECharts
              ref={modalRef}
              option={buildOption(false)}
              style={{ height: "min(60vh, 500px)", width: "100%" }}
              notMerge
              opts={{ renderer: "canvas" }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── Table with CSV download ───────────────────────────────────────────────────
function InlineTable({ block }: { block: ChatTableBlock }) {
  const downloadCsv = () => {
    const rows = [block.headers.join(","), ...block.rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "chat_data.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ marginTop: 8 }}>
      {block.caption && (
        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, fontStyle: "italic" }}>
          {block.caption}
        </div>
      )}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr style={{ background: "#f1f5f9" }}>
              {block.headers.map((h, i) => (
                <th key={i} style={{
                  padding: "5px 8px", textAlign: "left", fontWeight: 700,
                  color: "#1e293b", borderBottom: "1px solid #e2e8f0",
                  whiteSpace: "nowrap", fontSize: 10, textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: "4px 8px", borderBottom: "1px solid #f1f5f9",
                    color: "#334155", whiteSpace: "nowrap", fontSize: 11,
                  }}>{String(cell)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        {block.source && (
          <span style={{ fontSize: 9, color: "#94a3b8" }}>Source: {block.source}</span>
        )}
        <div style={{ marginLeft: "auto" }}>
          <DownloadBtn label="CSV" icon={<CsvIcon />} onClick={downloadCsv} />
        </div>
      </div>
    </div>
  );
}

// ── Derivation dropdown ───────────────────────────────────────────────────────
function DerivationDropdown({ block }: { block: ChatDerivationBlock }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 8, border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "7px 12px", background: "#f8fafc", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600, color: "#475569", fontFamily: F,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={BAIN_RED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {block.title}
        </span>
        <span style={{ color: "#94a3b8", fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "8px 12px", background: "#fff", borderTop: "1px solid #f1f5f9" }}>
          {block.steps.map((step, i) => (
            <div key={i} style={{
              display: "flex", gap: 8,
              marginBottom: i < block.steps.length - 1 ? 6 : 0,
              fontSize: 11, color: "#475569", lineHeight: 1.5,
            }}>
              <span style={{
                flexShrink: 0, width: 18, height: 18, borderRadius: "50%",
                background: "#fef2f2", color: BAIN_RED, fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ChatMessage({ role, content, chart, table, derivation }: Props) {
  const isUser = role === "user";

  return (
    <div style={{
      display: "flex", alignItems: "flex-start",
      justifyContent: isUser ? "flex-end" : "flex-start",
      gap: 8, marginBottom: 14,
    }}>
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: BAIN_RED,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
          flexShrink: 0, marginTop: 2, fontFamily: F,
          boxShadow: "0 1px 4px rgba(230,0,0,0.3)",
        }}>C</div>
      )}

      <div style={{
        width: isUser ? "auto" : "100%",
        maxWidth: isUser ? "82%" : "100%",
        padding: isUser ? "8px 12px" : "14px 16px",
        borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
        fontFamily: F,
        background: isUser ? "#fff1f1" : "#ffffff",
        border: isUser ? "1px solid #fecaca" : "1px solid #e2e8f0",
        color: "#1e293b",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word",
      }}>
        {isUser ? (
          <span style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", fontWeight: 500 }}>
            {content}
          </span>
        ) : (
          <>
            <style>{`
              .chat-md { font-size: 13.5px; line-height: 1.75; color: #1e293b; font-family: Arial, Helvetica, sans-serif; }
              .chat-md p { margin: 0 0 10px 0; }
              .chat-md p:last-child { margin-bottom: 0; }
              .chat-md h1 { font-size: 15px; font-weight: 700; color: #0f172a; margin: 14px 0 6px; padding-bottom: 5px; border-bottom: 2px solid #E60000; }
              .chat-md h2 { font-size: 14px; font-weight: 700; color: #0f172a; margin: 12px 0 5px; padding-bottom: 3px; border-bottom: 1px solid #f1f5f9; }
              .chat-md h3 { font-size: 13px; font-weight: 700; color: #1e293b; margin: 10px 0 4px; }
              .chat-md h4 { font-size: 12.5px; font-weight: 600; color: #334155; margin: 8px 0 3px; }
              .chat-md h1:first-child, .chat-md h2:first-child, .chat-md h3:first-child { margin-top: 0; }
              .chat-md ul, .chat-md ol { margin: 6px 0 10px; padding-left: 22px; }
              .chat-md li { margin-bottom: 5px; font-size: 13.5px; line-height: 1.65; color: #1e293b; }
              .chat-md li:last-child { margin-bottom: 0; }
              .chat-md li > p { margin: 0; }
              .chat-md li ul, .chat-md li ol { margin: 4px 0; }
              .chat-md code { font-size: 12px; font-family: 'Courier New', monospace; background: #f1f5f9; color: #be123c; padding: 2px 6px; border-radius: 4px; border: 1px solid #e2e8f0; }
              .chat-md pre { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 10px 0; }
              .chat-md pre code { background: none; border: none; padding: 0; color: #334155; font-size: 12px; line-height: 1.65; }
              .chat-md blockquote { border-left: 4px solid #E60000; margin: 10px 0; padding: 8px 14px; background: linear-gradient(90deg,#fff7f7,#fffafa); border-radius: 0 8px 8px 0; }
              .chat-md blockquote p { margin: 0 0 4px; font-size: 13px; line-height: 1.65; }
              .chat-md blockquote p:last-child { margin-bottom: 0; }
              .chat-md table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 12px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
              .chat-md th { background: #f1f5f9; font-weight: 700; padding: 7px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; color: #1e293b; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.05em; }
              .chat-md th:last-child { border-right: none; }
              .chat-md td { padding: 7px 12px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; color: #334155; vertical-align: top; line-height: 1.55; }
              .chat-md td:last-child { border-right: none; }
              .chat-md tr:last-child td { border-bottom: none; }
              .chat-md tr:nth-child(even) td { background: #fafafa; }
              .chat-md a { color: #E60000; text-decoration: underline; word-break: break-all; overflow-wrap: anywhere; }
              .chat-md hr { border: none; border-top: 1px solid #f1f5f9; margin: 12px 0; }
              .chat-md strong { font-weight: 700; color: #0f172a; }
              .chat-md em { font-style: italic; color: #475569; }
            `}</style>

            <div className="chat-md">
              {/* @ts-ignore */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                }}
              >
                {content
                  .replace(/^\*\*(.+?)\*\*$/gm, "### $1")
                  .replace(/^([ \t]{2,})(\S)/gm, "- $2")
                  .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_: string, inner: string) =>
                    inner.replace(/\\text\{([^}]+)\}/g, "$1").replace(/\\left\(/g, "(")
                      .replace(/\\right\)/g, ")").replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
                      .replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/\s+/g, " ").trim()
                  )
                  .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_: string, inner: string) =>
                    inner.replace(/\\text\{([^}]+)\}/g, "$1")
                      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
                      .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
                      .replace(/\\times/g, "×").replace(/\s+/g, " ").trim()
                  )
                  .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
                  .replace(/\\[a-zA-Z]+/g, "")
                }
              </ReactMarkdown>
            </div>

            {chart && (
              <div style={{ marginTop: 12, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                {chart.title && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                    {chart.title}
                  </div>
                )}
                <InlineChart block={chart} />
              </div>
            )}

            {table && <InlineTable block={table} />}
            {derivation && <DerivationDropdown block={derivation} />}
          </>
        )}
      </div>

      {isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%", background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#64748b",
          flexShrink: 0, marginTop: 2, fontFamily: F,
        }}>U</div>
      )}
    </div>
  );
}