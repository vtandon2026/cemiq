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
  bain_pov_cagr?:     number | null;
  bain_pov_range?:    string | null;
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
  const pct = (v * 100).toFixed(1);
  return `${v >= 0 ? "+" : ""}${pct}%`;
}

function cagrColor(v: number | null): string {
  if (v == null) return "#64748b";
  if (v > 0.05)  return "#16a34a";
  if (v > 0)     return "#2d8a4e";
  if (v < -0.02) return BAIN_RED;
  return "#64748b";
}

function CagrPill({ value, range }: { value: number | null; range?: string | null }) {
  return (
    <span style={{
      display: "inline-flex", flexDirection: "column", alignItems: "flex-end",
    }}>
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
      {range && (
        <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 1, paddingRight: 8 }}>
          {range}
        </span>
      )}
    </span>
  );
}

const tdBase: React.CSSProperties = {
  padding: "7px 12px",
  whiteSpace: "nowrap",
};

export default function ConstructionCagrTable({ rows, label = "CAGR Summary" }: Props) {
  if (!rows || rows.length === 0) return null;

  const hasBainPov = rows.some(r => r.bain_pov_cagr != null || r.bain_pov_range != null);

  const HEADERS = [
    { label: "Period",              align: "left"  },
    { label: "Start",               align: "right" },
    { label: "End",                 align: "right" },
    { label: "GlobalData CAGR",     align: "right" },
    { label: "IHS CAGR",            align: "right" },
    { label: "Euroconstruct CAGR",  align: "right" },
    { label: "Weighted Avg CAGR",   align: "right" },
    ...(hasBainPov ? [{ label: "Bain POV", align: "right" }] : []),
  ];

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
                  {h.label === "Weighted Avg CAGR" ? (
                    <span style={{ color: "#1e293b", fontWeight: 700 }}>{h.label}</span>
                  ) : h.label === "Bain POV" ? (
                    <span style={{ color: BAIN_RED, fontWeight: 700 }}>{h.label}</span>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isLast   = i === rows.length - 1;
              const bdBottom = isLast ? "none" : "1px solid #f1f5f9";
              const bdRight  = "1px solid #f1f5f9";

              return (
                <tr key={i} style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}>
                  <td style={{ ...tdBase, fontWeight: 600, color: "#1e293b", borderBottom: bdBottom, borderRight: bdRight }}>
                    {row.period}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", color: "#475569", borderBottom: bdBottom, borderRight: bdRight }}>
                    {fmtNum(row.start)}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", color: "#475569", borderBottom: bdBottom, borderRight: bdRight }}>
                    {fmtNum(row.end)}
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.globaldata_cagr} />
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.ihs_cagr} />
                  </td>
                  <td style={{ ...tdBase, textAlign: "right", borderBottom: bdBottom, borderRight: bdRight }}>
                    <CagrPill value={row.euroconstruct_cagr} />
                  </td>
                  <td style={{
                    ...tdBase, textAlign: "right",
                    borderBottom: bdBottom,
                    borderRight: hasBainPov ? bdRight : "none",
                    background: i % 2 === 0 ? "#f8fafc" : "#f1f5f9",
                  }}>
                    <CagrPill value={row.weighted_avg_cagr} />
                  </td>
                  {hasBainPov && (
                    <td style={{
                      ...tdBase, textAlign: "right",
                      borderBottom: bdBottom,
                      background: i % 2 === 0 ? "#fff7f7" : "#fff0f0",
                    }}>
                      <CagrPill
                        value={row.bain_pov_cagr ?? null}
                        range={row.bain_pov_range ?? null}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <td colSpan={HEADERS.length} style={{
                padding: "6px 12px",
                fontSize: 10, color: "#94a3b8", fontFamily: F,
                borderTop: "1px solid #f1f5f9",
                background: "#fafafa",
              }}>
                Weighted avg: GlobalData ×1 · IHS ×2 · Euroconstruct ×2
                {hasBainPov && " · Bain POV: internal Bain Wave 4 forecast"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}