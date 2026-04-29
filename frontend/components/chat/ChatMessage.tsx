// PATH: frontend/components/chat/ChatMessage.tsx
"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  role: "user" | "assistant";
  content: string;
}

const F = "Arial, Helvetica, sans-serif";

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div style={{
      display: "flex",
      alignItems: "flex-start",
      justifyContent: isUser ? "flex-end" : "flex-start",
      gap: 8,
      marginBottom: 14,
    }}>
      {/* Assistant avatar */}
      {!isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "var(--bain-red)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 800, color: "#fff",
          flexShrink: 0, marginTop: 2, fontFamily: F,
          boxShadow: "0 1px 4px rgba(230,0,0,0.3)",
        }}>C</div>
      )}

      {/* Bubble */}
      <div style={{
        width: isUser ? "auto" : "100%",
        maxWidth: isUser ? "82%" : "100%",
        padding: isUser ? "8px 12px" : "14px 16px",
        borderRadius: isUser ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
        fontFamily: F,
        background: isUser ? "#fff1f1" : "#ffffff",
        border: isUser ? "1px solid #fecaca" : "1px solid #e2e8f0",
        color: "#1e293b",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        minWidth: 0,
        overflowWrap: "break-word",
        wordBreak: "break-word",
      }}>
        {isUser ? (
          <span style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", fontWeight: 500 }}>
            {content}
          </span>
        ) : (
          <>
            <style>{`
              /* ── Base ── */
              .chat-md {
                font-size: 13.5px;
                line-height: 1.75;
                color: #1e293b;
                font-family: Arial, Helvetica, sans-serif;
              }

              /* ── Paragraphs ── */
              .chat-md p { margin: 0 0 10px 0; }
              .chat-md p:last-child { margin-bottom: 0; }

              /* ── Headings ── */
              .chat-md h1 {
                font-size: 15px; font-weight: 700; color: #0f172a;
                margin: 14px 0 6px 0;
                padding-bottom: 5px;
                border-bottom: 2px solid #E60000;
              }
              .chat-md h2 {
                font-size: 14px; font-weight: 700; color: #0f172a;
                margin: 12px 0 5px 0;
                padding-bottom: 3px;
                border-bottom: 1px solid #f1f5f9;
              }
              .chat-md h3 {
                font-size: 13px; font-weight: 700; color: #1e293b;
                margin: 10px 0 4px 0;
              }
              .chat-md h4 {
                font-size: 12.5px; font-weight: 600; color: #334155;
                margin: 8px 0 3px 0;
              }
              .chat-md h1:first-child,
              .chat-md h2:first-child,
              .chat-md h3:first-child { margin-top: 0; }

              /* ── Lists ── */
              .chat-md ul, .chat-md ol {
                margin: 6px 0 10px 0;
                padding-left: 22px;
              }
              .chat-md li {
                margin-bottom: 5px;
                font-size: 13.5px;
                line-height: 1.65;
                color: #1e293b;
              }
              .chat-md li:last-child { margin-bottom: 0; }
              .chat-md li > p { margin: 0; }
              /* Nested lists */
              .chat-md li ul, .chat-md li ol {
                margin: 4px 0 4px 0;
              }

              /* ── Inline code ── */
              .chat-md code {
                font-size: 12px;
                font-family: 'Courier New', monospace;
                background: #f1f5f9;
                color: #be123c;
                padding: 2px 6px;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
              }

              /* ── Code blocks ── */
              .chat-md pre {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                padding: 12px 14px;
                overflow-x: auto;
                margin: 10px 0;
              }
              .chat-md pre code {
                background: none; border: none; padding: 0;
                color: #334155; font-size: 12px; line-height: 1.65;
              }

              /* ── Formula callout (blockquote) ── */
              .chat-md blockquote {
                border-left: 4px solid #E60000;
                margin: 10px 0;
                padding: 8px 14px;
                background: linear-gradient(90deg, #fff7f7 0%, #fffafa 100%);
                border-radius: 0 8px 8px 0;
                color: #1e293b;
              }
              .chat-md blockquote p {
                margin: 0 0 4px 0;
                font-size: 13px;
                line-height: 1.65;
              }
              .chat-md blockquote p:last-child { margin-bottom: 0; }

              /* ── Tables ── */
              .chat-md table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12.5px;
                margin: 12px 0;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
                overflow: hidden;
              }
              .chat-md th {
                background: #f1f5f9;
                font-weight: 700;
                padding: 7px 12px;
                text-align: left;
                border-bottom: 1px solid #e2e8f0;
                border-right: 1px solid #e2e8f0;
                color: #1e293b;
                font-size: 11.5px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
              }
              .chat-md th:last-child { border-right: none; }
              .chat-md td {
                padding: 7px 12px;
                border-bottom: 1px solid #f1f5f9;
                border-right: 1px solid #f1f5f9;
                color: #334155;
                vertical-align: top;
                line-height: 1.55;
              }
              .chat-md td:last-child { border-right: none; }
              .chat-md tr:last-child td { border-bottom: none; }
              .chat-md tr:nth-child(even) td { background: #fafafa; }

              /* ── Misc ── */
              .chat-md a {
                color: #E60000;
                text-decoration: underline;
                word-break: break-all;
                overflow-wrap: anywhere;
              }
              .chat-md hr { border: none; border-top: 1px solid #f1f5f9; margin: 12px 0; }
              .chat-md strong { font-weight: 700; color: #0f172a; }
              .chat-md em { font-style: italic; color: #475569; }
            `}</style>
            <div className="chat-md">
              {/* @ts-ignore */}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
                  ),
                }}
              >
                {content
                  // Convert standalone **Title** lines to ### headings
                  .replace(/^\*\*(.+?)\*\*$/gm, "### $1")
                  // Convert ANY indented line (2+ spaces) to a markdown bullet
                  .replace(/^([ \t]{2,})(\S)/gm, "- $2")
                  .replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_: string, inner: string) =>
                    inner
                      .replace(/\\text\{([^}]+)\}/g, "$1")
                      .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
                      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1) / ($2)")
                      .replace(/\\times/g, "×").replace(/\\cdot/g, "·")
                      .replace(/\s+/g, " ").trim()
                  )
                  .replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_: string, inner: string) =>
                    inner
                      .replace(/\\text\{([^}]+)\}/g, "$1")
                      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)")
                      .replace(/\\left\(/g, "(").replace(/\\right\)/g, ")")
                      .replace(/\\times/g, "×").replace(/\s+/g, " ").trim()
                  )
                  .replace(/\\[a-zA-Z]+\{([^}]*)\}/g, "$1")
                  .replace(/\\[a-zA-Z]+/g, "")
                }
              </ReactMarkdown>
            </div>
          </>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: "#e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 10, fontWeight: 700, color: "#64748b",
          flexShrink: 0, marginTop: 2, fontFamily: F,
        }}>U</div>
      )}
    </div>
  );
}