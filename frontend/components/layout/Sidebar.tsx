// PATH: frontend/components/layout/Sidebar.tsx
"use client";
import { useState } from "react";

interface Props {
  children: React.ReactNode;
  title?: string;
}

// ── Shared label style for filter sections ────────────────────────────────────
export function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      color: "#94a3b8",
      textTransform: "uppercase" as const,
      letterSpacing: "0.08em",
      marginBottom: 5,
      fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      {children}
    </div>
  );
}

// ── Styled select ─────────────────────────────────────────────────────────────
export function FilterSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "6px 8px",
        fontSize: 12,
        fontWeight: 500,
        color: "#1e293b",
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: 6,
        cursor: "pointer",
        appearance: "auto",
        fontFamily: "Arial, Helvetica, sans-serif",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

// ── Styled range slider ───────────────────────────────────────────────────────
export function FilterSlider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <FilterLabel>{label}</FilterLabel>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: "var(--bain-red)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--bain-red)" }}
      />
    </div>
  );
}

// ── Styled checkbox item ──────────────────────────────────────────────────────
export function FilterCheckbox({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
}) {
  return (
    <label style={{
      display: "flex",
      alignItems: "center",
      gap: 7,
      fontSize: 12,
      color: "#374151",
      cursor: "pointer",
      fontFamily: "Arial, Helvetica, sans-serif",
      userSelect: "none",
    }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: color ?? "var(--bain-red)", width: 13, height: 13 }}
      />
      {color && (
        <span style={{
          width: 10, height: 10,
          borderRadius: 3,
          background: color,
          flexShrink: 0,
          display: "inline-block",
        }} />
      )}
      {label}
    </label>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function FilterDivider() {
  return <div style={{ height: 1, background: "#f1f5f9", margin: "2px 0" }} />;
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export default function Sidebar({ children, title = "Filters" }: Props) {
  const [open, setOpen] = useState(true);

  return (
    <aside style={{
      flexShrink: 0,
      width: open ? 228 : 34,
      minWidth: open ? 228 : 34,
      transition: "width 0.2s ease, min-width 0.2s ease",
      fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      <div style={{
        background: "#ffffff",
        border: "1px solid #e9ecef",
        borderRadius: 10,
        overflow: "hidden",
        height: "100%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        display: "flex",
        flexDirection: "column",
      }}>

        {/* ── Header ──────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          padding: open ? "10px 12px" : "10px 6px",
          borderBottom: "1px solid #f1f5f9",
          background: "#fafafa",
          flexShrink: 0,
          gap: 8,
        }}>
          {/* Funnel icon */}
          {open && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          )}
          {open && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: "#94a3b8",
              textTransform: "uppercase" as const,
              letterSpacing: "0.09em",
              flex: 1,
            }}>
              {title}
            </span>
          )}

          {/* Toggle button */}
          <button
            onClick={() => setOpen(!open)}
            title={open ? "Collapse filters" : "Expand filters"}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 22, height: 22,
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              cursor: "pointer",
              color: "#94a3b8",
              fontSize: 12,
              flexShrink: 0,
              transition: "all 0.13s",
              marginLeft: open ? 0 : "auto",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1";
              (e.currentTarget as HTMLButtonElement).style.color = "#475569";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "#ffffff";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
              (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8";
            }}
          >
            {open ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </button>
        </div>

        {/* ── Filter content ───────────────────────────── */}
        {open && (
          <div style={{
            padding: "12px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
            overflowY: "auto",
            flex: 1,
          }}>
            {children}
          </div>
        )}

        {/* ── Collapsed: show expand icon centered ─────── */}
        {!open && (
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
          </div>
        )}
      </div>
    </aside>
  );
}