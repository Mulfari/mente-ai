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
};

type Props = ChatInputProps & {
  userName?: string;
  suggestions: string[];
  suggestionsLoading: boolean;
  submitSuggestion: (s: string) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
};

// Suggestions come from /api/suggestions in this fixed order.
// Index N = category N. Used for icon + color per card.
const SUGGESTION_CATEGORIES = [
  { color: "#A78BFA", label: "Crear" },
  { color: "#60A5FA", label: "Aprender" },
  { color: "#34D399", label: "Productividad" },
  { color: "#F472B6", label: "Vida" },
] as const;

type Period = "morning" | "afternoon" | "evening";

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

function getPeriod(hour: number): Period {
  if (hour < 12) return "morning";
  if (hour < 19) return "afternoon";
  return "evening";
}

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
      className="flex flex-col items-center justify-center min-h-full px-4"
      style={{ animation: "fadeIn 0.5s ease-out" }}
    >
      <div className="w-full max-w-2xl flex flex-col items-center pt-16 pb-24 sm:pt-24 sm:pb-32">
        <Hero opener={opener} />

        <div className="w-full mt-6">
          <ChatInput
            {...chatInputProps}
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
          />
        </div>

        <div className="w-full mt-12 sm:mt-14">
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
    </div>
  );
}

function Hero({ opener }: { opener: string }) {
  return (
    <header className="text-center">
      <h1
        className="text-4xl sm:text-5xl font-medium tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {opener}
      </h1>
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-20 rounded-2xl animate-pulse"
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
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
      {suggestions.map((s, i) => {
        const cat = SUGGESTION_CATEGORIES[i % SUGGESTION_CATEGORIES.length];
        return (
          <button
            key={i}
            onClick={() => onClick(s)}
            className="text-left p-4 rounded-2xl transition-all group hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              animation: `fadeIn 0.4s ease-out ${i * 60}ms backwards`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = cat.color;
              e.currentTarget.style.backgroundColor = "var(--surface-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.backgroundColor = "var(--surface)";
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{
                backgroundColor: `${cat.color}1A`,
                color: cat.color,
              }}
            >
              <CategoryIcon index={i} />
            </div>
            <p
              className="text-sm leading-snug"
              style={{ color: "var(--text-primary)" }}
            >
              {s}
            </p>
            <p
              className="text-xs mt-1.5"
              style={{ color: "var(--text-tertiary)" }}
            >
              {cat.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function CategoryIcon({ index }: { index: number }) {
  // One icon per category, matched by index (creativity/learning/productivity/life).
  const icons = [
    // creativity — sparkles
    <svg key="c" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>,
    // learning — book
    <svg key="l" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>,
    // productivity — target
    <svg key="p" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>,
    // life — heart
    <svg key="li" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
    </svg>,
  ];
  return icons[index % icons.length];
}
