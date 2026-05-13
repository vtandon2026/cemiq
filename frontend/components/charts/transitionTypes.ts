// PATH: frontend/components/charts/transitionTypes.ts
// Shared types and constants for transition readiness charts

export const REGION_COLORS: Record<string, string> = {
  "Europe":        "#2563eb",
  "North America": "#059669",
  "China":         "#E11C2A",
  "APAC":          "#d97706",
  "MEA":           "#7c3aed",
  "Latin America": "#0891b2",
  "Other":         "#94a3b8",
};

export const F = "Arial, Helvetica, sans-serif";

export interface MatrixRow {
  name: string;
  region: string;
  country: string;
  total_capacity: number;
  wet_share: number;
  dry_share: number;
  integrated_share: number;
  alt_fuel_pct: number;
  ccus_pct: number;
  clay_pct: number;
  new_plant_pct: number;
  carbon_exposure: number;
  readiness_score: number;
  future_ready_cap: number;
}

export interface HeatmapRow {
  technology: string;
  [region: string]: string | number;
}

export interface KPIs {
  future_readiness_score: number;
  alt_fuel_pct: number;
  ccus_pct: number;
  future_ready_cap: number;
  total_capacity: number;
}