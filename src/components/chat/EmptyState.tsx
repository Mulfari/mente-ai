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
  className?: string;
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
  className,
}: Props) {
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center px-4 ${className || ""}`}>
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="text-center mb-8">
          {/* Gradient logo */}
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{
              background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
              boxShadow: "0 0 40px color-mix(in srgb, var(--primary) 30%, transparent)",
            }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>VeChat</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Tu asistente de IA personal
          </p>
        </div>

        {!isLoggedIn && (
          <div className="text-center">
            <button onClick={onShowAuthPrompt}
              className="px-8 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
              style={{
                background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
                color: "white",
                boxShadow: "0 8px 32px color-mix(in srgb, var(--primary) 35%, transparent)",
              }}>
              Iniciar sesion
            </button>
          </div>
        )}

        {/* Logged in: input + suggestions */}
        {isLoggedIn && chatInputProps && (
          <div className="flex flex-col items-center gap-6">
            {(() => {
              const block = getBlockReason();
              if (!block.canWrite) {
                return (
                  <div className="text-center py-6">
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
                <>
                  {/* Hero input — prominent centered card */}
                  <div className="w-full max-w-lg mx-auto">
                    <ChatInput {...chatInputProps} />
                  </div>

                  {/* Suggestions — subtle pills below */}
                  {suggestions.length > 0 && (
                    <div className="flex flex-col items-center gap-3 w-full max-w-lg mx-auto">
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                        O pregunta algo
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {suggestions.map((s, i) => (
                          <button key={i} onClick={() => submitSuggestion(s)}
                            className="text-left px-4 py-2 rounded-2xl text-xs transition-all flex items-center gap-2 group"
                            style={{
                              backgroundColor: "var(--surface)",
                              border: "1px solid var(--border)",
                              color: "rgba(255,255,255,0.6)",
                            }}>
                            <span className="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                              </svg>
                            </span>
                            <span className="group-hover:text-[var(--primary)] transition-colors">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
