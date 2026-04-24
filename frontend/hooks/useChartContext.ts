import { useState, useCallback } from "react";

/**
 * Maintains the chart context object sent to the chat panel.
 * Matches the shape expected by the FastAPI /chat/ endpoint.
 */
export function useChartContext(initial: Record<string, unknown> = {}) {
  const [chartContext, setChartContext] = useState<Record<string, unknown>>(initial);

  const updateContext = useCallback(
    (patch: Record<string, unknown>) => {
      setChartContext((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const resetContext = useCallback((newCtx: Record<string, unknown> = {}) => {
    setChartContext(newCtx);
  }, []);

  return { chartContext, updateContext, resetContext };
}