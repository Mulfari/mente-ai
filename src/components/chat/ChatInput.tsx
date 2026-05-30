"use client";

import React, { useState, useRef, useEffect } from "react";

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
  attachments: FilePreview[];
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }

  useEffect(() => {
    autoResize();
  }, [input]);

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

        {/* Floating input card */}
        <div className="relative">
          <div className="rounded-2xl overflow-hidden"
            style={{
              backgroundColor: "rgba(26,26,26,0.8)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
            }}>

            {/* Mode selector — pill tabs */}
            <div className="flex items-center gap-1 px-4 pt-3">
              <button onClick={() => setResponseMode("normal")}
                className="relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all"
                style={{ color: responseMode === "normal" ? "var(--primary)" : "var(--text-tertiary)" }}>
                {responseMode === "normal" && (
                  <span className="absolute inset-0 rounded-full border" style={{ borderColor: "var(--primary)", opacity: 0.3 }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Normal
                </span>
              </button>
              <button onClick={() => setResponseMode("deep")}
                className="relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all"
                style={{ color: responseMode === "deep" ? "#a78bfa" : "var(--text-tertiary)" }}>
                {responseMode === "deep" && (
                  <span className="absolute inset-0 rounded-full border" style={{ borderColor: "#a78bfa", opacity: 0.4 }} />
                )}
                <span className="relative flex items-center gap-1.5">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Pensar
                </span>
              </button>
              <div className="flex-1 h-px mx-2" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
              {/* Attachment */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= 3 || !block.canWrite || sending}
                className="shrink-0 p-1.5 rounded-full transition-all hover:bg-white/5 disabled:opacity-30"
                style={{ color: "var(--text-tertiary)" }}
                title="Adjuntar">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
                onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Text area */}
            <div className="flex items-end gap-2 px-3 pb-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                placeholder={(() => {
                  if (!isLoggedIn) return "Inicia sesion para chatear...";
                  if (!block.canWrite) return "Sin suscripcion activa...";
                  return "Escribe un mensaje...";
                })()}
                disabled={sending || !block.canWrite}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent leading-relaxed py-1"
                style={{ color: block.canWrite ? "var(--text-primary)" : "var(--text-tertiary)", maxHeight: "200px" }}
              />
              <button
                onClick={onSend}
                disabled={(!input.trim() && attachments.length === 0) || sending || !block.canWrite}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white", boxShadow: "0 2px 12px color-mix(in srgb, var(--primary) 40%, transparent)" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
