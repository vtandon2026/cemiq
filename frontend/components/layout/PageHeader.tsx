// PATH: frontend/components/layout/PageHeader.tsx
// Replaces <Banner /> on every chart page.
// Usage: <PageHeader title="Construction Overall" subtitle="Market Intelligence · GlobalData" />
"use client";

interface Props {
  title: string;
  subtitle?: string;
}

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      marginBottom: 20,
      paddingBottom: 16,
      borderBottom: "1px solid #f1f5f9",
      fontFamily: "Arial, Helvetica, sans-serif",
    }}>
      {/* Left: red bar + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <span style={{
          display: "inline-block",
          width: 4, height: 45,
          borderRadius: 4,
          background: "var(--bain-red)",
          flexShrink: 0,
        }} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 20, fontWeight: 800,
            color: "#0f172a", letterSpacing: "-0.3px", lineHeight: 1.2,
          }}>
            {title}
          </div>
          {subtitle && (
            <div style={{ fontSize: 14, color: "#94a3b8", fontWeight: 500, marginTop: 2 }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* Right: logos */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bainlogo.png" alt="Bain"
          style={{ height: 45, width: "auto", objectFit: "contain", opacity: 1 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div style={{ width: 1, height: 18, background: "#e2e8f0" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bcnlogo.png" alt="BCN"
          style={{ height: 45, width: "auto", objectFit: "contain", opacity: 1 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
    </div>
  );
}