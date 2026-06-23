"use client";

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useSpeechRecognitionServer } from "@/lib/voice-server";
import ExpandInputModal from "./ExpandInputModal";
import { readDraft, writeDraft, DRAFT_SAVE_DEBOUNCE_MS } from "@/lib/chatDraft";

type BlockReason = {
  canWrite: boolean;
  canSend: boolean;
  reason: string;
};

type Props = {
  input: string;
  setInput: (val: string) => void;
  sending: boolean;
  attachments: File[];
  previewUrls: Record<string, string>;
  getBlockReason: () => BlockReason;
  isLoggedIn: boolean;
  onSend: () => void;
  onFileSelect: (files: File[]) => void;
  onRemoveAttachment: (name: string, size: number) => void;
  /** True while a model response is streaming in. The send button becomes a stop button. */
  isStreaming?: boolean;
  /** Called when the user clicks the stop button during streaming. */
  onStop?: () => void;
  /** Conversation id used to scope the localStorage draft. Pass null for the "new conversation" empty state. */
  convId?: string | null;
  autoFocus?: boolean;
  quotaLeft?: number;
  showQuota?: boolean;
};

// Los helpers de borrador (readDraft/writeDraft/clearDraft) viven en
// @/lib/chatDraft para que el camino de envío en ChatInterface pueda limpiar
// el borrador de la conversación de origen (ver el comentario de ese módulo).

// Placeholder que se desvanece y rota (HANDOFF §1.1): es un <span> superpuesto
// (no el atributo nativo, que no se puede animar), fade .3s, rota cada 3400ms,
// se oculta al escribir o al grabar.
const PLACEHOLDER_PROMPTS = [
  "Pregúntale a VeChat…",
  "¿A cómo está el dólar hoy?",
  "Requisitos del pasaporte 2026",
  "¿Dónde desayunar en Maracay?",
  "Recetas con plátano",
];

// Onda de voz (HANDOFF §1.4): 22 barras con stagger NEGATIVO para que parezca
// una onda viajando; alturas pseudoaleatorias 6 + 14*|sin(i*1.1+0.5)|.
const WAVE_BARS = Array.from({ length: 22 }, (_, i) => ({
  delay: `${(-(i * 0.08)).toFixed(2)}s`,
  h: 6 + Math.round(14 * Math.abs(Math.sin(i * 1.1 + 0.5))),
}));

