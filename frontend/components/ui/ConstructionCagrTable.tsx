// PATH: frontend/components/ui/ConstructionCagrTable.tsx
"use client";

const F = "Arial, Helvetica, sans-serif";
const BAIN_RED = "#E60000";

interface ConstructionCagrRow {
  period:             string;
  start:              number | null;
  end:                number | null;
  cagr:               number | null;
  globaldata_cagr:    number | null;
  ihs_cagr:           number | null;
  euroconstruct_cagr: number | null;
  weighted_avg_cagr:  number | null;
}

interface Props {
  rows:   ConstructionCagrRow[];
  label?: string;
}

function fmtNum(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function fmtCagr(v: number | null): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function cagrColor(v: number | null): string {
  if (v == null) return "#64748b";
  if (v > 0.05)  return "#16a34a";
  if (v > 0)     return "#2d8a4e";
  if (v < -0.02) return BAIN_RED;
  return "#64748b";
}

function CagrPill({ value }: { value: number | null }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      color: cagrColor(value),
      background: value == null
        ? "transparent"
        : value > 0
          ? "rgba(22,163,74,0.08)"
          : value < -0.02
            ? "rgba(230,0,0,0.07)"
            : "rgba(100,116,139,0.08)",
    }}>
      {fmtCagr(value)}
    </span>
  );
}

const HEADERS = [
  { label: "Period",              align: "left"  },
  { label: "Start",               align: "right" },
  { label: "End",                 align: "right" },
  { label: "GlobalData CAGR",     align: "right" },
  { label: "IHS CAGR",            align: "right" },
  { label: "Euroconstruct CAGR",  align: "right" },
  { label: "Weighted Avg CAGR",   align: "right" },
];

const tdBase: React.CSSProperties = {
  padding: "7px 12px",
  whiteSpace: "nowrap",
};

export default function ConstructionCagrTable({ rows, label = "CAGR Summary" }: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.07em",
        marginBottom: 8, fontFamily: F,
      }}>
        {label}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%", borderCollapse: "separate", borderSpacing: 0,
          fontSize: 13, fontFamily: F,
          border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden",
        }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {HEADERS.map((h, i) => (
                <th key={h.label} style={{
                  ...tdBase,
                  textAlign: h.align as "left" | "right",
                  fontWeight: 600, fontSize: 11, color: "#64748b",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  borderBottom: "1px solid #e2e8f0",
                  borderRight: i < HEADERS.length - 1 ? "1px solid #f1f5f9" : "none",
                }}>
                  {/* Highlight Weighted Avg header */}
                  {h.label === "Weighted Avg CAGR" ? (
                    <span style={{ color: "#1e293b", fontWeight: 700 }}>{h.label}</span>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isLast = i === rows.length - 1;
              const bdBottom = isLast ? "none" : "1px solid #f1f5f9";
              const bdRight  = "1px solid #f1f5f9";

              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                  {/* Period */}
                  <td style={{ ...tdBase, fontWeight: 600, color: "#1e293b", borderBottom: bdBottom, borderRight: bdRight }}>
                    {row.period}
                  </td>

                  {/* Start */}
                  <td style={{ ...tdBase, textAlign: "right", color: "#475569", borderBottom: bdBottom, borderRight: bdRight }}>
                    {fmtNum(row.start)}
                  </td>

                  {/* End */}
                  <td style={{ ...tdBase, textAlign: "right", color: "#475569", borderBottom: bdBottom, borderRight: bdRight }}>
                    {fmtNum(row.end)}
                  </td>

                  {/* GlobalData CAGR */}
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.globaldata_cagr} />
                  </td>

                  {/* IHS CAGR */}
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.ihs_cagr} />
                  </td>

                  {/* Euroconstruct CAGR */}
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.euroconstruct_cagr} />
                  </td>

                  {/* Weighted Avg CAGR — highlighted */}
                  <td style={{
                    ...tdBase, textAlign: "right",
                    borderBottom: bdBottom,
                    background: i % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                  }}>
                    <CagrPill value={row.weighted_avg_cagr} />
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Weight footnote */}
          <tfoot>
            <tr>
              <td colSpan={HEADERS.length} style={{
                padding: "6px 12px",
                fontSize: 10, color: "#94a3b8", fontFamily: F,
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
              }}>
                Weighted avg: GlobalData ×1 · IHS ×2 · Euroconstruct ×2
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}