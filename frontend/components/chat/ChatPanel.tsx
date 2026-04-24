// PATH: frontend/components/chat/ChatPanel.tsx
"use client";
import { useState, useRef, useEffect } from "react";
import { sendChat } from "@/lib/api";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

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
        background: "#ffffff",
        border: "1px solid #e9ecef",
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

export default function ChatPanel({
  currentFilters,
  chartContext,
  dataScope = "flat_file",
  title = "Construct Lens",
}: Props) {
  const [messages, setMessages] = useState<ChatMessageType[]>([
    { role: "assistant", content: "Ask me about the data or what you see in the chart." },
  ]);
  const [webEnabled, setWebEnabled] = useState(false);
  const [loading, setLoading]       = useState(false);
  const bottomRef    = useRef<HTMLDivElement>(null);
  const messagesRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const handleSend = async (text: string) => {
    const userMsg: ChatMessageType = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setLoading(true);
    try {
      const res = await sendChat({
        messages:        updated,
        current_filters: currentFilters,
        chart_context:   chartContext,
        mode:            webEnabled ? "web" : "dataset",
        data_scope:      dataScope,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.answer }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry — I hit an error. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
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
        display: "flex",
        flexDirection: "column",
        border: "1px solid #e9ecef",
        borderRadius: 12,
        background: "#ffffff",
        height: 580,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}>

        {/* ── Header ───────────────────────────────────────── */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9",
          background: "#ffffff",
          flexShrink: 0,
        }}>
          {/* Left: brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            {/* Animated status dot */}
            <span style={{
              width: 9, height: 9, borderRadius: "50%",
              background: "var(--bain-red)",
              display: "inline-block",
              boxShadow: "0 0 0 3px rgba(230,0,0,0.15)",
              animation: "chat-bounce 2.5s ease-in-out infinite",
            }} />
            <span style={{
              fontSize: 14, fontWeight: 800,
              color: "#0f172a", letterSpacing: "-0.2px",
            }}>
              {title}
            </span>
          </div>

          {/* Right: web toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={webEnabled ? "var(--bain-red)" : "#cbd5e1"}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ transition: "stroke 0.2s" }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: webEnabled ? "var(--bain-red)" : "#94a3b8",
              transition: "color 0.2s",
            }}>
              Web
            </span>
            <div
              onClick={() => setWebEnabled(!webEnabled)}
              style={{
                position: "relative",
                width: 34, height: 19,
                borderRadius: 20,
                background: webEnabled ? "var(--bain-red)" : "#e2e8f0",
                cursor: "pointer",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <span style={{
                position: "absolute",
                top: 2.5,
                left: webEnabled ? 15 : 2.5,
                width: 14, height: 14,
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.18)",
                transition: "left 0.2s",
              }} />
            </div>
          </div>
        </div>

        {/* ── Messages ─────────────────────────────────────── */}
        <div
          ref={messagesRef}
          className="chat-messages-area"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 14px 8px",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))}
          {loading && <TypingDots />}

        </div>

        {/* ── Hint bar ─────────────────────────────────────── */}
        <div style={{
          padding: "5px 14px",
          background: "#f8fafc",
          borderTop: "1px solid #f1f5f9",
          fontSize: 10,
          color: "#cbd5e1",
          fontWeight: 500,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <kbd style={{
            fontSize: 9, padding: "0 4px",
            border: "1px solid #e2e8f0",
            borderRadius: 3, background: "#fff",
            color: "#94a3b8", fontFamily: "inherit",
          }}>Enter</kbd>
          to send
          <span style={{ margin: "0 4px", color: "#e2e8f0" }}>·</span>
          <kbd style={{
            fontSize: 9, padding: "0 4px",
            border: "1px solid #e2e8f0",
            borderRadius: 3, background: "#fff",
            color: "#94a3b8", fontFamily: "inherit",
          }}>Shift+Enter</kbd>
          for new line
        </div>

        {/* ── Input ────────────────────────────────────────── */}
        <ChatInput onSend={handleSend} disabled={false} />
      </div>
    </>
  );
}