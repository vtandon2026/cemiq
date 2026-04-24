import { useState, useEffect, useCallback } from "react";
import { getMekkoData } from "@/lib/api";
import type { MekkoRow } from "@/lib/types";

export function useMekkoData(
  category: string,
  year: number,
  topN = 10,
  showOther = true,
  kpiFilters?: Record<string, string>,
) {
  const [data,    setData]    = useState<MekkoRow[]>([]);
  const [unit,    setUnit]    = useState("$ Mn");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!category || !year) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getMekkoData(category, year, topN, showOther, kpiFilters);
      setData(res.data.data);
      setUnit(res.data.unit);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load Mekko data");
    } finally {
      setLoading(false);
    }
  }, [category, year, topN, showOther, JSON.stringify(kpiFilters)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, unit, loading, error, refetch: fetch };
}