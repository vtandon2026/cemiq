// PATH: frontend/components/ui/CagrTable.tsx
import type { CagrRow } from "@/lib/types";
import { fmtNum, fmtCagr } from "@/lib/chartHelpers";

interface Props {
  rows: CagrRow[];
  label?: string;
}

function cagrColor(v: number | null | undefined): string {
  if (v == null) return "#64748b";
  if (v > 0.05)  return "#16a34a"; // strong positive — green
  if (v > 0)     return "#2d8a4e"; // mild positive
  if (v < -0.02) return "var(--bain-red)"; // negative — red
  return "#64748b"; // near-zero — neutral
}

export default function CagrTable({ rows, label = "CAGR Overview" }: Props) {
  if (!rows || rows.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      {/* Header */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: "#94a3b8",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        marginBottom: 8,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>
        {label}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          fontSize: 13,
          fontFamily: "Arial, Helvetica, sans-serif",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
          overflow: "hidden",
        }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Period", "Start", "End", "CAGR"].map((h, i) => (
                <th key={h} style={{
                  padding: "8px 12px",
                  textAlign: i === 0 ? "left" : "right",
                  fontWeight: 600,
                  fontSize: 11,
                  color: "#64748b",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid #e2e8f0",
                  borderRight: i < 3 ? "1px solid #f1f5f9" : "none",
                  whiteSpace: "nowrap",
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{ background: i % 2 === 0 ? "#ffffff" : "#fafafa" }}
              >
                {/* Period */}
                <td style={{
                  padding: "7px 12px",
                  fontWeight: 600,
                  color: "#1e293b",
                  borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
                  borderRight: "1px solid #f1f5f9",
                }}>
                  {row.period}
                </td>

                {/* Start */}
                <td style={{
                  padding: "7px 12px",
                  textAlign: "right",
                  color: "#475569",
                  borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
                  borderRight: "1px solid #f1f5f9",
                }}>
                  {row.start != null ? fmtNum(row.start, 1) : "—"}
                </td>

                {/* End */}
                <td style={{
                  padding: "7px 12px",
                  textAlign: "right",
                  color: "#475569",
                  borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
                  borderRight: "1px solid #f1f5f9",
                }}>
                  {row.end != null ? fmtNum(row.end, 1) : "—"}
                </td>

                {/* CAGR — coloured + pill */}
                <td style={{
                  padding: "7px 12px",
                  textAlign: "right",
                  borderBottom: i < rows.length - 1 ? "1px solid #f1f5f9" : "none",
                }}>
                  <span style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    color: cagrColor(row.cagr),
                    background: row.cagr == null
                      ? "transparent"
                      : row.cagr > 0
                        ? "rgba(22,163,74,0.08)"
                        : row.cagr < -0.02
                          ? "rgba(230,0,0,0.07)"
                          : "rgba(100,116,139,0.08)",
                  }}>
                    {fmtCagr(row.cagr)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}