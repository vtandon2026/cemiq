// PATH: frontend/components/chat/ChatMessage.tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: isUser ? "flex-end" : "flex-start",
      gap: 8,
      marginBottom: 10,
    }}>
      {/* Assistant avatar */}
      {!isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "var(--bain-red)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
          flexShrink: 0, marginTop: 1,
          fontFamily: "Arial, Helvetica, sans-serif",
          boxShadow: "0 1px 4px rgba(230,0,0,0.3)",
        }}>C</div>
      )}

      {/* Bubble */}
      <div style={{
        maxWidth: "82%",
        padding: "9px 13px",
        borderRadius: isUser
          ? "12px 4px 12px 12px"
          : "4px 12px 12px 12px",
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "Arial, Helvetica, sans-serif",
        background: isUser ? "#fff1f1" : "#ffffff",
        border: isUser ? "1px solid #fecaca" : "1px solid #e9ecef",
        color: "#1e293b",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}>
        {isUser ? (
          <span style={{ whiteSpace: "pre-wrap", fontWeight: 500 }}>{content}</span>
        ) : (
          <div className="chat-bubble">{
            // @ts-ignore
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          }</div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#64748b",
          flexShrink: 0, marginTop: 1,
          fontFamily: "Arial, Helvetica, sans-serif",
        }}>U</div>
      )}
    </div>
  );
}