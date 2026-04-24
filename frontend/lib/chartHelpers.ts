// lib/chartHelpers.ts — color palettes, CAGR utils, chart formatting helpers

// ── Bain region palette (matches Streamlit BAIN_REGION_SHADE_FAMILIES) ────────
export const REGION_PALETTES: string[][] = [
  ["#2D475A", "#46647B", "#7891AA", "#A3BCD3", "#DCE5EA"],
  ["#640A40", "#973B74", "#BA749F", "#D9ABC6", "#EED6E5"],
  ["#AB8933", "#C6AA3D", "#E9CD49", "#F2DE8A", "#FAEEC3"],
  ["#104C3E", "#507867", "#83AC9A", "#BBCABA", "#DCE2D6"],
  ["#333333", "#5C5C5C", "#858585", "#B4B4B4", "#D6D6D6"],
];

// ── US Mekko producer palette (matches Streamlit COLOR_MAP_BASE) ──────────────
export const PRODUCER_COLOR_MAP: Record<string, string> = {
  "Holcim":                "#1A1A1A",
  "Heidelberg":            "#5C5C5C",
  "CRH":                   "#2F2F2F",
  "Cemex":                 "#9A9A9A",
  "Quikrete":              "#2C4A63",
  "Buzzi":                 "#6E8AA7",
  "Eagle Materials":       "#385A78",
  "GCC":                   "#3C7F6D",
  "National Cement Group": "#0B5A4F",
  "CalPortland":           "#9FB9D4",
  "Titan":                 "#4E6A7D",
  "Other":                 "#D9D9D9",
};

export const AUTO_COLORS: string[] = [
  "#404040","#707070","#B0B0B0","#2E526B","#4B6C88",
  "#7C97B2","#A7BDD2","#2F6B5F","#4E8A7C","#77A99D",
  "#A4CEC4","#3A4B57","#5A6B78","#8C9AA6",
];

export const COMPARE_PALETTE: string[] = [
  "#1E88E5","#2E7D32","#F57C00","#6A1B9A","#455A64",
  "#00897B","#C62828","#6D4C41","#3949AB","#7CB342",
  "#FB8C00","#8E24AA","#546E7A","#43A047","#D81B60",
  "#5E35B1","#00ACC1","#F4511E","#757575","#9E9D24",
  "#039BE5","#8D6E63","#C0CA33","#26A69A",
];

export const BAIN_RED  = "#E11C2A";
export const BAIN_GREY = "#B0B0B0";
export const BAIN_NAVY = "#2C5AA0";

// ── Color utilities ───────────────────────────────────────────────────────────
export function hexToRgba(hex: string, alpha = 1): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function textColorFor(bgHex: string): string {
  return luminance(bgHex) < 0.35 ? "#FFFFFF" : "#111111";
}

export function producerColor(name: string, index: number): string {
  if (PRODUCER_COLOR_MAP[name]) return PRODUCER_COLOR_MAP[name];
  return AUTO_COLORS[index % AUTO_COLORS.length];
}

export function regionColor(regionIndex: number, countryIndex: number): string {
  const palette = REGION_PALETTES[regionIndex % REGION_PALETTES.length];
  return palette[Math.min(countryIndex, palette.length - 1)];
}

// ── Number formatting ────────────────────────────────────────────────────────
export function fmtNum(v: number | null | undefined, decimals = 0): string {
  if (v == null || isNaN(v)) return "—";
  return v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (v == null || isNaN(v)) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

export function fmtCagr(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "n/a";
  return `${(v * 100).toFixed(2)}%`;
}

// ── CAGR ─────────────────────────────────────────────────────────────────────
export function computeCagr(
  startVal: number | null,
  endVal: number | null,
  years: number,
): number | null {
  if (!startVal || !endVal || startVal <= 0 || endVal <= 0 || years <= 0) return null;
  return (endVal / startVal) ** (1 / years) - 1;
}

// ── Download helper (triggers browser download from blob) ─────────────────────
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1000);
}