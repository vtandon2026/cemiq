// lib/types.ts  — shared TypeScript types across all pages

// ── Flat file / Market Intelligence ──────────────────────────────────────────
export interface MekkoRow {
  Region: string;
  Country: string;
  value: number;
}

export interface GrowthData {
  years: number[];
  revenue: Record<string, number | null>;
  yoy: Record<string, number | null>;
  cagr: CagrRow[];
  cutoff_year: number;
}

export interface CagrRow {
  period: string;
  start: number | null;
  end: number | null;
  cagr: number | null;
}

// ── CIQ / KPI ────────────────────────────────────────────────────────────────
export interface KpiPointRow {
  Company: string;
  Ticker: string;
  Country: string;
  [key: string]: string | number | null;
}

export interface KpiTimeSeriesRow {
  Year: number;
  Company: string;
  Ticker: string;
  Country: string;
  Value: number;
}

// ── Profit Pool ───────────────────────────────────────────────────────────────
export interface ProfitPoolRow {
  Category: string;
  Revenue: number;
  EBITDA: number;
  EBITDA_margin: number;
  width: number;
  is_other: boolean;
  constituent_categories?: string[];
}

// ── GeoMap ────────────────────────────────────────────────────────────────────
export interface PlantRow {
  company: string;
  plant: string;
  cement_capacity_mta: number;
  cement_type: string;
  state: string;
  city: string;
  us_region: string;
  lat: number;
  lon: number;
  status: string;
}

export interface UsMekkoRow {
  "US Region": string;
  State: string;
  Producer: string;
  Capacity: number;
  StateTotal: number;
  Share: number;
}

// ── Global Cement ─────────────────────────────────────────────────────────────
export interface GlobalCementRow {
  Country: string;
  Year: number;
  Value: number;
}

export interface GlobalCagrRow {
  Country: string;
  [period: string]: number | null | string;
}

// ── Stock Prices ──────────────────────────────────────────────────────────────
export interface StockPriceData {
  dates: string[];
  series: Record<string, (number | null)[]>;
  raw_prices: Record<string, (number | null)[]>;
  cagr: StockCagrRow[];
  window: { start_year: number; end_year: number };
}

export interface StockCagrRow {
  Company: string;
  start_date: string;
  end_date: string;
  start_price: number;
  end_price: number;
  cagr: number | null;
}

// ── Chat ──────────────────────────────────────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Exec Summary ──────────────────────────────────────────────────────────────
export interface ExecSection {
  category: string;
  country: string;
  region: string;
  headline: string;
  bullets: string[];
  band_label: string;
  country_cagr: number | null;
  region_cagr: number | null;
  delta_pp: number | null;
  takeaway: string;
  source_refs: { title: string; url: string; domain: string }[];
  quality_status: string;
  quality_message: string;
}

// ── Deck Builder ──────────────────────────────────────────────────────────────
export interface KpiSelectionRow {
  category: string;
  kpi_label: string;
  chart_mode_label: string;
}

// ── Chatbot Interface ──────────────────────────────────────────────────────────────

export interface ChartSeries {
  name: string;
  data_key: string;
  type?: "bar" | "line" | "pie";
  color?: string;
}

export interface ChatChartBlock {
  type: "bar" | "line" | "bar_line" | "pie";
  title?: string;
  x_key: string;
  series: ChartSeries[];
  data: Record<string, string | number>[];
  x_label?: string;
  y_label?: string;
  y2_label?: string;
}

export interface ChatTableBlock {
  headers: string[];
  rows: (string | number)[][];
  source?: string;
  caption?: string;
}

export interface ChatDerivationBlock {
  title: string;
  steps: string[];
}

export interface ChatApiResponse {
  answer: string;
  sources?: { title: string; url: string }[];
  chart?: ChatChartBlock;
  table?: ChatTableBlock;
  derivation?: ChatDerivationBlock;
}

// Extended message type to carry structured blocks
export interface ChatMessageFull {
  role: "user" | "assistant";
  content: string;
  chart?: ChatChartBlock;
  table?: ChatTableBlock;
  derivation?: ChatDerivationBlock;
}