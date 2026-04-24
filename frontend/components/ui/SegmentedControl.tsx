// PATH: frontend/components/ui/SegmentedControl.tsx
"use client";

interface Props {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  size?: "sm" | "md";
}

export default function SegmentedControl({ options, value, onChange, size = "md" }: Props) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  return (
    <div
      style={{
        display: "inline-flex",
        background: "#f1f5f9",
        borderRadius: 8,
        padding: 3,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`${pad} font-semibold rounded-md transition-all`}
            style={{
              background:    active ? "#ffffff" : "transparent",
              color:         active ? "var(--bain-red)" : "#64748b",
              boxShadow:     active
                ? "0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)"
                : "none",
              border:        "none",
              cursor:        "pointer",
              whiteSpace:    "nowrap" as const,
              letterSpacing: "-0.01em",
            }}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}