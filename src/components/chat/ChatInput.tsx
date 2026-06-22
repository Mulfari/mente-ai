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

// Placeholder que rota por preguntas reales (estilo del diseño "Composer"):
// solo cicla con el input vacío y sin foco, para no cambiar bajo el usuario.
const PLACEHOLDER_PROMPTS = [
  "Pregúntale algo a VeChat...",
  "¿A cómo está el dólar hoy?",
  "Requisitos del pasaporte 2026",
  "¿Dónde desayunar cerca?",
  "Recetas con plátano",
];

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
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
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

  // Placeholder que rota por preguntas (solo con input vacío y sin foco).
  // Se congela mientras el usuario escribe, dicta o llega una respuesta.
  useEffect(() => {
    if (isFocused || input || isListening || isStreaming) return;
    const id = setInterval(() => {
      setPhIdx((i) => (i + 1) % PLACEHOLDER_PROMPTS.length);
    }, 3400);
    return () => clearInterval(id);
  }, [isFocused, input, isListening, isStreaming]);

  // Auto-resize the textarea to fit its content. useLayoutEffect runs
  // before paint so we never see the old height flash. Reset to "auto"
  // first so scrollHeight reflects natural content height, then cap at
  // 160px (~6 lines at 24px line-height). When the cap is hit, the
  // textarea scrolls internally; the project hides scrollbars globally.
  // The wrapper keeps a fixed `rounded-2xl` shape — the height grows
  // monotonically, the geometry never changes.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${next}px`;
  }, [input, isExpanded]);

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

  const block = getBlockReason();
  const canSend = !isStreaming && (input.trim() || attachments.length > 0) && !sending && block.canWrite;
  // The primary button is interactive in two mutually-exclusive cases:
  // streaming (becomes Stop) or ready to send. If neither, it's disabled.
  const primaryActive = isStreaming || canSend;

  return (
    // Wrapper exterior: padding lateral más generoso en desktop, compacto
    // en móvil para que el textarea gane ancho de escritura. El padding
    // inferior respeta el safe area del dispositivo (home bar del iPhone,
    // gesture bar de Android) — `max(0.75rem, env(safe-area-inset-bottom))`
    // toma el mayor entre 12px y el inset del SO.
    <div
      className="px-3 sm:px-4 pt-2 flex-none"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* max-w-2xl (672px): un pelo más angosto que la columna de mensajes
          (3xl) — el input queda recogido y cómodo de leer. OJO: si cambias
          este ancho, ajusta el max-w-[704px] del wrapper en EmptyState
          (672 + 32 de padding propio) para que el despegue FLIP siga
          siendo un deslizamiento puro sin saltos de ancho. */}
      <div className="max-w-2xl mx-auto">
        {showQuota && quotaLeft !== undefined && quotaLeft <= 3 && quotaLeft > 0 && (
          <div className="flex justify-center mb-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-full"
              style={{ color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
              Te {quotaLeft === 1 ? "queda 1 mensaje" : `quedan ${quotaLeft} mensajes`} gratis hoy
            </span>
          </div>
        )}
        {/* Pill de estado cuando está grabando — sobre el input. La ✕
            CANCELA (descarta el audio, no transcribe ni envía); para
            enviar lo dictado se toca el botón del mic (cuadrado rojo). */}
        {isListening && (
          <div
            className="flex items-center justify-center gap-2 mb-2 px-3 py-1.5 rounded-full text-xs font-medium animate-fadeInUp"
            style={{
              backgroundColor: "color-mix(in srgb, var(--danger) 15%, transparent)",
              color: "var(--danger)",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
              width: "fit-content",
              margin: "0 auto 8px",
            }}
          >
            <span className="inline-block w-2 h-2 rounded-full recording-pulse" style={{ backgroundColor: "var(--danger)" }} />
            Escuchando...
            <button
              onClick={cancel}
              className="ml-2 opacity-70 hover:opacity-100"
              title="Cancelar dictado"
              aria-label="Cancelar dictado"
            >
              ✕
            </button>
          </div>
        )}
        {/* Pill mientras se transcribe (1-3s tras soltar el mic) — antes
            no había feedback y el mensaje "se enviaba solo" de la nada. */}
        {!isListening && isProcessing && (
          <div
            className="flex items-center justify-center gap-2 mb-2 px-3 py-1.5 rounded-full text-xs font-medium animate-fadeInUp"
            style={{
              backgroundColor: "var(--surface-hover)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              width: "fit-content",
              margin: "0 auto 8px",
            }}
          >
            <span
              className="inline-block w-3 h-3 rounded-full animate-spin"
              style={{
                border: "2px solid var(--border)",
                borderTopColor: "var(--primary)",
              }}
            />
            Transcribiendo...
          </div>
        )}
        {/* Attachment previews */}
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

        {/* Composer (diseño "Composer"): caja cálida con el textarea a todo
            el ancho arriba y una fila de acciones debajo. Al enfocar, borde
            verde + anillo. data-chat-input-pill lo mide el FLIP del empty
            state — no lo quites. */}
        <div
          data-chat-input-pill
          className="relative rounded-[24px] px-3.5 pt-3 pb-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
            border: `1px solid ${isFocused ? "var(--primary)" : "var(--border)"}`,
            backdropFilter: "blur(20px) saturate(1.2)",
            WebkitBackdropFilter: "blur(20px) saturate(1.2)",
            boxShadow: isFocused
              ? "0 0 0 4px color-mix(in srgb, var(--primary) 13%, transparent), 0 8px 26px rgba(0,0,0,0.07)"
              : "0 6px 22px rgba(0,0,0,0.06)",
            transition: "box-shadow 0.16s, border-color 0.16s",
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsFocused(false);
            }
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Drag & drop overlay — non-interactive (pointer-events:none) so
              the drop event still reaches the wrapper. */}
          {isDragging && (
            <div
              className="absolute inset-0 rounded-[24px] pointer-events-none z-20 flex items-center justify-center"
              style={{
                backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)",
                border: "2px dashed var(--primary)",
              }}
            >
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                <svg className="w-4 h-4" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Suelta el archivo
              </div>
            </div>
          )}

          {/* Textarea a todo el ancho. Enter envía, Shift+Enter nueva línea.
              Altura dinámica (useLayoutEffect), tope 160px. Pegar imagen
              dispara el flujo de adjunto. */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                // Enter solo envía. Durante el streaming NO detiene (era una
                // sorpresa desagradable mientras redactabas el siguiente).
                if (canSend) onSend();
              }
            }}
            onPaste={handlePaste}
            placeholder={block.canWrite ? PLACEHOLDER_PROMPTS[phIdx] : "Sin suscripcion activa..."}
            // El textarea NO se deshabilita mientras se envía/streamea:
            // perder el foco y bloquear la escritura castigaba al usuario
            // que quería ir redactando el siguiente mensaje.
            disabled={!block.canWrite}
            className="w-full bg-transparent text-base outline-none resize-none px-0.5 pt-0.5 placeholder:text-[var(--text-tertiary)] overflow-hidden chat-input-field"
            style={{
              color: block.canWrite ? "var(--text-primary)" : "var(--text-tertiary)",
              maxHeight: "160px",
              lineHeight: "24px",
            }}
          />
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
            onChange={handleFileSelect} className="hidden" />

          {/* Fila de acciones — adjuntar + dictar a la izquierda, enviar a
              la derecha. Siempre visibles ambos (mic y enviar): VeChat usa
              dictado real, no el patrón "mic O enviar". */}
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <div className="flex items-center gap-0.5">
              {/* Adjuntar */}
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

              {/* Micrófono — STT. Se muestra aunque el navegador no lo
                  soporte, pero deshabilitado con tooltip explicativo. */}
              <button
                onClick={handleMicClick}
                disabled={!isLoggedIn || !isSupported || !block.canWrite || sending || isStreaming}
                className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  !isSupported
                    ? "opacity-30 cursor-not-allowed"
                    : isListening
                    ? "recording-pulse"
                    : "hover:bg-[var(--surface-hover)]"
                }`}
                style={{
                  color: isListening ? "white" : "var(--text-tertiary)",
                  backgroundColor: isListening ? "var(--danger)" : "transparent",
                }}
                title={
                  !isSupported
                    ? "Tu navegador no soporta dictado por voz. Prueba Chrome o Safari."
                    : isListening
                    ? "Detener grabación"
                    : "Dictar mensaje"
                }
              >
                {isListening ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Acción principal — Enviar (flecha ↑) en reposo, Detener
                (cuadrado) durante el streaming. El stop usa PRIMARY, no rojo
                (el rojo+cuadrado es el lenguaje del mic grabando). El hover
                vive en CSS (.chat-primary-action) por el vuelo FLIP al dock. */}
            <button
              onClick={handlePrimaryClick}
              disabled={!primaryActive}
              aria-label={isStreaming ? "Detener respuesta" : "Enviar mensaje"}
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 chat-primary-action ${primaryActive ? "is-active" : ""}`}
              title={isStreaming ? "Detener respuesta" : "Enviar"}
              style={primaryActive && !isStreaming ? { boxShadow: "0 3px 10px color-mix(in srgb, var(--primary) 24%, transparent)" } : undefined}
            >
              {isStreaming ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              )}
            </button>
          </div>

          {/* Expandir — editor a pantalla completa para mensajes largos.
              Absoluto en la esquina para no mover el layout. */}
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
        </div>

        {/* Disclaimer (estilo ChatGPT) */}
        <p className="text-center mt-3 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
          VeChat puede equivocarse. Verifica lo importante.
        </p>

        {/* Full-screen editor modal. Local to the input — commits the new
            text into the parent's `input` state and re-syncs the height. */}
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
                ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
              });
            }}
            onCancel={() => setIsExpanded(false)}
          />
        )}

        {/* Voice error message — auto-clears after 4s */}
        {error && (
          <p className="text-[0.7rem] mt-1.5 text-center" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
