"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  initialValue: string;
  onCommit: (text: string) => void;
  onCancel: () => void;
};

// Full-screen editor for long chat messages. Same modal pattern as
// OnboardingTour / AccountMenu: portal to body, backdrop blur, click-
// outside closes, Esc closes, animate-modal-in for entrance.
export default function ExpandInputModal({ initialValue, onCommit, onCancel }: Props) {
  const [text, setText] = useState(initialValue);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMounted(true);
    const t = setTimeout(() => textareaRef.current?.focus(), 50);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onCancel]);

  if (!mounted) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center px-4 animate-fade-in"
      style={{ backgroundColor: "rgba(17,24,39,0.45)", backdropFilter: "blur(8px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col animate-modal-in"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          maxHeight: "80vh",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Editar mensaje
          </h3>
          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--surface-hover)] transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title="Cerrar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribí tu mensaje largo aquí..."
          className="flex-1 bg-transparent outline-none resize-none p-5 text-base"
          style={{
            color: "var(--text-primary)",
            minHeight: "60vh",
            lineHeight: "24px",
          }}
        />

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => onCommit(text)}
            disabled={!text.trim()}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{
              backgroundColor: "var(--primary)",
              color: "white",
            }}
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
