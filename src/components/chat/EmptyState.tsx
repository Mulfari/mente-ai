"use client";

import React from "react";
import ChatInput from "./ChatInput";

type BlockReason = {
  canWrite: boolean;
  canSend: boolean;
  reason: string;
};

type ChatInputProps = {
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
  autoFocus?: boolean;
};

type Props = ChatInputProps & {
  userName?: string;
  suggestions: string[];
  suggestionsLoading: boolean;
  submitSuggestion: (s: string) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
};

const OPENERS_NO_NAME = [
  "¿Qué te trae por aquí?",
  "¿En qué te ayudo?",
  "Dime, ¿qué necesitas?",
  "Pregunta lo que quieras",
  "¿Qué quieres saber?",
  "¿Qué se te ocurre?",
  "Cuéntame",
  "¿Qué tienes en mente?",
];

const OPENERS_WITH_NAME = [
  "Dime, {name}",
  "{name}, ¿qué te trae por aquí?",
  "Hola, {name}",
  "Cuéntame, {name}",
  "¿Qué necesitas, {name}?",
  "{name}, ¿qué se te ofrece?",
];

const FALLBACK_BRAND = "VeChat";

function getFirstName(fullName?: string): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function pickDaily<T>(arr: readonly T[], salt: number): T {
  return arr[salt % arr.length];
}

function useOpener(firstName: string | null, isLoggedIn: boolean) {
  return React.useMemo(() => {
    const now = new Date();
    const salt = now.getDate() + now.getMonth() * 31;
    if (!isLoggedIn) return FALLBACK_BRAND;
    if (firstName) {
      return pickDaily(OPENERS_WITH_NAME, salt).replace("{name}", firstName);
    }
    return pickDaily(OPENERS_NO_NAME, salt);
  }, [firstName, isLoggedIn]);
}

export default function EmptyState(props: Props) {
  const {
    userName,
    isLoggedIn,
    suggestions,
    suggestionsLoading,
    getBlockReason,
    submitSuggestion,
    onShowAuthPrompt,
    onShowAccountMenu,
    ...chatInputProps
  } = props;

  const firstName = getFirstName(userName);
  const opener = useOpener(firstName, isLoggedIn);

  return (
    <div
      className="flex flex-col items-center min-h-full px-4"
      style={{ animation: "fadeIn 0.5s ease-out" }}
    >
      <div className="flex-[2.5] w-full" aria-hidden />
      <div className="w-full max-w-2xl flex flex-col items-center pb-16 sm:pb-20">
        <Hero opener={opener} />

        <div className="w-full mt-5">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
          />
        </div>

        <div className="w-full mt-8">
          <Footer
            isLoggedIn={isLoggedIn}
            suggestions={suggestions}
            suggestionsLoading={suggestionsLoading}
            getBlockReason={getBlockReason}
            submitSuggestion={submitSuggestion}
            onShowAuthPrompt={onShowAuthPrompt}
            onShowAccountMenu={onShowAccountMenu}
          />
        </div>
      </div>
      <div className="flex-1 w-full" aria-hidden />
    </div>
  );
}

function Hero({ opener }: { opener: string }) {
  return (
    <header className="text-center">
      <p
        className="text-2xl sm:text-3xl font-medium tracking-tight"
        style={{ color: "var(--text-secondary)" }}
      >
        {opener}
      </p>
    </header>
  );
}

type FooterProps = {
  isLoggedIn: boolean;
  suggestions: string[];
  suggestionsLoading: boolean;
  getBlockReason: () => BlockReason;
  submitSuggestion: (s: string) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
};

function Footer({
  isLoggedIn,
  suggestions,
  suggestionsLoading,
  getBlockReason,
  submitSuggestion,
  onShowAuthPrompt,
  onShowAccountMenu,
}: FooterProps) {
  if (!isLoggedIn) {
    return <AuthPrompt onClick={onShowAuthPrompt} />;
  }

  const block = getBlockReason();
  if (!block.canWrite) {
    return <SubscriptionBlocked reason={block.reason} onAddTime={onShowAccountMenu} />;
  }

  if (suggestionsLoading) {
    return <SuggestionsSkeleton />;
  }

  return <SuggestionsGrid suggestions={suggestions} onClick={submitSuggestion} />;
}

function AuthPrompt({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-8 py-3.5 rounded-2xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
      style={{
        background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
        color: "white",
        boxShadow: "0 8px 32px color-mix(in srgb, var(--primary) 35%, transparent)",
      }}
    >
      Iniciar sesión
    </button>
  );
}

function SubscriptionBlocked({ reason, onAddTime }: { reason: string; onAddTime: () => void }) {
  return (
    <div className="text-center py-2">
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
        style={{ backgroundColor: "rgba(245,158,11,0.1)" }}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          style={{ color: "var(--warning)" }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--warning)" }}>
        Suscripción bloqueada
      </p>
      <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
        {reason}
      </p>
      <button
        onClick={onAddTime}
        className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
          color: "white",
        }}
      >
        Añadir tiempo
      </button>
    </div>
  );
}

function SuggestionsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 rounded-2xl animate-pulse"
          style={{ backgroundColor: "var(--surface)" }}
        />
      ))}
    </div>
  );
}

function SuggestionsGrid({
  suggestions,
  onClick,
}: {
  suggestions: string[];
  onClick: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onClick(s)}
          className="text-left px-4 py-3 rounded-2xl text-sm leading-snug transition-colors"
          style={{
            color: "var(--text-secondary)",
            backgroundColor: "transparent",
            border: "1px solid var(--border)",
            animation: `fadeIn 0.4s ease-out ${i * 60}ms backwards`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.borderColor = "color-mix(in srgb, var(--text-tertiary) 30%, transparent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
