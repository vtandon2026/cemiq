import { useState, useEffect, useCallback } from "react";
import { getGrowthData } from "@/lib/api";
import type { GrowthData } from "@/lib/types";

export function useGrowthData(
  category: string,
  region: string,
  country: string,
  kpiFilters?: Record<string, string>,
) {
  const [data,    setData]    = useState<GrowthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!category || !region || !country) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getGrowthData(category, region, country, kpiFilters);
      setData(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load growth data");
    } finally {
      setLoading(false);
    }
  }, [category, region, country, JSON.stringify(kpiFilters)]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}