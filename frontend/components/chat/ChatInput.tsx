// PATH: frontend/components/chat/ChatInput.tsx
"use client";
import { useState, KeyboardEvent } from "react";

interface Props {
  onSend:       (text: string) => void;
  disabled?:    boolean;
  placeholder?: string;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Ask about the data or the chart…",
}: Props) {
  const [text, setText] = useState("");

  const handleSend = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Allow typing always; only block send while disabled
  const canSend = !disabled && text.trim().length > 0;

  return (
    <div style={{
      display: "flex", alignItems: "flex-end", gap: 8,
      padding: "10px 14px 12px",
      background: "#ffffff", flexShrink: 0,
    }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        disabled={false} // always allow typing
        placeholder={disabled ? "Generating reply…" : placeholder}
        rows={2}
        style={{
          flex: 1, resize: "none", fontSize: 13,
          border: "1px solid #e2e8f0", borderRadius: 8,
          padding: "9px 12px", outline: "none",
          background: "#f8fafc", color: "#1e293b",
          fontFamily: "Arial, Helvetica, sans-serif",
          lineHeight: 1.55, transition: "border-color 0.15s, background 0.15s",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--bain-red)"; e.currentTarget.style.background = "#ffffff"; }}
        onBlur={(e)  => { e.currentTarget.style.borderColor = "#e2e8f0";         e.currentTarget.style.background = "#f8fafc"; }}
      />
      <button
        onClick={handleSend}
        disabled={!canSend}
        title={disabled ? "Waiting for reply…" : "Send"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 38, height: 38, borderRadius: "50%",
          border: "none",
          background: canSend ? "var(--bain-red)" : "#e2e8f0",
          color: canSend ? "#ffffff" : "#94a3b8",
          cursor: canSend ? "pointer" : "not-allowed",
          flexShrink: 0, transition: "background 0.15s, transform 0.1s",
          marginBottom: 1,
        }}
        onMouseEnter={(e) => { if (canSend) { e.currentTarget.style.opacity = "0.85"; e.currentTarget.style.transform = "scale(1.05)"; } }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
      >
        {disabled ? (
          // Small spinner when waiting
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
              style={{ animation: "chat-bounce 1s linear infinite" }} />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        )}
      </button>
    </div>
  );
}