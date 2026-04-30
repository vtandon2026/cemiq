// // PATH: frontend/components/chat/ChatPanel.tsx
// "use client";
// import { useState, useRef, useEffect } from "react";
// import { sendChat } from "@/lib/api";
// import ChatMessage from "./ChatMessage";
// import ChatInput from "./ChatInput";
// import type { ChatMessage as ChatMessageType } from "@/lib/types";

// interface Props {
//   currentFilters: Record<string, unknown>;
//   chartContext:   Record<string, unknown>;
//   dataScope?:     string;
//   title?:         string;
// }

// function TypingDots() {
//   return (
//     <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
//       <div style={{
//         width: 24, height: 24, borderRadius: "50%",
//         background: "var(--bain-red)",
//         display: "flex", alignItems: "center", justifyContent: "center",
//         fontSize: 10, fontWeight: 800, color: "#fff",
//         flexShrink: 0, marginTop: 1,
//         fontFamily: "Arial, Helvetica, sans-serif",
//       }}>C</div>
//       <div style={{
//         background: "#ffffff",
//         border: "1px solid #e9ecef",
//         borderRadius: "4px 12px 12px 12px",
//         padding: "10px 14px",
//         display: "flex", gap: 5, alignItems: "center",
//         boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
//       }}>
//         {[0, 1, 2].map((i) => (
//           <span key={i} style={{
//             width: 7, height: 7, borderRadius: "50%",
//             background: "#cbd5e1", display: "inline-block",
//             animation: "chat-bounce 1.2s infinite",
//             animationDelay: `${i * 0.18}s`,
//           }} />
//         ))}
//       </div>
//     </div>
//   );
// }

// export default function ChatPanel({
//   currentFilters,
//   chartContext,
//   dataScope = "flat_file",
//   title = "Construct Lens",
// }: Props) {
//   const storageKey = `chat_history_${title ?? "default"}`;

//   const [messages, setMessages] = useState<ChatMessageType[]>([
//     { role: "assistant", content: "Ask me about the data or what you see in the chart." },
//   ]);
//   const [hydrated, setHydrated] = useState(false);

//   // Load from sessionStorage after mount (avoids SSR hydration mismatch)
//   useEffect(() => {
//     try {
//       const saved = sessionStorage.getItem(storageKey);
//       if (saved) {
//         const parsed = JSON.parse(saved) as ChatMessageType[];
//         if (parsed.length > 0) setMessages(parsed);
//       }
//     } catch (_) {}
//     setHydrated(true);
//   // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [storageKey]);
//   const [webEnabled, setWebEnabled] = useState(false);
//   const [loading, setLoading]       = useState(false);
//   const bottomRef    = useRef<HTMLDivElement>(null);
//   const messagesRef  = useRef<HTMLDivElement>(null);

//   // Persist chat history to sessionStorage on every update
//   useEffect(() => {
//     if (typeof window !== "undefined") {
//       try {
//         sessionStorage.setItem(storageKey, JSON.stringify(messages));
//       } catch (_) {}
//     }
//   }, [messages, storageKey]);

//   useEffect(() => {
//     const el = messagesRef.current;
//     if (el) el.scrollTop = el.scrollHeight;
//   }, [messages, loading]);

//   const [retryPayload, setRetryPayload] = useState<null | {
//     messages: ChatMessageType[];
//     filters: Record<string, unknown>;
//     ctx: Record<string, unknown>;
//   }>(null);

//   const doSend = async (
//     msgs: ChatMessageType[],
//     filters: Record<string, unknown>,
//     ctx: Record<string, unknown>,
//     attempt = 1,
//   ) => {
//     setLoading(true);
//     setRetryPayload(null);
//     try {
//       const res = await sendChat({
//         messages:        msgs,
//         current_filters: filters,
//         chart_context:   ctx,
//         mode:            webEnabled ? "web" : "dataset",
//         data_scope:      dataScope,
//       });
//       setMessages((prev) => [...prev, { role: "assistant", content: res.data.answer }]);
//       setLoading(false);
//     } catch (err: unknown) {
//       if (attempt < 2) {
//         // Auto-retry once
//         setTimeout(() => doSend(msgs, filters, ctx, attempt + 1), 800);
//         return;
//       }
//       const errMsg = err instanceof Error ? err.message : "Unknown error";
//       setMessages((prev) => [
//         ...prev,
//         {
//           role: "assistant",
//           content: `I encountered an issue: ${errMsg.includes("500") ? "the server had an error processing your request" : errMsg}. You can retry below.`,
//         },
//       ]);
//       setRetryPayload({ messages: msgs, filters, ctx });
//       setLoading(false);
//     }
//   };

