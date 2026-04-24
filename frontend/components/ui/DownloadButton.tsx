// PATH: frontend/components/ui/DownloadButton.tsx
"use client";

interface Props {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "csv" | "ppt" | "png" | "default";
}

const ICONS: Record<string, React.ReactNode> = {
  csv: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  ppt: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  png: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  default: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
};

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  csv: {
    background: "#ffffff",
    color:      "#374151",
    border:     "1px solid #e2e8f0",
  },
  ppt: {
    background: "var(--bain-red)",
    color:      "#ffffff",
    border:     "1px solid transparent",
  },
  png: {
    background: "var(--bain-red)",
    color:      "#ffffff",
    border:     "1px solid transparent",
  },
  default: {
    background: "#ffffff",
    color:      "#374151",
    border:     "1px solid #e2e8f0",
  },
};

const HOVER_STYLES: Record<string, React.CSSProperties> = {
  csv:     { background: "#f8fafc", borderColor: "#cbd5e1" },
  ppt:     { opacity: 0.88 },
  png:     { opacity: 0.88 },
  default: { background: "#f8fafc", borderColor: "#cbd5e1" },
};

export default function DownloadButton({
  label,
  onClick,
  disabled = false,
  loading = false,
  variant = "default",
}: Props) {
  const defaultLabels = { csv: "CSV", ppt: "PPT", png: "PNG", default: "Download" };
  const displayLabel = label ?? defaultLabels[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={(e) => {
        if (disabled || loading) return;
        Object.assign((e.currentTarget as HTMLButtonElement).style, HOVER_STYLES[variant]);
      }}
      onMouseLeave={(e) => {
        Object.assign((e.currentTarget as HTMLButtonElement).style, VARIANT_STYLES[variant]);
      }}
      style={{
        display:        "inline-flex",
        alignItems:     "center",
        gap:            6,
        padding:        "6px 12px",
        fontSize:       13,
        fontWeight:     600,
        borderRadius:   7,
        cursor:         disabled || loading ? "not-allowed" : "pointer",
        opacity:        disabled || loading ? 0.45 : 1,
        boxShadow:      "0 1px 2px rgba(0,0,0,0.06)",
        transition:     "all 0.14s ease",
        whiteSpace:     "nowrap" as const,
        fontFamily:     "Arial, Helvetica, sans-serif",
        letterSpacing:  "-0.01em",
        ...VARIANT_STYLES[variant],
      }}
    >
      {loading
        ? <span style={{ opacity: 0.6 }}>…</span>
        : (
          <>
            {ICONS[variant]}
            {displayLabel}
          </>
        )
      }
    </button>
  );
}