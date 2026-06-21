"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight, vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useResolvedTheme } from "@/lib/theme";
import { useSpeechSynthesisServer } from "@/lib/voice-server";
import { clampStreamingTable, stripContextDelta } from "@/lib/streamingMarkdown";
import LocalBusinessCard from "@/components/chat/LocalBusinessCard";
import type { LocalBusiness } from "@/lib/localBusinesses";

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
  _status?: "searching" | "searching_local";
  _grounded?: boolean;
  _sources?: { title: string; url: string }[];
  _businesses?: LocalBusiness[];
  _feedbackGiven?: boolean;
  feedback_vote?: boolean | null;
};

type Props = {
  message: Message;
  streamingMsgId: string | null;
  retryMode: string | null;
  formatTime: (date: string) => string;
};

// Revelado suave del streaming: la red entrega el texto en ráfagas
// irregulares (a veces 1 palabra, a veces 20). Este hook desacopla la
// velocidad de APARICIÓN de la de la red — revela el texto a ritmo parejo
// con requestAnimationFrame, alcanzando las ráfagas sin saltos. Al terminar
// (o con prefers-reduced-motion) muestra el texto completo de inmediato.
// Plugin rehype: envuelve cada PALABRA del texto en <span class="cb-w"> para
// poder animarlas (blur-in) una a una mientras se streamea. Solo se aplica
// durante el streaming; el render final va sin él (markdown limpio). No toca
// code/pre (no romper bloques de código). Los espacios quedan como texto
// suelto para preservar el wrapping y el copiar/pegar.
// No envolver palabras dentro de estos elementos: code/pre (no romper bloques de
// código) y las TABLAS (th/td/tr/…): el blur por palabra re-anima cada celda en
// cada frame del streaming y las tablas parpadean. Las celdas se renderizan como
// texto plano (sin animación), que es lo que se quiere.
const CB_SKIP = new Set(["code", "pre", "table", "thead", "tbody", "tfoot", "tr", "td", "th"]);
function rehypeBlurWords() {
  const wrap = (node: any) => {
    if (!node || !Array.isArray(node.children)) return;
    const out: any[] = [];
    for (const child of node.children) {
      if (child.type === "text") {
        for (const part of String(child.value).split(/(\s+)/)) {
          if (part === "") continue;
          if (/^\s+$/.test(part)) out.push({ type: "text", value: part });
          else out.push({ type: "element", tagName: "span", properties: { className: ["cb-w"] }, children: [{ type: "text", value: part }] });
        }
      } else {
        if (child.type === "element" && !CB_SKIP.has(child.tagName)) wrap(child);
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: any) => wrap(tree);
}

function useSmoothReveal(full: string, active: boolean): string {
  const [shown, setShown] = React.useState(full);
  const shownLenRef = React.useRef(full.length);
  const fullRef = React.useRef(full);
  fullRef.current = full;

  const reduce = React.useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  React.useEffect(() => {
    if (!active || reduce) return;
    if (shownLenRef.current > full.length) shownLenRef.current = full.length; // mensaje nuevo / reset
    let raf = 0;
    let last = 0;
    const tick = (ts: number) => {
      const target = fullRef.current;
      // ~30fps: suficiente para verse fluido sin re-parsear el markdown a 60fps
      if (ts - last >= 28) {
        last = ts;
        const cur = shownLenRef.current;
        if (cur < target.length) {
          // Paso adaptativo: avanza más rápido cuanto más texto haya
          // pendiente (alcanza las ráfagas), suave al final.
          const step = Math.max(1, Math.min(28, Math.ceil((target.length - cur) / 9)));
          let next = cur + step;
          // Avanzar SOLO hasta un límite de palabra: así el blur-in anima cada
          // palabra completa una vez (si cortáramos a media palabra, el span
          // activo se re-animaría en cada frame).
          if (next < target.length) {
            const sp = target.indexOf(" ", next);
            const nl = target.indexOf("\n", next);
            const bound = Math.min(sp === -1 ? Infinity : sp, nl === -1 ? Infinity : nl);
            next = bound === Infinity ? target.length : bound + 1;
          }
          shownLenRef.current = next;
          setShown(target.slice(0, next));
        }
      }
      raf = requestAnimationFrame(tick); // sigue corriendo para alcanzar nuevos tokens
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce, full.length === 0]);

  // Al terminar el streaming (o si no aplica), mostrar el texto completo.
  React.useEffect(() => {
    if (!active || reduce) {
      shownLenRef.current = full.length;
      setShown(full);
    }
  }, [active, reduce, full]);

  return active && !reduce ? shown : full;
}

export default function MessageBubble({
  message,
  streamingMsgId,
  retryMode,
  formatTime,
}: Props) {
  const isStreaming = message._loading || message.id === streamingMsgId || retryMode === message.id;
  const isUser = message.role === "user";
  // Quita el bloque context_delta que el modelo a veces deja al final de la
  // respuesta (defensa en el render: cubre también mensajes viejos ya guardados
  // en la BD con el JSON pegado). No aplica a la burbuja del usuario.
  const baseContent = isUser ? message.content : stripContextDelta(message.content);
  // Texto revelado suavemente (solo respuestas en streaming). Durante el
  // streaming se estabilizan las tablas a medio llegar (clampStreamingTable)
  // para que no parpadeen ni se re-formen frame a frame.
  const revealed = useSmoothReveal(baseContent, isStreaming && !isUser);
  const displayedContent = isStreaming && !isUser ? clampStreamingTable(revealed) : revealed;
  // Tema resuelto (claro/oscuro) — decide el estilo del syntax highlighting.
  const resolvedTheme = useResolvedTheme();

  // Voice output (TTS) — usa Kokoro TTS corriendo en el VPS en lugar de la
  // voz del navegador (que suena robótica para español). Misma interfaz
  // que useSpeechSynthesis: speak(), stop(), isSpeaking, progress (0-1),
  // charIndex (para resaltar la palabra actual). El charIndex ahora se
  // estima del progreso de tiempo del audio, no del evento `boundary`.
  const { speak, stop, isSpeaking, isLoading, currentText, isSupported, progress } = useSpeechSynthesisServer();
  const isThisSpeaking = isSpeaking && currentText === message.content;

  // Componentes de markdown — compartidos por el streaming Y el render final,
  // así la respuesta se ve FORMATEADA desde el primer token (no como texto
  // crudo con los símbolos del markdown que luego "salta" a la versión bonita).
  const mdComponents = {
    code({ className, children }: { className?: string; children?: React.ReactNode }) {
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
    },
    // Las tablas anchas se contienen en su propia caja con scroll horizontal
    // (.md-table-wrap) para que NO arrastren toda la página de lado en móvil:
    // solo la tabla se desliza, dentro de sus límites. Ver globals.css.
    table({ children }: { children?: React.ReactNode }) {
      return <div className="md-table-wrap"><table>{children}</table></div>;
    },
  };

  return (
    <div
      data-message-id={message.id}
      className={`flex gap-3 mb-7 animate-fade-in group ${isUser ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar de VeChat — da identidad a la respuesta (estándar de los
          buenos chats). El usuario no lleva avatar: basta con la burbuja
          alineada a la derecha. */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5l8 14L20 5" />
          </svg>
        </div>
      )}

      <div className={`flex flex-col min-w-0 ${isUser ? "max-w-[80%] items-end" : "flex-1 items-start"}`}>
        {/* Nombre solo en la respuesta (el avatar ya identifica); el usuario
            se sobreentiende por la alineación. */}
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 h-7">
            <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
              VeChat
            </span>
            {message._isDeep && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a78bfa" }}>
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                <path d="M9 18h6"/>
                <path d="M10 21h4"/>
              </svg>
            )}
          </div>
        )}

        {/* Pregunta del usuario: burbuja limpia, rellena y con esquina-cola
            (sin franja ni doble borde). La respuesta: SIN caja — el texto
            fluye y deja respirar el markdown/código (como ChatGPT/Claude). */}
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
            {message._previewUrls && (
              <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                {Object.values(message._previewUrls).map((url, i) => (
                  <img key={i} src={url} alt="adjunto"
                    className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ width: "120px", height: "120px" }} />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>
        ) : (
          <div
            className="text-sm leading-relaxed w-full"
            style={{
              color: "var(--text-primary)",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
            }}
          >
            {isStreaming && !displayedContent ? (
              message._status === "searching" || message._status === "searching_local" ? (
                // Buscando (internet o negocios locales): globo que gira + texto
                // con shimmer (sin caja, en línea sin burbuja). Se mantiene hasta
                // que llega el primer token (no vuelve a los 3 puntos).
                <div className="cb-searching inline-flex items-center gap-2 min-h-[24px]" aria-label={message._status === "searching_local" ? "Buscando negocios cerca" : "Buscando en internet"}>
                  <svg className="cb-globe" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18" />
                    <path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
                  </svg>
                  <span className="cb-searching-text">{message._status === "searching_local" ? "Buscando negocios cerca…" : "Buscando en internet"}</span>
                </div>
              ) : (
                // Aún sin texto visible: indicador "pensando".
                <div className="flex items-center min-h-[24px]">
                  <span className="thinking inline-flex items-center gap-1.5" aria-label="VeChat está pensando">
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                    <span className="thinking-dot" />
                  </span>
                </div>
              )
            ) : message.content && /^(Error|Conexion)/.test(message.content) && !message._retryReq ? (
              <div className="flex items-center gap-2" style={{ color: "var(--danger)" }}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm">{message.content}</span>
              </div>
            ) : (
              // Streaming Y final usan el MISMO render de markdown: el texto
              // se ve formateado desde el primer token. Mientras streamea,
              // `streaming-prose` añade el caret parpadeante al final (CSS).
              <div className={`prose max-w-none${isStreaming ? " streaming-prose" : ""}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={isStreaming ? [rehypeBlurWords] : []} components={mdComponents}>
                  {displayedContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* VeLocal: negocios locales (descubrimiento). Las tarjetas son los
            protagonistas; la prosa del modelo las enmarca sin repetir sus datos.
            Se muestran ni bien llegan (antes/durante el streaming del texto). */}
        {!isUser && message._businesses && message._businesses.length > 0 && (
          <div className="lb-cards">
            {message._businesses.slice(0, 4).map((b) => (
              <LocalBusinessCard key={b.slug} b={b} />
            ))}
          </div>
        )}

        {/* Sello "con fuentes": solo en respuestas aterrizadas (web search).
            Refuerza el posicionamiento "IA venezolana que sabe lo de aquí" y da
            confianza. Las fuentes son las REALES de la búsqueda (no las que el
            modelo citó), así que son fiables. Client-only (se ve en la sesión). */}
        {!isUser && !isStreaming && message._grounded && message._sources && message._sources.length > 0 && (
          <div className="cb-sources">
            <span className="cb-sources-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z" />
              </svg>
              Con fuentes
            </span>
            {(() => {
              // Dedup por dominio: Tavily suele traer varios resultados del
              // mismo sitio; mostramos un chip por dominio (máx 4).
              const seen = new Set<string>();
              const uniq: { url: string; title: string; host: string }[] = [];
              for (const s of message._sources!) {
                let host = s.url;
                try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch {}
                if (seen.has(host)) continue;
                seen.add(host);
                uniq.push({ url: s.url, title: s.title, host });
                if (uniq.length >= 4) break;
              }
              return uniq.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="cb-source-chip" title={s.title}>{s.host}</a>
              ));
            })()}
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
