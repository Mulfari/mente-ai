"use client";

import React from "react";
import ChatInput from "./ChatInput";
import DiscoverSuggestions from "./DiscoverSuggestions";

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
  "¿Qué te cuenta?",
  "Dime, ¿qué se te ofrece?",
  "A la orden",
  "¿En qué te ayudo?",
  "Cuéntame",
  "Mándame",
  "¿Qué tocamos hoy?",
];

const OPENERS_WITH_NAME = [
  "A ver, {name}, ¿qué hay?",
  "Dime, {name}, ¿qué se te ofrece?",
  "¿Qué te cuenta, {name}?",
  "Cuéntame, {name}",
  "A la orden, {name}",
  "¿Cómo te puedo ayudar, {name}?",
  "Aquí estoy, {name}, ¿qué toca?",
  "Hola, {name}, ¿qué vamos a hacer?",
  "Buenas, {name}, ¿qué necesitas?",
  "{name}, ¿qué se te ocurre?",
  "¿Qué hay de nuevo, {name}?",
];

const FALLBACK_BRAND = "VeChat";

function getFirstName(fullName?: string): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// FNV-1a 32-bit hash — stable across SSR and client, so the same firstName
// always renders the same opener. Avoids the SSR/CSR hydration mismatch and
// the "brinco" hop from Math.random() in a post-mount useEffect.
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickStable<T>(arr: readonly T[], seed: string): T {
  return arr[hashString(seed) % arr.length];
}

function pickOpener(firstName: string | null, isLoggedIn: boolean): string {
  if (!isLoggedIn) return FALLBACK_BRAND;
  if (firstName) {
    return pickStable(OPENERS_WITH_NAME, firstName).replace("{name}", firstName);
  }
  return OPENERS_NO_NAME[0];
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
  const opener = React.useMemo(
    () => pickOpener(firstName, isLoggedIn),
    [firstName, isLoggedIn]
  );

  // Gemini-style load cascade: the input commits on the first paint and
  // stays alone for a beat (so the user registers it as the "loading
  // state" of the page), then the hero fades in, then a short pause,
  // then the footer fades in. Visual only — does not block on data.
  // Suggestions still render their existing loading skeleton if the API
  // is still in flight.
  const [heroShown, setHeroShown] = React.useState(false);
  const [footerShown, setFooterShown] = React.useState(false);
  React.useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | null = null;
    let t2: ReturnType<typeof setTimeout> | null = null;
    // Input alone for ~320ms before the hero starts.
    t1 = setTimeout(() => setHeroShown(true), 320);
    // Hero animation lasts 400ms (80ms delay + 400ms keyframe). Footer
    // starts ~50ms after the hero lands, so the two fades don't overlap
    // and each step reads as a distinct beat. Total cascade ≈ 1170ms.
    t2 = setTimeout(() => setFooterShown(true), 770);
    return () => {
      if (t1) clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, []);

  return (
    <div className="relative min-h-full">
      {/* Hero — absolute, just above the Input's center.
          Input wrapper is 98px (49 half), gap is 7px → 56px above center.
          Using 50% (not 50vh) so the layout is relative to the chat area,
          not the viewport — works correctly next to the sidebar. */}
      <div
        className="absolute left-0 right-0 px-4 flex justify-center pointer-events-none"
        style={{ bottom: "calc(50% + 56px)" }}
      >
        <div className="w-full max-w-2xl pointer-events-auto">
          <Hero opener={opener} className={heroShown ? "lm-fade-up" : "opacity-0"} />
        </div>
      </div>

      {/* Footer — fills the bottom half of the chat area (from just below the
          input down to the bottom edge), with internal scroll when its content
          overflows. The scroll container is the inner max-w-2xl div (not the
          outer wrapper) so the scrollbar sits at the right edge of the
          content, not at the right edge of the main area. */}
      <div
        className={`absolute left-0 right-0 px-4 flex justify-center pointer-events-none ${footerShown ? "lm-fade-up" : "opacity-0"}`}
        style={{ top: "calc(50% + 56px)", bottom: 0 }}
      >
        <div
          className="w-full max-w-2xl pointer-events-auto overflow-y-auto"
          style={{ maxHeight: "100%" }}
        >
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

      {/* Input — absolute, centered in the chat area. pointer-events-none
          on the wrapper so clicks on the hero/footer underneath still
          work; pointer-events-auto on the input itself. */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 max-w-2xl mx-auto px-4 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    </div>
  );
}

function Hero({ opener, className }: { opener: string; className?: string }) {
  return (
    <header className={`text-center ${className ?? ""}`} style={{ animationDelay: "80ms" }}>
      <h1
        className="text-3xl sm:text-4xl font-semibold tracking-tighter"
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

  return (
    <DiscoverSuggestions
      suggestions={suggestions}
      loading={suggestionsLoading}
      onSelect={submitSuggestion}
    />
  );
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
