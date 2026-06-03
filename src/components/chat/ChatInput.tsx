"use client";

import React, { useRef, useState, useEffect } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

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
            ref={inputRef}
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

          {/* Microphone — placeholder for future voice input */}
          <button
            disabled
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center cursor-not-allowed"
            style={{ color: "var(--text-tertiary)", opacity: 0.5 }}
            title="Próximamente: entrada por voz"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
            </svg>
          </button>

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
        </div>
      </div>
    </div>
  );
}