export default function ChatInput({
  input,
  setInput,
  sending,
  attachments,
  previewUrls,
  getBlockReason,
  isLoggedIn,
  onSend,
  onFileSelect,
  onRemoveAttachment,
  isStreaming = false,
  onStop,
  convId = null,
  autoFocus,
  quotaLeft,
  showQuota,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [phClass, setPhClass] = useState<"vc-ph-show" | "vc-ph-hide">("vc-ph-show");
  const [recSec, setRecSec] = useState(0);
  // Tracks whether the current `input` value originated from a localStorage
  // draft. We use it to avoid wiping a draft before the user actually edits
  // (e.g. when the parent re-renders the same value back to us).
  const hydratedRef = useRef(false);
  // Set true while we're programmatically restoring the draft — skip the
  // "save" effect for one tick so we don't immediately re-write the same value.
  const restoringRef = useRef(false);
  const lastConvIdRef = useRef<string | null | undefined>(convId);
  const dragCounterRef = useRef(0);

  // Voice input (STT). El mic se muestra deshabilitado (no oculto) si
  // el navegador no soporta Web Speech API, con un mensaje claro. El
  // transcript se concatena a lo que el usuario ya haya escrito: si
  // empieza a dictar sobre texto existente, ese texto se preserva
  // como prefijo y el dictado se suma después. Si el usuario sigue
  // escribiendo MIENTRAS dicta, el texto se respeta (ya no se
  // sobrescribe como antes con prefixRef).
  // Idioma fijo: español de Venezuela (mercado principal de VeChat).
  const baseTextRef = useRef("");
  const lastTranscriptRef = useRef("");
  const cursorPosRef = useRef<number | null>(null);
  // Voice input (STT) — ElevenLabs Scribe via /api/stt. Estilo Gemini:
  // mientras el usuario habla vemos ondas animadas (no texto). Al soltar,
  // se manda a transcribir (~1-3s) y luego onAutoSend envía el mensaje
  // automáticamente. Si el usuario se arrepiente, X para cancelar.
  const {
    isListening, isProcessing, transcript, error, isSupported,
    start, stop, cancel, reset, getLevel,
  } = useSpeechRecognitionServer({
    lang: "es-VE",
    onAutoSend: (text: string) => {
      // Fill the input with the transcript, then send immediately.
      // We can't use the functional updater (the prop signature is just
      // (val: string) => void) so we read the current value from OUR
      // textarea ref — document.querySelector("textarea") podía agarrar
      // otro textarea de la página (modales, menú de cuenta).
      const current = textareaRef.current?.value || "";
      const sep = current && !current.endsWith(" ") ? " " : "";
      setInput((current + sep + text).trim());
      requestAnimationFrame(() => onSend());
      reset();
    },
  });
  // Canvas for the live waveform. rAF draws bars based on getLevel().
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Cuando cambia el transcript mientras escucha, sincronizamos con el input.
  // El formato es: <texto base que tenía> + (espacio si hace falta) + <transcript>.
  // Si el usuario escribió algo durante el dictado, eso YA está en `input`
  // y solo necesitamos anexar el transcript al final. Para soportar eso,
  // cuando arranca la grabación guardamos la longitud del input y siempre
  // reconstruimos como `input.substring(0, baseLen) + transcript`.
  const baseLenRef = useRef(0);
  useEffect(() => {
    if (!isListening) {
      baseTextRef.current = "";
      lastTranscriptRef.current = "";
      baseLenRef.current = 0;
      return;
    }
    if (!transcript) return;
    // Construimos: base + (separador) + transcript
    const base = input.substring(0, baseLenRef.current).replace(/\s+$/, "");
    const separator = base ? " " : "";
    const next = `${base}${separator}${transcript}`;
    if (next === input) return;
    // Preservar cursor al final del texto nuevo
    cursorPosRef.current = next.length;
    setInput(next);
    lastTranscriptRef.current = transcript;
  }, [isListening, transcript]); // input intencionalmente omitido del array

  // Restaurar cursor después del re-render
  useLayoutEffect(() => {
    if (cursorPosRef.current !== null && textareaRef.current) {
      const pos = cursorPosRef.current;
      textareaRef.current.setSelectionRange(pos, pos);
      cursorPosRef.current = null;
    }
  });

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => reset(), 4000);
    return () => clearTimeout(timer);
  }, [error, reset]);

  const handleMicClick = () => {
    if (isListening) {
      stop();
    } else {
      baseTextRef.current = input;
      baseLenRef.current = input.length;
      start();
    }
  };

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const block = getBlockReason();

  // Rotación del placeholder (HANDOFF §1.1): cada 3400ms, si NO hay texto y
  // NO se está grabando/generando, desvanece (vc-ph-hide), y a los 300ms
  // avanza el índice y reaparece (vc-ph-show). Congelado mientras se escribe.
  useEffect(() => {
    if (input || isListening || isStreaming || !block.canWrite) return;
    const id = setInterval(() => {
      setPhClass("vc-ph-hide");
      setTimeout(() => {
        setPhIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length);
        setPhClass("vc-ph-show");
      }, 300);
    }, 3400);
    return () => clearInterval(id);
  }, [input, isListening, isStreaming, block.canWrite]);

  // Contador m:ss mientras graba (HANDOFF §1.4).
  useEffect(() => {
    if (!isListening) {
      setRecSec(0);
      return;
    }
    const id = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isListening]);

  // Auto-resize the textarea to fit its content. useLayoutEffect runs
  // before paint so we never see the old height flash. Reset to "auto"
  // first so scrollHeight reflects natural content height, then cap at
  // 180px (HANDOFF §1.2). When the cap is hit, the textarea scrolls
  // internally; the project hides scrollbars globally.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 180);
    ta.style.height = `${next}px`;
  }, [input, isExpanded, isListening]);

  // Hidrata el borrador al montar / cambiar de conversación. El padre es dueño
  // del estado `input`; lo empujamos vía setInput. OJO: el borrado del texto
  // ARRASTRADO al cambiar de superficie lo hace el PADRE (selectConv /
  // newConversation hacen setInput(readDraft(destino))), porque cambiar de
  // conversación REMONTA este componente (empty state ↔ conversación son dos
  // <ChatInput> distintos) y aquí no podríamos distinguir un remonte por
  // navegación de la carga inicial con pregunta pendiente. Aquí solo
  // restauramos si hay borrador, para no pisar un valor inicial del padre.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const convChanged = lastConvIdRef.current !== convId;
    if (!convChanged && hydratedRef.current) return;
    lastConvIdRef.current = convId;
    hydratedRef.current = true;
    const draft = readDraft(convId);
    if (draft) {
      restoringRef.current = true;
      setInput(draft);
    }
  }, [convId, setInput]);

  // Persist the draft on every change, debounced. We skip the very first
  // write after a hydration so we don't redundantly re-save the value we
  // just read. Empty input = clear the draft.
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      writeDraft(convId, input);
    }, DRAFT_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [input, convId]);

  // Limpieza del borrador al enviar: en una conversación EXISTENTE basta con
  // que el padre haga setInput("") — el efecto de guardado de arriba escribe
  // "" (que borra el borrador). Pero cuando el envío CREA una conversación
  // nueva, el convId cambia antes de ese "", así que el padre además borra el
  // borrador de la conversación de origen explícitamente con clearDraft()
  // (ver ChatInterface.sendMessage y @/lib/chatDraft).

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const newFiles: File[] = [];

    for (const file of files) {
      if (attachments.length + newFiles.length >= 3) break;
      if (file.size > 5 * 1024 * 1024) continue;
      newFiles.push(file);
    }

    onFileSelect(newFiles);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Drag & drop — wraps the input in a drop zone. dragenter/dragleave
  // fire on every child element, so we use a counter to know when the
  // cursor truly enters/leaves the wrapper. The overlay only renders
  // while isDragging is true and is non-interactive (pointer-events:none)
  // so it doesn't block the drop event.
  const handleDragEnter = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsDragging(false);
  };
  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.types?.includes("Files")) return;
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    const accepted: File[] = [];
    for (const file of files) {
      if (attachments.length + accepted.length >= 3) break;
      if (file.size > 5 * 1024 * 1024) continue;
      accepted.push(file);
    }
    if (accepted.length > 0) onFileSelect(accepted);
  };

  // Paste — intercept image data on the clipboard and convert to File
  // objects. Only fires when the textarea is the active element. We don't
  // preventDefault for non-image pastes — plain text behaves as usual.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const images: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) images.push(file);
      }
    }
    if (images.length === 0) return;
    e.preventDefault();
    const accepted: File[] = [];
    for (const file of images) {
      if (attachments.length + accepted.length >= 3) break;
      if (file.size > 5 * 1024 * 1024) continue;
      // Give the pasted file a sensible name — most clipboard images
      // arrive unnamed (e.g. screenshots). Without a name the preview
      // key collides and the remove button breaks.
      const named = file.name && file.name.length > 0
        ? file
        : new File([file], `pasted-${Date.now()}.${(file.type.split("/")[1] || "png")}`, { type: file.type });
      accepted.push(named);
    }
    if (accepted.length > 0) onFileSelect(accepted);
  };

  const handlePrimaryClick = useCallback(() => {
    if (isStreaming) {
      onStop?.();
    } else {
      onSend();
    }
  }, [isStreaming, onStop, onSend]);

  const hasText = input.trim().length > 0;
  const canSend = !isStreaming && (hasText || attachments.length > 0) && !sending && block.canWrite;
  const primaryActive = isStreaming || canSend;
  // Micrófono-primario (HANDOFF §1.3): sin texto NI adjuntos → a la derecha el
  // mic; con texto → el botón enviar. Si el navegador no soporta dictado,
  // mostramos enviar (deshabilitado) en vez del mic.
  const showMicPrimary =
    !hasText && attachments.length === 0 && !isStreaming && isLoggedIn && isSupported && block.canWrite;
  const showPlaceholder = input.length === 0;
  const recTimer = `${Math.floor(recSec / 60)}:${String(recSec % 60).padStart(2, "0")}`;

  return (
    <div
      className="px-3 sm:px-4 pt-2 flex-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* max-w-2xl (672px): un pelo más angosto que la columna de mensajes
          (3xl). OJO: si cambias este ancho, ajusta el max-w-[704px] del wrapper
          en EmptyState para que el despegue FLIP siga siendo un deslizamiento
          puro, sin saltos de ancho. */}
      <div className="max-w-2xl mx-auto">
        {/* (Se quitó la píldora "Te quedan N mensajes": ya no mostramos el
            conteo restante; el límite lo comunica el chat al agotarse.) */}

        {/* Chips de adjuntos (HANDOFF §1.6) — arriba del input */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((file, i) => {
              const key = file.name + file.size;
              const isImage = file.type.startsWith("image/");
              return (
                <div key={i} className="relative group">
                  {isImage ? (
                    <img src={previewUrls[key]} alt={file.name}
                      className="w-10 h-10 rounded-xl object-cover"
                      style={{ backgroundColor: "var(--surface)" }} />
                  ) : (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: "var(--surface)" }}>
                      <svg className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                  <button onClick={() => onRemoveAttachment(file.name, file.size)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "var(--danger)", color: "white" }}>
                    <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Superficie del composer. .vc-surface activa el anillo de foco por
            :focus-within (HANDOFF §1.7, sin JS). data-chat-input-pill lo mide
            el FLIP del empty state. */}
        <div
          data-chat-input-pill
          className="vc-surface relative rounded-[24px] px-3.5 pt-3.5 pb-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
            border: "1px solid var(--border)",
            backdropFilter: "blur(20px) saturate(1.2)",
            WebkitBackdropFilter: "blur(20px) saturate(1.2)",
            boxShadow: "0 6px 22px rgba(0,0,0,0.06)",
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag & drop overlay (HANDOFF §1.6) — punteado + "Suelta para
              adjuntar". pointer-events:none para que el drop llegue al wrapper. */}
          {isDragging && (
            <div
              className="absolute inset-0 rounded-[24px] pointer-events-none z-20 flex items-center justify-center gap-2.5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary) 16%, transparent)",
                border: "2px dashed var(--primary)",
              }}
            >
              <svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              <span className="text-[15px] font-semibold" style={{ color: "var(--primary)" }}>Suelta para adjuntar</span>
            </div>
          )}

          {isListening ? (
            /* Vista de grabación (HANDOFF §1.4) — reemplaza al textarea. */
            <div className="flex items-center gap-2.5 min-h-[42px]">
              <span className="vc-recdot w-[9px] h-[9px] rounded-full shrink-0"
                style={{ backgroundColor: "#E5484D", animation: "vc-pulse 1.2s ease-in-out infinite" }} />
              <span className="text-[14.5px] font-semibold shrink-0" style={{ color: "var(--text-primary)" }}>Escuchando</span>
              <span className="text-[13px] font-medium shrink-0 tabular-nums" style={{ color: "var(--text-secondary)" }}>{recTimer}</span>
              <div className="flex-1 flex items-center justify-center gap-[3px] h-6 overflow-hidden">
                {WAVE_BARS.map((b, i) => (
                  <span key={i} className="vc-wavebar w-[3px] rounded-[2px] shrink-0"
                    style={{ height: b.h, backgroundColor: "var(--primary)", transformOrigin: "center", animation: `vc-wave .95s ease-in-out ${b.delay} infinite` }} />
                ))}
              </div>
              <button onClick={cancel} title="Cancelar"
                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-secondary)" }}>
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button onClick={stop} title="Listo"
                className="w-[42px] h-[42px] rounded-full flex items-center justify-center shrink-0 text-white transition-transform active:scale-95"
                style={{ backgroundColor: "var(--primary)", boxShadow: "0 2px 8px color-mix(in srgb, var(--primary) 22%, transparent)" }}>
                <svg className="w-[19px] h-[19px]" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              {/* Textarea + placeholder superpuesto (HANDOFF §1.1) */}
              <div className="relative">
                {showPlaceholder && (
                  <span
                    className={`vc-ph ${block.canWrite ? phClass : "vc-ph-show"} absolute left-0.5 top-1 right-0.5 pointer-events-none truncate`}
                    style={{ font: "400 16px/1.5 Inter, sans-serif", color: "var(--text-secondary)" }}
                  >
                    {block.canWrite ? PLACEHOLDER_PROMPTS[phIdx] : "Sin suscripcion activa..."}
                  </span>
                )}
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  placeholder=""
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (canSend) onSend();
                    }
                  }}
                  onPaste={handlePaste}
                  disabled={!block.canWrite}
                  className="w-full bg-transparent text-base outline-none resize-none px-0.5 pt-0.5 overflow-hidden chat-input-field"
                  style={{
                    color: block.canWrite ? "var(--text-primary)" : "var(--text-tertiary)",
                    maxHeight: "180px",
                    lineHeight: "24px",
                  }}
                />
              </div>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
                onChange={handleFileSelect} className="hidden" />

              {/* Fila de acciones — adjuntar a la izquierda; a la derecha el
                  mic (vacío) o enviar/stop (con texto / generando). */}
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <div className="flex items-center gap-0.5">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!isLoggedIn || attachments.length >= 3 || !block.canWrite || sending || isStreaming}
                    className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors hover:bg-[var(--surface-hover)] disabled:opacity-30"
                    style={{ color: "var(--text-tertiary)" }}
                    title="Adjuntar archivo"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center">
                  {showMicPrimary ? (
                    /* Mic-primario (vacío) */
                    <button
                      onClick={handleMicClick}
                      className="shrink-0 w-[42px] h-[42px] rounded-full flex items-center justify-center transition-transform active:scale-95"
                      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--primary)" }}
                      title="Dictar mensaje"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                      </svg>
                    </button>
                  ) : isStreaming ? (
                    /* Stop con anillo girando (HANDOFF §1.5) */
                    <button
                      onClick={handlePrimaryClick}
                      aria-label="Detener respuesta"
                      title="Detener respuesta"
                      className="shrink-0 relative w-[42px] h-[42px] rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "var(--primary)" }}
                    >
                      <span className="vc-spinring absolute rounded-full"
                        style={{ inset: -4, border: "2px solid var(--primary)", borderTopColor: "transparent", opacity: 0.45, animation: "vc-spin .8s linear infinite" }} />
                      <span className="rounded-[3px]" style={{ width: 12, height: 12, backgroundColor: "#fff" }} />
                    </button>
                  ) : (
                    /* Enviar (flecha ↑) */
                    <button
                      onClick={handlePrimaryClick}
                      disabled={!primaryActive}
                      aria-label="Enviar mensaje"
                      title="Enviar"
                      className="shrink-0 w-[42px] h-[42px] rounded-full flex items-center justify-center transition-all duration-200"
                      style={
                        canSend
                          ? { backgroundColor: "var(--primary)", color: "#fff", boxShadow: "0 3px 10px color-mix(in srgb, var(--primary) 24%, transparent)" }
                          : { backgroundColor: "transparent", color: "var(--text-tertiary)", border: "1px solid var(--border)", opacity: 0.55 }
                      }
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Expandir — editor a pantalla completa para mensajes largos. */}
              {!isStreaming && input.length > 240 && !isExpanded && (
                <button
                  onClick={() => setIsExpanded(true)}
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors z-10"
                  style={{ color: "var(--text-tertiary)" }}
                  title="Expandir editor"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* Debajo del input: "pensando" (generando) / "transcribiendo" /
            disclaimer (HANDOFF §1.5). */}
        {isStreaming ? (
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="inline-flex gap-[3px]">
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} className="vc-blinkdot w-[5px] h-[5px] rounded-full"
                  style={{ backgroundColor: "var(--primary)", animation: `vc-blink 1.2s ease-in-out ${d}s infinite` }} />
              ))}
            </span>
            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>VeChat está pensando…</span>
          </div>
        ) : !isListening && isProcessing ? (
          <div className="flex items-center justify-center gap-2 mt-3">
            <span className="inline-block w-3 h-3 rounded-full animate-spin"
              style={{ border: "2px solid var(--border)", borderTopColor: "var(--primary)" }} />
            <span className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Transcribiendo…</span>
          </div>
        ) : (
          <p className="text-center mt-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
            VeChat puede equivocarse. Verifica lo importante.
          </p>
        )}

        {isExpanded && (
          <ExpandInputModal
            initialValue={input}
            onCommit={(text) => {
              setInput(text);
              setIsExpanded(false);
              requestAnimationFrame(() => {
                const ta = textareaRef.current;
                if (!ta) return;
                ta.style.height = "auto";
                ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
              });
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )}

        {error && (
          <p className="text-[0.7rem] mt-1.5 text-center" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
