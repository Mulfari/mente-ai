"use client";

import React from "react";
import ChatInput from "./ChatInput";
import DiscoverSuggestions, { type TrendingSections } from "./DiscoverSuggestions";

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
  isStreaming?: boolean;
  onStop?: () => void;
  convId?: string | null;
  autoFocus?: boolean;
};

type Props = ChatInputProps & {
  userName?: string;
  suggestions: string[];
  suggestionsLoading: boolean;
  submitSuggestion: (
    s: string,
    meta?: { categoryId?: string; subOptionId?: string; source?: "discover" | "typed" }
  ) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
  trendingTopSubOptions?: TrendingSections;
  trendingLoading?: boolean;
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
    trendingTopSubOptions,
    trendingLoading,
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
    <div className="relative min-h-full flex flex-col">
      {/* Hero — flex-1, anchored to the bottom of its area so it sits
          right above the input. As the input grows, hero shrinks.
          This replaces the old absolute positioning which caused
          overlap when the input hit 5+ lines. */}
      <div className="flex-1 flex items-end justify-center px-4 pb-2 pointer-events-none">
        <div className="w-full max-w-2xl pointer-events-auto">
          <Hero opener={opener} className={heroShown ? "lm-fade-up" : "opacity-0"} />
        </div>
      </div>

      {/* Input — flex-none so it takes only its natural height.
          pointer-events-none on the wrapper + pointer-events-auto on
          the input itself, same as before. max-w-xl keeps the input
          visually lighter than the hero/footer so the cards get more
          weight. convId={null} scopes the draft to a shared "new" key
          since no conversation exists yet. isStreaming is always false
          in this view (we're in the welcome state, not mid-response). */}
      <div className="flex-none max-w-xl mx-auto px-4 w-full z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
            convId={null}
            isStreaming={false}
          />
        </div>
      </div>

      {/* Footer — flex-1, anchored to the top of its area so it sits
          right below the input. Internal overflow-y-auto so a long
          list of suggestions scrolls inside the footer area without
          pushing the input off-screen. */}
      <div
        className={`flex-1 flex justify-center px-4 pt-2 pb-4 pointer-events-none ${footerShown ? "lm-fade-up" : "opacity-0"}`}
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
            trendingTopSubOptions={trendingTopSubOptions}
            trendingLoading={trendingLoading}
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
        className="text-2xl sm:text-3xl font-semibold tracking-tighter"
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
  submitSuggestion: (
    s: string,
    meta?: { categoryId?: string; subOptionId?: string; source?: "discover" | "typed" }
  ) => void;
  onShowAuthPrompt: () => void;
  onShowAccountMenu: () => void;
  trendingTopSubOptions?: TrendingSections;
  trendingLoading?: boolean;
};

function Footer({
  isLoggedIn,
  suggestions,
  suggestionsLoading,
  getBlockReason,
  submitSuggestion,
  onShowAuthPrompt,
  onShowAccountMenu,
  trendingTopSubOptions,
  trendingLoading,
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
      onSelect={(s, meta) => submitSuggestion(s, meta)}
      sections={trendingTopSubOptions ?? { trending: [], nearYou: [], forYou: [], recent: [] }}
      loading={trendingLoading}
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
