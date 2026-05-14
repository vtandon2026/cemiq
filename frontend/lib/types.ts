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

// ── Carbon Problem (ESG & Future Tech) ───────────────────────────────────────
export interface CarbonMeta {
  countries:   string[];
  companies:   string[];
  plant_types: string[];
  statuses:    string[];
}
 
export interface CarbonKpis {
  total_cement_capacity:  number;
  total_clinker_capacity: number;
  pct_wet_capacity:       number | null;
  pct_alt_fuel:           number | null;
  plant_count:            number;
}
 
export interface CarbonHeroRow {
  label:     string;        // company name OR plant name
  dry:       number;
  wet:       number;
  mixed:     number;
  unknown:   number;
  total:     number;
  is_other?: boolean;
}
 
export interface CarbonHeroData {
  data:        CarbonHeroRow[];
  x_axis_type: "company" | "plant";
  unit:        string;
  is_drilled?: boolean;
}
 
export interface CarbonMapPoint {
  plant_name:        string;
  company:           string;
  country:           string;
  lat:               number;
  lon:               number;
  cement_capacity:   number | null;
  clinker_capacity:  number;
  production_type:   "dry" | "wet" | "mixed";
  ccs:               boolean | null;
  alt_fuel:          boolean | null;
  plant_type:        string;
}
 
export interface CarbonMapData {
  data:  CarbonMapPoint[];
  count: number;
}
 
export interface CarbonIntegratedGrindingRow {
  plant_type: string;
  capacity:   number;
}
 
export interface CarbonIntegratedGrindingData {
  data: CarbonIntegratedGrindingRow[];
  unit: string;
}
 
export interface CarbonPlantAgeRow {
  bucket:   string;
  count:    number;
  capacity: number;
}
 
export interface CarbonPlantAgeData {
  data:           CarbonPlantAgeRow[];
  reference_year: number;
  unit:           string;
}

// ── Green Future (ESG & Future Tech) ─────────────────────────────────────────
export interface GreenTechOption {
  value: "ccus" | "clay" | "alt_fuel" | "low_clinker";
  label: string;
}
 
export interface GreenMeta {
  regions:           string[];
  countries:         string[];
  companies:         string[];
  statuses:          string[];
  tech_types:        GreenTechOption[];
  country_to_region: Record<string, string>;
}
 
export interface GreenKpis {
  pct_ccus:         number | null;
  pct_clay:         number | null;
  pct_low_clinker:  number | null;
  future_ready_cap: number;       // absolute Mtpa
  total_cap:        number;
  plant_count:      number;
}
 
export type GreenTechTag = "ccus" | "clay" | "alt_fuel";
 
export interface GreenMapPoint {
  plant_name:        string;
  company:           string;
  country:           string;
  lat:               number;
  lon:               number;
  cement_capacity:   number | null;
  clinker_capacity:  number | null;
  size_cap:          number;     // capacity used for bubble sizing
  tech_tag:          GreenTechTag;
  ccus:              boolean;
  clay:              boolean;
  alt_fuel:          boolean;
}
 
export interface GreenMapData {
  data:  GreenMapPoint[];
  count: number;
}
 
export interface GreenScatterPoint {
  label:               string;
  clinker_dependency:  number;
  adoption_score:      number;
  capacity:            number;
  region:              string;
  plant_count:         number;
}
 
export interface GreenScatterData {
  data:     GreenScatterPoint[];
  group_by: "company" | "region";
}
 
export interface GreenCapacityMixRow {
  label:             string;
  legacy:            number;
  transitioning:     number;
  future_ready:      number;
  total:             number;
  pct_legacy:        number;
  pct_transitioning: number;
  pct_future_ready:  number;
}
 
export interface GreenCapacityMixData {
  data:     GreenCapacityMixRow[];
  group_by: "company" | "region";
  unit:     string;
}
 
export interface GreenHeatmapCell {
  tech:       GreenTechTag;
  tech_label: string;
  region:     string;
  value:      number | null;     // % (null if region has zero capacity)
  cap:        number;
}
 
export interface GreenHeatmapData {
  data:    GreenHeatmapCell[];
  regions: string[];
  techs:   { value: GreenTechTag; label: string }[];
  unit:    string;
}