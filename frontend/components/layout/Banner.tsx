// PATH: frontend/components/layout/Banner.tsx
"use client";

interface Props {
  title?: string;
  subtitle?: string;
}

export default function Banner({ title, subtitle }: Props) {
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
      {/* Left: page identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Red accent dot */}
        <span style={{
          display: "inline-block",
          width: 4,
          height: 28,
          borderRadius: 4,
          background: "var(--bain-red)",
          flexShrink: 0,
        }} />
        <div>
          {title && (
            <div style={{
              fontSize: 18,
              fontWeight: 800,
              color: "#0f172a",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{
              fontSize: 12,
              color: "#94a3b8",
              fontWeight: 500,
              marginTop: 1,
            }}>
              {subtitle}
            </div>
          )}
          {/* Fallback when no props passed — keep old behaviour */}
          {!title && !subtitle && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.2px" }}>
                CemIQ
              </span>
              <span style={{
                fontSize: 11,
                color: "#94a3b8",
                fontWeight: 500,
                paddingLeft: 8,
                borderLeft: "1px solid #e2e8f0",
              }}>
                Smarter diagnostics for cement and beyond
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right: logos */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bainlogo.png" alt="Bain"
          style={{ height: 28, width: "auto", objectFit: "contain", opacity: 0.7 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bcnlogo.png" alt="BCN"
          style={{ height: 28, width: "auto", objectFit: "contain", opacity: 0.7 }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      </div>
    </div>
  );
}