"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useResolvedTheme } from "@/lib/theme";
import { useSpeechSynthesisServer } from "@/lib/voice-server";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  user_id?: string;
  conversation_id?: string;
  attachments?: string[];
  _previewUrls?: Record<string, string>;
  _loading?: boolean;
  in_progress?: boolean;
  _retryReq?: { message: string; conversationId: string; contentParts: any[]; mode: string } | null;
  mode?: string;
  _isDeep?: boolean;
  _feedbackGiven?: boolean;
  feedback_vote?: boolean | null;
};

type Props = {
  message: Message;
  streamingMsgId: string | null;
  retryMode: string | null;
  formatTime: (date: string) => string;
};

export default function MessageBubble({
  message,
  streamingMsgId,
  retryMode,
  formatTime,
}: Props) {
  const isStreaming = message._loading || message.id === streamingMsgId || retryMode === message.id;
  const isUser = message.role === "user";
  // Tema resuelto (claro/oscuro) — decide el estilo del syntax highlighting.
  const resolvedTheme = useResolvedTheme();

  // Voice output (TTS) — usa Kokoro TTS corriendo en el VPS en lugar de la
  // voz del navegador (que suena robótica para español). Misma interfaz
  // que useSpeechSynthesis: speak(), stop(), isSpeaking, progress (0-1),
  // charIndex (para resaltar la palabra actual). El charIndex ahora se
  // estima del progreso de tiempo del audio, no del evento `boundary`.
  const { speak, stop, isSpeaking, isLoading, currentText, isSupported, progress, charIndex } = useSpeechSynthesisServer();
  const isThisSpeaking = isSpeaking && currentText === message.content;

  // Resaltar la palabra actual durante TTS. Dividimos el contenido por
  // caracteres hasta charIndex y aplicamos estilos diferentes a la
  // parte "leída" vs "por leer". Esto da el efecto karaoke.
  function renderWithHighlight(content: string): React.ReactNode {
    if (!isThisSpeaking || charIndex <= 0) {
      return <span style={{ color: "var(--text-primary)" }}>{content}</span>;
    }
    const upTo = content.slice(0, charIndex);
    const from = content.slice(charIndex);
    return (
      <>
        <span style={{ color: "var(--text-primary)" }}>{upTo}</span>
        <span style={{ color: "var(--text-tertiary)" }}>{from}</span>
      </>
    );
  }

  return (
    <div
      className={`flex mb-6 animate-fade-in group ${isUser ? "justify-end" : "justify-start"}`}
      style={{ paddingLeft: isUser ? "12%" : 0, paddingRight: isUser ? 0 : "12%" }}
    >
      <div className={`flex flex-col min-w-0 ${isUser ? "max-w-[78%] items-end" : "w-full"}`}>
        {/* Sender label */}
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {isUser ? "Tú" : "VeChat"}
          </span>
          {!isUser && message._isDeep && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a78bfa" }}>
              <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
              <path d="M9 18h6"/>
              <path d="M10 21h4"/>
            </svg>
          )}
        </div>

        {/* Body — left/right accented card style. Each bubble has a 3px
            colored stripe on the side facing the screen edge (teal for
            assistant on the left, white for user on the right) + a thin
            neutral outline. No fill, no blur — the topographic background
            stays fully visible through the message. */}
        {isUser ? (
          <div
            className="text-sm leading-relaxed"
            style={{
              color: "var(--text-primary)",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              backgroundColor: "var(--user-bubble)",
              boxShadow: "inset -3px 0 0 0 var(--primary), inset 0 0 0 1px var(--border)",
              borderRadius: "12px",
              padding: "12px 16px",
            }}
          >
            {message._previewUrls && (
              <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                {Object.values(message._previewUrls).map((url, i) => (
                  <img key={i} src={url} alt="adjunto"
                    className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ width: "120px", height: "120px" }} />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap font-medium">{message.content}</p>
          </div>
        ) : (
          <div
            className="text-sm leading-relaxed"
            style={{
              color: "var(--text-primary)",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              backgroundColor: "transparent",
              boxShadow: "inset 3px 0 0 0 var(--primary), inset 0 0 0 1px rgba(255, 255, 255, 0.10)",
              borderRadius: "12px",
              padding: "14px 18px",
            }}
          >
            {isStreaming ? (
              <div className="flex items-center gap-2 min-h-[24px]">
                {message.content ? (
                  <span className="text-sm leading-relaxed" style={{ color: "var(--text-primary)", wordBreak: "break-word" }}>
                    {message.content}
                    <span className="typing-cursor ml-0.5" />
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </span>
                )}
              </div>
            ) : message.content && /^(Error|Conexion)/.test(message.content) && !message._retryReq ? (
              <div className="flex items-center gap-2" style={{ color: "var(--danger)" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">{message.content}</span>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const code = String(children).replace(/\n$/, "");
                      if (!match) {
                        return <code className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: "var(--code-bg)", color: "var(--primary)" }}>{code}</code>;
                      }
                      return (
                        <div className="relative group rounded-xl overflow-hidden my-2" style={{ maxWidth: "100%" }}>
                          <div className="flex items-center justify-between px-4 py-2"
                            style={{ backgroundColor: "color-mix(in srgb, var(--surface) 80%, transparent)", borderBottom: "1px solid var(--border)" }}>
                            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                              {match[1]}
                            </span>
                            <button onClick={() => navigator.clipboard.writeText(code)}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors"
                              style={{ backgroundColor: "var(--code-bg)", color: "var(--text-secondary)" }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Copiar
                            </button>
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
                    }
                  }}
                >{message.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Timestamp + speaker button (TTS). The speaker only shows on
            assistant messages that have finished streaming, on browsers
            that support TTS. Tres estados visuales:
            1. Idle: bocina gris
            2. Loading (Kokoro generando): spinner girando
            3. Speaking: cuadrito + barra de progreso */}
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
            {formatTime(message.created_at)}
          </span>
          {!isUser && !isStreaming && isSupported && message.content && (() => {
            const isThisLoading = isLoading && currentText === message.content;
            return (
              <button
                onClick={() => (isThisSpeaking || isThisLoading ? stop() : speak(message.content))}
                className="inline-flex items-center justify-center w-5 h-5 rounded-md transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: isThisSpeaking ? "var(--primary)" : "var(--text-tertiary)" }}
                title={isThisSpeaking ? "Detener lectura" : isThisLoading ? "Generando audio..." : "Leer en voz alta"}
                aria-label={isThisSpeaking ? "Detener lectura" : isThisLoading ? "Generando audio" : "Leer en voz alta"}
              >
                {isThisSpeaking ? (
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : isThisLoading ? (
                  // Spinner mientras Kokoro genera el audio (~1-3s)
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                  </svg>
                )}
              </button>
            );
          })()}
          {(isLoading || isSpeaking) && (currentText === message.content || isThisSpeaking) && (
            <div className="flex items-center gap-1.5 ml-1">
              {isLoading && currentText === message.content ? (
                // Texto "Generando..." durante el fetch
                <span className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                  Generando...
                </span>
              ) : (
                <>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ width: "60px", backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(progress * 100)}%`,
                        backgroundColor: "var(--primary)",
                        transition: "width 0.1s linear",
                      }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                    {Math.round(progress * 100)}%
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
