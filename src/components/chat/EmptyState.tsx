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

function pickOpener(firstName: string | null, isLoggedIn: boolean): string {
  if (!isLoggedIn) return FALLBACK_BRAND;
  if (firstName) {
    return pickRandom(OPENERS_WITH_NAME).replace("{name}", firstName);
  }
  return pickRandom(OPENERS_NO_NAME);
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
  const [opener, setOpener] = React.useState(() => pickOpener(firstName, isLoggedIn));
  React.useEffect(() => {
    setOpener(pickOpener(firstName, isLoggedIn));
  }, [firstName, isLoggedIn]);

  return (
    <>
      {/* Scrollable container: Hero and Footer are absolutely positioned
          around the fixed Input so the layout is symmetric regardless of
          the Footer's content height.

          The Input wrapper is 98px and is fixed at 50vh. We want:
            Hero bottom at 50vh - 49 - 7 = 50vh - 56 (7px above the Input)
            Footer top  at 50vh + 49 + 7 = 50vh + 56 (7px below the Input)

          The parent <main> has py-6 (24px) which shifts the EmptyState's
          coordinate system by 24px from the viewport. We subtract 24px
          from the calc to compensate, ending at calc(50vh + 32px) for
          both Hero's bottom and Footer's top. */}
      <div className="relative min-h-full">
        {/* Hero — absolute bottom = calc(50vh + 32px), so its bottom edge
            sits 7px above the Input's top edge. */}
        <div
          className="absolute left-0 right-0 px-4 flex justify-center pointer-events-none"
          style={{ bottom: "calc(50vh + 32px)" }}
        >
          <div className="w-full max-w-2xl pointer-events-auto">
            <Hero opener={opener} />
          </div>
        </div>

        {/* Footer — absolute top = calc(50vh + 32px), so its top edge
            sits 7px below the Input's bottom edge. pb-16/20 keeps it
            off the viewport bottom when it does fit. */}
        <div
          className="absolute left-0 right-0 px-4 flex justify-center pb-16 sm:pb-20 lm-fade-up pointer-events-none"
          style={{ top: "calc(50vh + 32px)" }}
        >
          <div className="w-full max-w-2xl pointer-events-auto">
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

      {/* Input — fixed at viewport center. Sits on top of the scrollable
          layer so the user always sees it; pointer-events on the wrapper
          is none so clicks on the hero/footer underneath still work. */}
      <div className="fixed inset-x-0 top-1/2 -translate-y-1/2 max-w-2xl mx-auto px-4 z-10 pointer-events-none">
        <div className="pointer-events-auto">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
          />
        </div>
      </div>
    </>
  );
}

function Hero({ opener }: { opener: string }) {
  return (
    <header className="text-center lm-fade-up" style={{ animationDelay: "80ms" }}>
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