//   const handleSend = async (text: string) => {
//     const userMsg: ChatMessageType = { role: "user", content: text };
//     const updated = [...messages, userMsg];
//     setMessages(updated);
//     setLoading(true);
//     await doSend(updated, currentFilters as Record<string, unknown>, chartContext as Record<string, unknown>);
//   };

//   const handleRetry = () => {
//     if (!retryPayload) return;
//     doSend(retryPayload.messages, retryPayload.filters, retryPayload.ctx);
//   };

//   return (
//     <>
//       <style>{`
//         @keyframes chat-bounce {
//           0%, 60%, 100% { transform: translateY(0); }
//           30%            { transform: translateY(-6px); }
//         }
//         .chat-messages-area::-webkit-scrollbar { width: 4px; }
//         .chat-messages-area::-webkit-scrollbar-track { background: transparent; }
//         .chat-messages-area::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
//         .chat-messages-area::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
//       `}</style>

//       <div style={{
//         display: "flex",
//         flexDirection: "column",
//         border: "1px solid #e9ecef",
//         borderRadius: 12,
//         background: "#ffffff",
//         height: 580,
//         overflow: "hidden",
//         boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
//         fontFamily: "Arial, Helvetica, sans-serif",
//       }}>

//         {/* ── Header ───────────────────────────────────────── */}
//         <div style={{
//           display: "flex",
//           alignItems: "center",
//           justifyContent: "space-between",
//           padding: "8px 12px",
//           borderBottom: "1px solid #f1f5f9",
//           background: "#ffffff",
//           flexShrink: 0,
//         }}>
//           {/* Left: dot + title */}
//           <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
//             <span style={{
//               width: 7, height: 7, borderRadius: "50%",
//               background: "var(--bain-red)", display: "inline-block",
//               boxShadow: "0 0 0 2px rgba(230,0,0,0.2)",
//               flexShrink: 0,
//             }} />
//             <span style={{
//               fontSize: 12, fontWeight: 700, color: "#1e293b",
//               fontFamily: "Arial, Helvetica, sans-serif",
//             }}>
//               {title}
//             </span>
//           </div>

//           {/* Right: clear + web toggle */}
//           <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
//             {/* Clear */}
//             <button
//               onClick={() => {
//                 const initial = [{ role: "assistant" as const, content: "Ask me about the data or what you see in the chart." }];
//                 setMessages(initial);
//                 try { sessionStorage.removeItem(storageKey); } catch (_) {}
//               }}
//               title="Clear chat"
//               style={{
//                 background: "none", border: "none", cursor: "pointer",
//                 color: "#cbd5e1", padding: 0,
//                 display: "flex", alignItems: "center",
//                 transition: "color 0.15s",
//               }}
//               onMouseEnter={(e) => (e.currentTarget.style.color = "#E60000")}
//               onMouseLeave={(e) => (e.currentTarget.style.color = "#cbd5e1")}
//             >
//               <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
//                 stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                 <polyline points="3 6 5 6 21 6"/>
//                 <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
//                 <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
//               </svg>
//             </button>

//             {/* Divider */}
//             <div style={{ width: 1, height: 12, background: "#e2e8f0" }} />

//             {/* Web toggle */}
//             <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
//               onClick={() => setWebEnabled(!webEnabled)}>
//               <span style={{
//                 fontSize: 10, fontWeight: 600,
//                 color: webEnabled ? "var(--bain-red)" : "#94a3b8",
//                 fontFamily: "Arial, Helvetica, sans-serif",
//                 transition: "color 0.2s",
//                 userSelect: "none" as const,
//               }}>Web</span>
//               <div style={{
//                 position: "relative", width: 28, height: 16, borderRadius: 20,
//                 background: webEnabled ? "var(--bain-red)" : "#e2e8f0",
//                 transition: "background 0.2s", flexShrink: 0,
//               }}>
//                 <span style={{
//                   position: "absolute", top: 2,
//                   left: webEnabled ? 12 : 2,
//                   width: 12, height: 12, borderRadius: "50%",
//                   background: "#ffffff",
//                   boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
//                   transition: "left 0.2s",
//                 }} />
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* ── Messages ─────────────────────────────────────── */}
//         <div
//           ref={messagesRef}
//           className="chat-messages-area"
//           style={{
//             flex: 1,
//             overflowY: "auto",
//             padding: "16px 14px 8px",
//             background: "#f8fafc",
//             display: "flex",
//             flexDirection: "column",
//             gap: 2,
//           }}
//         >
//           {messages.map((msg, i) => (
//             <ChatMessage key={i} role={msg.role} content={msg.content} />
//           ))}
//           {loading && <TypingDots />}
//           {retryPayload && !loading && (
//             <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
//               <button
//                 onClick={handleRetry}
//                 style={{
//                   display: "inline-flex", alignItems: "center", gap: 6,
//                   background: "none", border: "1px solid #e2e8f0",
//                   borderRadius: 20, padding: "5px 14px",
//                   fontSize: 12, color: "#64748b", cursor: "pointer",
//                   fontFamily: "Arial, Helvetica, sans-serif",
//                 }}
//                 onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--bain-red)"; e.currentTarget.style.color = "var(--bain-red)"; }}
//                 onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
//               >
//                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//                   <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.46"/>
//                 </svg>
//                 Retry
//               </button>
//             </div>
//           )}

