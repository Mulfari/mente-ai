"use client";

import React, { useRef, useState, useEffect, useLayoutEffect } from "react";
import { useSpeechRecognitionServer } from "@/lib/voice-server";
import ExpandInputModal from "./ExpandInputModal";

type BlockReason = {
  canWrite: boolean;
  canSend: boolean;
  reason: string;
};

type FilePreview = File;

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
  autoFocus?: boolean;
};

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
  autoFocus,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(24);
  const [shape, setShape] = useState<"pill" | "box">("pill");
  const [isExpanded, setIsExpanded] = useState(false);

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
  // Voice input (STT) — usa ElevenLabs Scribe corriendo en el proxy /api/stt
  // en lugar de Web Speech API. Mejor para acento venezolano, ~$0.30/mes
  // para tu uso. Es batch (no streaming): el transcript aparece cuando
  // sueltas el botón, no en vivo. Si quieres streaming en vivo, dime.
  const { isListening, isProcessing, transcript, error, isSupported, start, stop, reset } = useSpeechRecognitionServer({
    lang: "es-VE",
  });

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

  // Auto-resize the textarea to fit its content. useLayoutEffect runs
  // before paint so we never see the old height flash. Reset to "auto"
  // first so scrollHeight reflects natural content height, then cap at
  // 160px (~6 lines at 24px line-height). When the cap is hit, the
  // textarea scrolls internally; the project hides scrollbars globally.
  // We also update `shape` and `measuredHeight` here so the wrapper can
  // transition between pill (1 line) and box (2+ lines) and the expand
  // button can appear at 5+ lines.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, 160);
    ta.style.height = `${next}px`;
    setMeasuredHeight(next);
    setShape(next > 40 ? "box" : "pill");
  }, [input, isExpanded]);

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

  const block = getBlockReason();
  const canSend = (input.trim() || attachments.length > 0) && !sending && block.canWrite;

  return (
    <div className="px-4 pb-4 pt-2 flex-none">
      <div className="max-w-4xl mx-auto">
        {/* Pill de estado cuando está grabando — sobre el input. */}
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
              onClick={stop}
              className="ml-2 opacity-70 hover:opacity-100"
              title="Detener"
            >
              ✕
            </button>
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

        {/* Input pill — items-end anchors the 48px buttons to the bottom
            of the container when the textarea grows, so they stay at the
            user's thumb on mobile. The textarea uses self-center to keep
            the text visually centered in 1-line mode.

            Shape is dynamic: `rounded-full` for 1-line, `rounded-2xl`
            for 2+ lines. The transition on `border-radius` runs at
            0.2s so the shape change feels tied to the height change. */}
        <div
          className={`relative flex items-end gap-1.5 ${shape === "pill" ? "rounded-full" : "rounded-2xl"} pl-5 pr-2 py-2`}
          style={{
            backgroundColor: "rgba(30,30,34,0.9)",
            border: `1px solid ${isFocused ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: isFocused
              ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent), 0 12px 40px rgba(0,0,0,0.4)"
              : "0 6px 24px rgba(0,0,0,0.3)",
            transition: "border-radius 0.2s var(--motion-standard), box-shadow 0.2s, border-color 0.2s",
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              setIsFocused(false);
            }
          }}
        >
          {/* Attach */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={attachments.length >= 3 || !block.canWrite || sending}
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 disabled:opacity-30"
            style={{ color: "var(--text-tertiary)" }}
            title="Adjuntar archivo"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
            onChange={handleFileSelect} className="hidden" />

          {/* Multi-line text area with auto-resize. Enter sends, Shift+Enter
              inserts a newline (default textarea behavior — our onKeyDown
              only intercepts plain Enter). Height is set dynamically by the
              useLayoutEffect above, capped at 160px via maxHeight. The
              `chat-input-field` class provides the 0.15s height transition
              (defined in globals.css) so the resize feels smooth. */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder={(() => {
              if (!isLoggedIn) return "Inicia sesion para chatear...";
              if (!block.canWrite) return "Sin suscripcion activa...";
              return "Pregúntale algo a VeChat...";
            })()}
            disabled={sending || !block.canWrite}
            className="flex-1 min-w-0 bg-transparent text-base outline-none resize-none self-center px-1 placeholder:text-[var(--text-tertiary)] overflow-hidden chat-input-field"
            style={{
              color: block.canWrite ? "var(--text-primary)" : "var(--text-tertiary)",
              maxHeight: "160px",
              lineHeight: "24px",
            }}
          />

          {/* Microphone — Web Speech API STT. Se muestra aunque el navegador
              no lo soporte, pero deshabilitado con tooltip explicativo
              en vez de desaparecer silenciosamente. */}
          <div className="shrink-0">
            <button
              onClick={handleMicClick}
              disabled={!isSupported || !block.canWrite || sending || isProcessing}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                !isSupported
                  ? "opacity-30 cursor-not-allowed"
                  : isProcessing
                  ? "opacity-70"
                  : isListening
                  ? "recording-pulse"
                  : "hover:bg-white/10"
              }`}
              style={{
                color: isListening ? "white" : "var(--text-tertiary)",
                backgroundColor: isListening ? "var(--danger)" : "transparent",
              }}
              title={
                !isSupported
                  ? "Tu navegador no soporta dictado por voz. Prueba Chrome o Safari."
                  : isProcessing
                  ? "Transcribiendo..."
                  : isListening
                  ? "Detener grabación"
                  : "Dictar mensaje"
              }
            >
              {isProcessing ? (
                // Spinner mientras ElevenLabs Scribe transcribe (~1-3s)
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={3} />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
              ) : isListening ? (
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

          {/* Send — solid color, filled paper plane */}
          <button
            onClick={onSend}
            disabled={!canSend}
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              backgroundColor: canSend ? "var(--primary)" : "rgba(255,255,255,0.05)",
              color: canSend ? "white" : "var(--text-tertiary)",
            }}
            title="Enviar"
            onMouseEnter={(e) => {
              if (canSend) e.currentTarget.style.backgroundColor = "var(--primary-hover)";
            }}
            onMouseLeave={(e) => {
              if (canSend) e.currentTarget.style.backgroundColor = "var(--primary)";
            }}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
            </svg>
          </button>

          {/* Expand — full-screen editor for very long messages. Shown
              when the textarea hits ~5 lines. Sits absolute in the
              corner of the wrapper so it doesn't shift the layout. */}
          {measuredHeight >= 120 && !isExpanded && (
            <button
              onClick={() => setIsExpanded(true)}
              className="absolute top-2 right-2 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/10 transition-colors z-10"
              style={{ color: "var(--text-tertiary)" }}
              title="Expandir editor"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </button>
          )}
        </div>

        {/* Full-screen editor modal. Local to the input — the modal
            commits the new text into the parent's `input` state and
            re-syncs the textarea height on the next frame. */}
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
