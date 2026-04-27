// PATH: frontend/lib/api.ts
// lib/api.ts — typed API client for all FastAPI endpoints

import axios from "axios";
import type {
  GrowthData, MekkoRow, ProfitPoolRow, PlantRow, UsMekkoRow,
  GlobalCementRow, GlobalCagrRow, StockPriceData, ExecSection,
  KpiPointRow, KpiTimeSeriesRow, ChatMessage,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_URL,
  timeout: 300_000,  // 5min — first load reads large Excel files into cache
});

// ── Simple GET response cache (meta endpoints never change mid-session) ──────
const _getCache = new Map<string, { data: unknown; ts: number }>();
const GET_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const cachedGet = <T>(url: string, params?: Record<string, unknown>) => {
  const key = url + JSON.stringify(params ?? {});
  const cached = _getCache.get(key);
  if (cached && Date.now() - cached.ts < GET_CACHE_TTL) {
    return Promise.resolve({ data: cached.data as T });
  }
  return api.get<T>(url, { params }).then((res) => {
    _getCache.set(key, { data: res.data, ts: Date.now() });
    return res;
  });
};

// Longer timeout only for chat (tool loop can be slow)
const chatApi = axios.create({
  baseURL: API_URL,
  timeout: 120_000,
});

// Global error interceptor — surfaces clear messages
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.code === "ECONNREFUSED" || err.message?.includes("Network Error")) {
      return Promise.reject(new Error("Cannot reach backend — is uvicorn running on port 8000?"));
    }
    if (err.code === "ECONNABORTED") {
      return Promise.reject(new Error("Request timed out — backend may be loading data for the first time."));
    }
    return Promise.reject(err);
  },
);

// ── Flat file ─────────────────────────────────────────────────────────────────
export const getFlatFileMeta = () =>
  cachedGet<{ categories: string[]; years: number[]; kpi_cols: string[] }>("/data/flat-file/meta");

export const getFlatFileRegions = (category?: string) =>
  cachedGet<{ regions: string[] }>("/data/flat-file/regions", { category });

export const getFlatFileCountries = (category?: string, region?: string) =>
  cachedGet<{ countries: string[] }>("/data/flat-file/countries", { category, region });

export const getMekkoData = (
  category: string,
  year: number,
  topN = 10,
  showOther = true,
  kpiFilters?: Record<string, string>,
) =>
  api.post<{ data: MekkoRow[]; year: number; category: string; unit: string }>(
    "/data/flat-file/mekko",
    { category, year, top_n: topN, show_other: showOther, kpi_filters: kpiFilters ?? null },
  );

export const getGrowthData = (
  category: string,
  region: string,
  country: string,
  kpiFilters?: Record<string, string>,
) =>
  api.post<GrowthData>("/data/flat-file/growth", {
    category, region, country,
    year_min: 2010, year_max: 2029,
    kpi_filters: kpiFilters ?? null,
  });

// ── CIQ / KPIs ────────────────────────────────────────────────────────────────
export const getCiqMeta = () =>
  cachedGet<{ companies: string[]; countries: string[]; years: number[] }>("/data/ciq/meta");

export const getCiqCompanies = (country?: string) =>
  cachedGet<{ companies: string[] }>("/data/ciq/companies", { country });

export const getCiqKpis = (payload: {
  kpi_key: string;
  year: number;
  companies: string[];
  country?: string;
  chart_mode: string;
  year_range_start?: number;
}) => api.post<{
  kpi_key: string;
  year: number;
  point_in_time?: KpiPointRow[];
  time_series?: KpiTimeSeriesRow[];
}>("/data/ciq/kpis", payload);

// ── Profit Pool ───────────────────────────────────────────────────────────────
export const getProfitPoolMeta = () =>
  cachedGet<{ years: number[]; regions: string[]; countries: string[] }>("/data/profit-pool/meta");

export const getProfitPoolCountries = (regions?: string[]) =>
  cachedGet<{ countries: string[] }>("/data/profit-pool/countries", { regions });

export const getProfitPoolChart = (
  year: number,
  selectedRegions?: string[],
  selectedCountries?: string[],
) =>
  api.post<{ data: ProfitPoolRow[]; year: number }>("/data/profit-pool/chart", {
    year,
    selected_regions:   selectedRegions   ?? null,
    selected_countries: selectedCountries ?? null,
  });

// ── GeoMap ────────────────────────────────────────────────────────────────────
export const getGeoMapMeta = () =>
  cachedGet<{
    companies: string[]; cap_min: number; cap_max: number;
    us_regions: string[]; states: string[]; cement_types: string[]; statuses: string[];
  }>("/data/geomap/meta");

export const getGeoMapPlants = (filters: {
  companies?: string[];
  cap_min?: number;
  cap_max?: number;
  status?: string[];
  cement_type?: string[];
  us_region?: string[];
}) =>
  api.post<{ plants: PlantRow[]; total: number; filtered: number }>(
    "/data/geomap/plants", filters,
  );