//         </div>

//         {/* ── Hint bar ─────────────────────────────────────── */}
//         <div style={{
//           padding: "5px 14px",
//           background: "#f8fafc",
//           borderTop: "1px solid #f1f5f9",
//           fontSize: 10,
//           color: "#cbd5e1",
//           fontWeight: 500,
//           display: "flex",
//           alignItems: "center",
//           gap: 4,
//         }}>
//           <kbd style={{
//             fontSize: 9, padding: "0 4px",
//             border: "1px solid #e2e8f0",
//             borderRadius: 3, background: "#fff",
//             color: "#94a3b8", fontFamily: "inherit",
//           }}>Enter</kbd>
//           to send
//           <span style={{ margin: "0 4px", color: "#e2e8f0" }}>·</span>
//           <kbd style={{
//             fontSize: 9, padding: "0 4px",
//             border: "1px solid #e2e8f0",
//             borderRadius: 3, background: "#fff",
//             color: "#94a3b8", fontFamily: "inherit",
//           }}>Shift+Enter</kbd>
//           for new line
//         </div>

//         {/* ── Input ────────────────────────────────────────── */}
//         <ChatInput onSend={handleSend} disabled={false} />
//       </div>
//     </>
//   );
// }










"use client";
// PATH: frontend/components/chat/ChatPanel.tsx
import { useState, useRef, useEffect } from "react";
import { sendChat } from "@/lib/api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import type { ChatMessageFull } from "@/lib/types";

