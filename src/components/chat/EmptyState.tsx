"use client";

import React from "react";
import dynamic from "next/dynamic";

const ChatInput = dynamic(() => import("./ChatInput"));

type BlockReason = {
  canWrite: boolean;
  canSend: boolean;
  reason: string;
};

type ChatInputProps = {
  input: string;
  setInput: (val: string) => void;
  sending: boolean;
  attachments: any[];
  previewUrls: Record<string, string>;
  responseMode: "normal" | "deep";
  setResponseMode: (mode: "normal" | "deep") => void;
  getBlockReason: () => BlockReason;
  isLoggedIn: boolean;
  onSend: () => void;
  onFileSelect: (files: File[]) => void;
  onRemoveAttachment: (name: string, size: number) => void;
};

type Props = {
  isLoggedIn: boolean;
  suggestions: string[];
  suggestionsLoading: boolean;
  getBlockReason: () => BlockReason;
  submitSuggestion: (s: string) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
  chatInputProps?: ChatInputProps;
};

export default function EmptyState({
  isLoggedIn,
  suggestions,
  suggestionsLoading,
  getBlockReason,
  submitSuggestion,
  onShowAuthPrompt,
  onShowAccountMenu,
  chatInputProps,
}: Props) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="text-center mb-6">
          {/* Gradient logo */}
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1.5" style={{ color: "var(--text-primary)" }}>VeChat</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Tu asistente de IA personal
          </p>
        </div>

        {!isLoggedIn && (
          <div className="text-center mt-2 mb-6">
            <button onClick={onShowAuthPrompt}
              className="px-6 sm:px-10 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
              Iniciar sesion
            </button>
          </div>
        )}

        {/* Suggestions or blocked state */}
        {isLoggedIn && chatInputProps && (
          <div>
            {(() => {
              const block = getBlockReason();
              if (!block.canWrite) {
                return (
                  <div className="text-center py-8">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                      style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                        style={{ color: "var(--warning)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--warning)" }}>
                      {"Suscripcion bloqueada"}
                    </p>
                    <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                      {block.reason}
                    </p>
                    <button onClick={onShowAccountMenu}
                      className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
                      Anadir tiempo
                    </button>
                  </div>
                );
              }

              if (suggestionsLoading) {
                return (
                  <div className="flex justify-center gap-2 flex-wrap">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="h-9 w-36 rounded-full animate-pulse" style={{ backgroundColor: "var(--surface)" }} />
                    ))}
                  </div>
                );
              }

              return (
                <div className="flex flex-col items-center gap-3">
                  <ChatInput {...chatInputProps} />
                  {suggestions.length > 0 && (
                    <>
                      <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.35)" }}>
                        O elige una pregunta
                      </p>
                      <div className="flex justify-center gap-2 flex-wrap">
                        {suggestions.map((s, i) => (
                          <button key={i} onClick={() => submitSuggestion(s)}
                            className="text-left px-4 py-2 rounded-full text-xs transition-all flex items-center gap-2 group"
                            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "rgba(255,255,255,0.7)" }}>
                            <span className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" }}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </span>
                            <span className="group-hover:text-[var(--primary)] transition-colors whitespace-nowrap">{s}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
