import { useState, useCallback } from "react";
import { sendChat } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";

/**
 * useChatStream — manages chat message state + API call for all pages.
 */
export function useChatStream(
  dataScope = "flat_file",
  currentFilters: Record<string, unknown> = {},
  chartContext: Record<string, unknown> = {},
) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Ask me about the data or what you see in the chart." },
  ]);
  const [loading,    setLoading]    = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = { role: "user", content: text };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setLoading(true);
      setError(null);

      try {
        const res = await sendChat({
          messages:        updated,
          current_filters: currentFilters,
          chart_context:   chartContext,
          mode:            webEnabled ? "web" : "dataset",
          data_scope:      dataScope,
        });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: res.data.answer },
        ]);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "An error occurred.";
        setError(msg);
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Sorry — I hit an error: ${msg}` },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [messages, currentFilters, chartContext, webEnabled, dataScope],
  );

  const reset = useCallback(() => {
    setMessages([
      { role: "assistant", content: "Ask me about the data or what you see in the chart." },
    ]);
    setError(null);
  }, []);

  return { messages, loading, webEnabled, setWebEnabled, send, reset, error };
}