interface Props {
  currentFilters: Record<string, unknown>;
  chartContext:   Record<string, unknown>;
  dataScope?:     string;
  title?:         string;
}

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        background: "var(--bain-red)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 800, color: "#fff",
        flexShrink: 0, marginTop: 1,
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>C</div>
      <div style={{
        background: "#ffffff", border: "1px solid #e9ecef",
        borderRadius: "4px 12px 12px 12px",
        padding: "10px 14px",
        display: "flex", gap: 5, alignItems: "center",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}>
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "#cbd5e1", display: "inline-block",
            animation: "chat-bounce 1.2s infinite",
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

const INITIAL_MESSAGE: ChatMessageFull = {
  role: "assistant",
  content: "Ask me about the data or what you see in the chart.",
};

export default function ChatPanel({
  currentFilters,
  chartContext,
  dataScope = "flat_file",
  title = "Construct Lens",
}: Props) {
  // sessionStorage key — unique per panel title
  // sessionStorage clears automatically when the browser tab is closed
  const storageKey = `cemiq_chat_${title ?? "default"}`;

  const [messages, setMessages] = useState<ChatMessageFull[]>([INITIAL_MESSAGE]);
  const [ready, setReady] = useState(false);
  const [webEnabled, setWebEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryPayload, setRetryPayload] = useState<null | {
    messages: ChatMessageFull[];
    filters: Record<string, unknown>;
    ctx: Record<string, unknown>;
  }>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  // ── Load from sessionStorage on first mount only ──────────────────────────
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as ChatMessageFull[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (_) {}
    setReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← empty deps: only runs once on mount, not on navigation

  // ── Persist to sessionStorage whenever messages change ────────────────────
  useEffect(() => {
    if (!ready) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch (_) {}
  }, [messages, storageKey, ready]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const doSend = async (
    msgs: ChatMessageFull[],
    filters: Record<string, unknown>,
    ctx: Record<string, unknown>,
    attempt = 1,
  ) => {
    setLoading(true);
    setRetryPayload(null);
    try {
      const apiMessages = msgs.map(m => ({ role: m.role, content: m.content }));
      const res = await sendChat({
        messages:        apiMessages,
        current_filters: filters,
        chart_context:   ctx,
        mode:            webEnabled ? "web" : "dataset",
        data_scope:      dataScope,
      });

      const assistantMsg: ChatMessageFull = {
        role: "assistant",
        content: res.data.answer,
        chart: res.data.chart,
        table: res.data.table,
        derivation: res.data.derivation,
      };

      setMessages(prev => [...prev, assistantMsg]);
      setLoading(false);
    } catch (err: unknown) {
      if (attempt < 2) {
        setTimeout(() => doSend(msgs, filters, ctx, attempt + 1), 800);
        return;
      }
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `I encountered an issue: ${errMsg.includes("500") ? "the server had an error processing your request" : errMsg}. You can retry below.`,
      }]);
      setRetryPayload({ messages: msgs, filters, ctx });
      setLoading(false);
    }
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessageFull = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    await doSend(updated, currentFilters, chartContext);
  };

  const handleRetry = () => {
    if (!retryPayload) return;
    doSend(retryPayload.messages, retryPayload.filters, retryPayload.ctx);
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
    try { sessionStorage.removeItem(storageKey); } catch (_) {}
  };

  return (
    <>
      <style>{`
        @keyframes chat-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30%            { transform: translateY(-6px); }
        }
        .chat-messages-area::-webkit-scrollbar { width: 4px; }
        .chat-messages-area::-webkit-scrollbar-track { background: transparent; }
        .chat-messages-area::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
        .chat-messages-area::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>

      <div style={{
        display: "flex", flexDirection: "column",
        border: "1px solid #e9ecef", borderRadius: 12,
        background: "#ffffff", height: 580, overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderBottom: "1px solid #f1f5f9",
          background: "#ffffff", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--bain-red)", display: "inline-block",
              boxShadow: "0 0 0 2px rgba(230,0,0,0.2)", flexShrink: 0,
            }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "Arial, Helvetica, sans-serif" }}>
              {title}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Clear */}
            <button
              onClick={clearChat}
              title="Clear chat"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", padding: 0, display: "flex", alignItems: "center", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#E60000")}
              onMouseLeave={e => (e.currentTarget.style.color = "#cbd5e1")}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>

            <div style={{ width: 1, height: 12, background: "#e2e8f0" }} />

            {/* Web toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}
              onClick={() => setWebEnabled(!webEnabled)}>
              <span style={{ fontSize: 10, fontWeight: 600, color: webEnabled ? "var(--bain-red)" : "#94a3b8", fontFamily: "Arial, Helvetica, sans-serif", transition: "color 0.2s", userSelect: "none" as const }}>
                Web
              </span>
              <div style={{ position: "relative", width: 28, height: 16, borderRadius: 20, background: webEnabled ? "var(--bain-red)" : "#e2e8f0", transition: "background 0.2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 2, left: webEnabled ? 12 : 2, width: 12, height: 12, borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(0,0,0,0.18)", transition: "left 0.2s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages ───────────────────────────────────── */}
        <div
          ref={messagesRef}
          className="chat-messages-area"
          style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 2 }}
        >
          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              chart={msg.chart}
              table={msg.table}
              derivation={msg.derivation}
            />
          ))}
          {loading && <TypingDots />}
          {retryPayload && !loading && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <button
                onClick={handleRetry}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "1px solid #e2e8f0", borderRadius: 20, padding: "5px 14px", fontSize: 12, color: "#64748b", cursor: "pointer", fontFamily: "Arial, Helvetica, sans-serif" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--bain-red)"; e.currentTarget.style.color = "var(--bain-red)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.46"/>
                </svg>
                Retry
              </button>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* ── Hint bar ───────────────────────────────────── */}
        <div style={{ padding: "5px 14px", background: "#f8fafc", borderTop: "1px solid #f1f5f9", fontSize: 10, color: "#cbd5e1", fontWeight: 500, display: "flex", alignItems: "center", gap: 4 }}>
          <kbd style={{ fontSize: 9, padding: "0 4px", border: "1px solid #e2e8f0", borderRadius: 3, background: "#fff", color: "#94a3b8", fontFamily: "inherit" }}>Enter</kbd>
          to send
          <span style={{ margin: "0 4px", color: "#e2e8f0" }}>·</span>
          <kbd style={{ fontSize: 9, padding: "0 4px", border: "1px solid #e2e8f0", borderRadius: 3, background: "#fff", color: "#94a3b8", fontFamily: "inherit" }}>Shift+Enter</kbd>
          for new line
        </div>

        {/* ── Input ──────────────────────────────────────── */}
        <ChatInput onSend={handleSend} disabled={false} />
      </div>
    </>
  );
}