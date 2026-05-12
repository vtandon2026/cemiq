// PATH: frontend/components/ui/MultiSelect.tsx
"use client";
import { useEffect, useMemo, useRef, useState } from "react";

interface Props {
  label?:        string;
  options:       string[];
  selected:      string[];           // empty array = "all"
  onChange:      (next: string[]) => void;
  placeholder?:  string;
  allLabel?:     string;             // default "All"
  searchable?:   boolean;            // default true
  maxHeight?:    number;             // dropdown max height in px
  loading?:      boolean;
}

const F = "Arial, Helvetica, sans-serif";
const BAIN_RED = "#E60000";

/**
 * Searchable multi-select dropdown.
 * - `selected = []` is treated as "All" (selecting nothing = all).
 * - Clicking "All" clears the selection.
 * - Visual chip count truncates to 1 with "+N more" when many are selected.
 * - Click outside to close.
 */
export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  allLabel = "All",
  searchable = true,
  maxHeight = 260,
  loading = false,
}: Props) {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Reset search when closing
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => o.toLowerCase().includes(q));
  }, [options, query]);

  const isAll = selected.length === 0;

  const triggerLabel =
    isAll ? allLabel
    : selected.length === 1 ? selected[0]
    : `${selected[0]} +${selected.length - 1}`;

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter(v => v !== value));
    else onChange([...selected, value]);
  };

  const selectAll = () => onChange([]);

  return (
    <div ref={ref} style={{ position: "relative", fontFamily: F }}>
      {label && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#475569",
          marginBottom: 4, fontFamily: F,
        }}>
          {label}
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        style={{
          width: "100%", textAlign: "left",
          padding: "6px 30px 6px 10px",
          background: "#fff",
          border: `1px solid ${open ? BAIN_RED : "#e2e8f0"}`,
          borderRadius: 6,
          fontSize: 12, fontWeight: 500,
          color: isAll ? "#94a3b8" : "#1e293b",
          cursor: loading ? "wait" : "pointer",
          fontFamily: F,
          position: "relative",
          minHeight: 30,
          transition: "border-color 0.15s",
          boxShadow: open ? `0 0 0 3px rgba(230,0,0,0.1)` : "none",
        }}
      >
        <span style={{
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {loading ? "Loading…" : triggerLabel || placeholder}
        </span>
        <svg
          style={{
            position: "absolute", right: 8, top: "50%",
            transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
            transition: "transform 0.15s",
          }}
          width="12" height="12" viewBox="0 0 20 20" fill="#94a3b8"
        >
          <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0,
          marginTop: 4, background: "#fff",
          border: "1px solid #e2e8f0", borderRadius: 8,
          boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
          zIndex: 50, overflow: "hidden",
          fontFamily: F,
        }}>
          {/* Search box */}
          {searchable && (
            <div style={{ padding: 6, borderBottom: "1px solid #f1f5f9" }}>
              <input
                autoFocus
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                style={{
                  width: "100%", padding: "5px 8px",
                  border: "1px solid #e2e8f0", borderRadius: 5,
                  fontSize: 11.5, fontFamily: F, outline: "none",
                  background: "#f8fafc",
                }}
              />
            </div>
          )}

          {/* "All" pseudo-option */}
          <button
            type="button"
            onClick={selectAll}
            style={{
              width: "100%", textAlign: "left",
              padding: "6px 10px",
              border: "none",
              background: isAll ? "#fef2f2" : "#fff",
              fontSize: 12, fontWeight: 600,
              color: isAll ? BAIN_RED : "#1e293b",
              cursor: "pointer", fontFamily: F,
              borderBottom: "1px solid #f1f5f9",
            }}
            onMouseEnter={e => { if (!isAll) (e.target as HTMLElement).style.background = "#f8fafc"; }}
            onMouseLeave={e => { if (!isAll) (e.target as HTMLElement).style.background = "#fff"; }}
          >
            {isAll ? "✓ " : ""}{allLabel}
          </button>

          {/* Option list */}
          <div style={{ maxHeight, overflowY: "auto", padding: "2px 0" }}>
            {filtered.length === 0 ? (
              <div style={{
                padding: "10px 12px", fontSize: 11.5,
                color: "#94a3b8", textAlign: "center", fontFamily: F,
              }}>
                No matches
              </div>
            ) : filtered.map(opt => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "5px 10px", cursor: "pointer", fontFamily: F,
                    background: checked ? "#fef2f2" : "transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!checked) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(opt)}
                    style={{ accentColor: BAIN_RED, cursor: "pointer", flexShrink: 0 }}
                  />
                  <span style={{
                    fontSize: 11.5,
                    color: checked ? BAIN_RED : "#1e293b",
                    fontWeight: checked ? 600 : 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Footer hint */}
          {selected.length > 0 && (
            <div style={{
              padding: "5px 10px", borderTop: "1px solid #f1f5f9",
              fontSize: 10, color: "#94a3b8", fontFamily: F,
              display: "flex", justifyContent: "space-between",
            }}>
              <span>{selected.length} selected</span>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  background: "none", border: "none",
                  color: BAIN_RED, cursor: "pointer",
                  fontSize: 10, fontWeight: 600, fontFamily: F,
                  padding: 0,
                }}
              >
                Clear / All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}