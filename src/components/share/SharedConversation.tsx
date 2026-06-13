"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useResolvedTheme } from "@/lib/theme";

type Msg = { role: string; content: string };

// Render de SOLO LECTURA de una conversación compartida — reusa el estilo de
// los bubbles del chat (respuesta sin caja + avatar, pregunta en burbuja),
// sin streaming, TTS ni acciones.
export default function SharedConversation({ title, messages }: { title: string; messages: Msg[] }) {
  const resolvedTheme = useResolvedTheme();

  const mdComponents = {
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
      const match = /language-(\w+)/.exec(className || "");
      const code = String(children).replace(/\n$/, "");
      if (!match) {
        return <code className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: "var(--code-bg)", color: "var(--primary)" }}>{code}</code>;
      }
      return (
        <div className="rounded-xl overflow-hidden my-2" style={{ maxWidth: "100%" }}>
          <div className="flex items-center px-4 py-2" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 80%, transparent)", borderBottom: "1px solid var(--border)" }}>
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{match[1]}</span>
          </div>
          <SyntaxHighlighter
            style={(resolvedTheme === "dark" ? vscDarkPlus : oneLight) as any}
            language={match[1]}
            PreTag="div"
            customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px", backgroundColor: "transparent" }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
      );
    },
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-semibold mb-6" style={{ color: "var(--text-primary)" }}>{title}</h1>
      {messages.map((m, i) => {
        const isUser = m.role === "user";
        return (
          <div key={i} className={`flex gap-3 mb-7 ${isUser ? "justify-end" : "justify-start"}`}>
            {!isUser && (
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5l8 14L20 5" />
                </svg>
              </div>
            )}
            <div className={`flex flex-col min-w-0 ${isUser ? "max-w-[80%] items-end" : "flex-1 items-start"}`}>
              {!isUser && (
                <span className="text-[13px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>VeChat</span>
              )}
              {isUser ? (
                <div
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--text-primary)",
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    backgroundColor: "var(--user-bubble)",
                    border: "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
                    borderRadius: "18px 18px 6px 18px",
                    padding: "10px 15px",
                  }}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : (
                <div className="w-full prose max-w-none"
                  style={{ color: "var(--text-primary)", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                    {m.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
