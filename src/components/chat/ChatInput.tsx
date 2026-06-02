"use client";

import React, { useRef, useState } from "react";

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
  responseMode: "normal" | "deep";
  setResponseMode: (mode: "normal" | "deep") => void;
  getBlockReason: () => BlockReason;
  isLoggedIn: boolean;
  onSend: () => void;
  onFileSelect: (files: File[]) => void;
  onRemoveAttachment: (name: string, size: number) => void;
};

export default function ChatInput({
  input,
  setInput,
  sending,
  attachments,
  previewUrls,
  responseMode,
  setResponseMode,
  getBlockReason,
  isLoggedIn,
  onSend,
  onFileSelect,
  onRemoveAttachment,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

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

        {/* Single-line input pill */}
        <div
          className="relative flex items-center gap-1.5 rounded-full pl-5 pr-2 py-3 transition-all duration-200"
          style={{
            backgroundColor: "rgba(30,30,34,0.9)",
            border: `1px solid ${isFocused ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
            boxShadow: isFocused
              ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent), 0 12px 40px rgba(0,0,0,0.4)"
              : "0 6px 24px rgba(0,0,0,0.3)",
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

          {/* Single-line text input */}
          <input
            type="text"
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
            className="flex-1 min-w-0 bg-transparent text-base outline-none h-12 placeholder:text-[var(--text-tertiary)]"
            style={{ color: block.canWrite ? "var(--text-primary)" : "var(--text-tertiary)" }}
          />

          {/* Mode pill */}
          <button
            onClick={() => setResponseMode(responseMode === "normal" ? "deep" : "normal")}
            disabled={!block.canWrite}
            className="shrink-0 flex items-center gap-1.5 h-12 px-4 rounded-full text-sm font-medium transition-all"
            style={{
              color: responseMode === "deep" ? "#a78bfa" : "var(--text-tertiary)",
              backgroundColor: responseMode === "deep" ? "rgba(167,139,250,0.12)" : "transparent",
              border: "1px solid",
              borderColor: responseMode === "deep" ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.08)",
            }}
            title="Cambiar modo de respuesta"
            onMouseEnter={(e) => {
              if (responseMode !== "deep") {
                e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
            onMouseLeave={(e) => {
              if (responseMode !== "deep") {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                e.currentTarget.style.color = "var(--text-tertiary)";
              }
            }}
          >
            {responseMode === "normal" ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            <span className="hidden sm:inline">{responseMode === "normal" ? "Normal" : "Pensar"}</span>
          </button>

          {/* Send */}
          <button
            onClick={onSend}
            disabled={!canSend}
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
            style={{
              background: canSend
                ? "linear-gradient(135deg, var(--primary), var(--primary-hover))"
                : "rgba(255,255,255,0.06)",
              color: canSend ? "white" : "var(--text-tertiary)",
              boxShadow: canSend
                ? "0 2px 10px color-mix(in srgb, var(--primary) 40%, transparent), inset 0 1px 0 rgba(255,255,255,0.2)"
                : "none",
              transform: canSend ? "scale(1)" : "scale(0.94)",
            }}
            title="Enviar"
            onMouseEnter={(e) => {
              if (canSend) e.currentTarget.style.transform = "scale(1.06)";
            }}
            onMouseLeave={(e) => {
              if (canSend) e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