export const getGeoMapMekko = (filters: {
  companies?: string[];
  status?: string[];
  cement_type?: string[];
  us_region?: string[];
  top_n_state?: number;
  state_share_cutoff?: number;
}) => api.post<{ data: UsMekkoRow[] }>("/data/geomap/mekko", filters);

// ── Global Cement ─────────────────────────────────────────────────────────────
export const getGlobalCementMeta = () =>
  cachedGet<{ kpis: string[]; countries: string[]; years: number[] }>("/data/global-cement/meta");

export const getGlobalCementChart = (payload: {
  kpi: string;
  countries: string[];
  view: "time_series" | "point_in_time";
  year?: number;
}) =>
  api.post<{ data: GlobalCementRow[]; cagr: GlobalCagrRow[]; kpi: string; view: string }>(
    "/data/global-cement/chart", payload,
  );

// ── Cement Demand Growth ──────────────────────────────────────────────────────
export const getCementDemandMeta = () =>
  cachedGet<{ countries: string[]; kpis: string[] }>("/data/cement-demand/meta");

export const getCementDemandGrowth = (payload: {
  country: string;
  kpi?: string;
  year_min?: number;
  year_max?: number;
  cutoff_year?: number;
}) => api.post<GrowthData>("/data/cement-demand/growth", payload);


// ── Construction Detail ──────────────────────────────────────────────────────
export const getConstructionDetailMeta = () =>
  cachedGet<{
    regions: string[]; segments: string[];
    new_ren: string[];  sources: string[]; years: number[];
  }>("/construction-detail/meta");

export const getConstructionDetailCountries = (
  region?: string, segment?: string, new_ren?: string,
) =>
  cachedGet<{ countries: string[] }>(
    "/construction-detail/countries",
    { region, segment, new_ren },
  );

export const getConstructionDetailMekko = (payload: {
  year: number; top_n?: number; show_other?: boolean;
  segment?: string; new_ren?: string; source?: string;
}) => api.post<{ data: import("./types").MekkoRow[]; year: number }>(
  "/construction-detail/mekko", payload
);

export const getConstructionDetailGrowth = (payload: {
  region: string; country?: string;
  year_min?: number; year_max?: number;
  segment?: string; new_ren?: string; source?: string;
}) => api.post<import("./types").GrowthData>(
  "/construction-detail/growth", payload
);


// ── Stock Prices ──────────────────────────────────────────────────────────────
export const getStockPricesMeta = () =>
  cachedGet<{ years: number[]; countries: string[]; companies: string[] }>("/data/stock-prices/meta");

export const getStockPricesCompanies = (country?: string) =>
  cachedGet<{ companies: string[] }>("/data/stock-prices/companies", { country });

export const getStockPricesChart = (payload: {
  companies: string[];
  end_year: number;
  window_years: number;
  country?: string;
}) => api.post<StockPriceData>("/data/stock-prices/chart", payload);

// ── Exec Summary ──────────────────────────────────────────────────────────────
export const getExecSummaryCountries = () =>
  cachedGet<{ countries: string[] }>("/exec-summary/countries/list");

export const getExecSummary = (
  country: string,
  useWebReasons = true,
  useCache = true,
) =>
  api.get<{ country: string; sections: ExecSection[] }>(
    `/exec-summary/${encodeURIComponent(country)}`,
    { params: { use_web_reasons: useWebReasons, use_cache: useCache } },
  );

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendChat = (payload: {
  messages: ChatMessage[];
  current_filters: Record<string, unknown>;
  chart_context: Record<string, unknown>;
  mode?: "dataset" | "web";
  data_scope?: string;
}) => chatApi.post<{ answer: string }>("/chat/", payload);

// ── Export / think-cell ───────────────────────────────────────────────────────
export const exportPptx = (payload: {
  template: string;
  data: { name: string; table: unknown[][] }[];
  filename?: string;
}) =>
  api.post("/export/pptx", payload, { responseType: "blob" });

export const listTemplates = () =>
  api.get<Record<string, { exists: boolean; path: string }>>("/export/templates");

// ── Deck Builder ──────────────────────────────────────────────────────────────
export const getDeckMeta = () =>
  api.get<{ years: number[]; countries: string[]; companies: string[] }>("/deck/meta");

export const buildDeck = (payload: {
  country?: string;
  company?: string;
  year?: number;
  comparison_request?: {
    base_company: string;
    peer_companies: string[];
    kpi_selections: { kpi_key: string; chart_mode: string }[];
    year: number;
    country?: string;
    year_range_start?: number;
  };
}) => api.post("/deck/build", payload, { responseType: "blob" });

// ── Health ────────────────────────────────────────────────────────────────────
export const healthCheck = () => api.get<{ status: string }>("/health");
