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
    <div className="flex flex-col items-center min-h-full px-4">
      <div className="flex-[1.5] w-full" aria-hidden />
      <div className="w-full max-w-2xl flex flex-col items-center pb-16 sm:pb-20">
        <div className="w-full">
          <Hero opener={opener} />
        </div>

        <div className="w-full mt-5 gentle-fade" style={{ animationDelay: "0ms" }}>
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
          />
        </div>

        <div className="w-full mt-8 gentle-fade" style={{ animationDelay: "120ms" }}>
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
  const [displayed, setDisplayed] = React.useState("");

  React.useEffect(() => {
    setDisplayed("");
    if (!opener) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimer = setTimeout(() => {
      let i = 0;
      intervalId = setInterval(() => {
        i++;
        setDisplayed(opener.slice(0, i));
        if (i >= opener.length && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 30);
    }, 600);

    return () => {
      clearTimeout(startTimer);
      if (intervalId) clearInterval(intervalId);
    };
  }, [opener]);

  return (
    <header className="text-center">
      <h1
        className="text-3xl sm:text-4xl font-serif font-normal tracking-tight relative"
        style={{ color: "var(--text-primary)" }}
      >
        <span aria-hidden style={{ visibility: "hidden" }}>{opener}</span>
        <span className="absolute inset-0 flex items-center justify-center px-2">
          {displayed}
        </span>
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
    <div className="min-h-[16rem] sm:min-h-[14rem] w-full flex flex-col gap-5">
      <DiscoverSection onSelect={submitSuggestion} />
      <Divider />
      <QuickQuestions
        suggestions={suggestions}
        loading={suggestionsLoading}
        onSelect={submitSuggestion}
      />
    </div>
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

function SuggestionsSkeleton() {
  return (
    <div className="w-full">
      <div className="h-3 w-28 rounded animate-pulse" style={{ backgroundColor: "var(--surface)" }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-9 rounded-xl animate-pulse"
            style={{ backgroundColor: "var(--surface)" }}
          />
        ))}
      </div>
    </div>
  );
}

type Category = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
};

const CATEGORIES: Category[] = [
  {
    id: "comida",
    title: "Comida",
    subtitle: "Restaurantes y delivery",
    prompt: "¿Qué opciones para comer hay cerca de mí?",
    icon: <UtensilsIcon />,
  },
  {
    id: "servicios",
    title: "Servicios",
    subtitle: "Profesionales y técnicos",
    prompt: "¿Qué servicios hay disponibles cerca de mí?",
    icon: <HomeIcon />,
  },
  {
    id: "ofertas",
    title: "Ofertas",
    subtitle: "Promociones del día",
    prompt: "¿Qué ofertas hay hoy cerca de mí?",
    icon: <TagIcon />,
  },
];

function DiscoverSection({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="w-full">
      <SectionLabel icon={<MapPinIcon />}>Cerca de ti</SectionLabel>
      <div className="grid grid-cols-3 gap-2 w-full mt-3">
        {CATEGORIES.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            index={i}
            onClick={() => onSelect(cat.prompt)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  index,
  onClick,
}: {
  category: Category;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start text-left p-2.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 70}ms backwards`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 40%, transparent)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105"
        style={{ backgroundColor: "rgba(16,163,127,0.1)", color: "var(--primary)" }}
      >
        {category.icon}
      </div>
      <div
        className="text-[0.8rem] font-semibold leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {category.title}
      </div>
      <div
        className="text-[0.65rem] mt-0.5 leading-snug"
        style={{ color: "var(--text-tertiary)" }}
      >
        {category.subtitle}
      </div>
    </button>
  );
}

function SectionLabel({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider"
      style={{ color: "var(--text-tertiary)" }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-full h-px" style={{ backgroundColor: "var(--border)" }} />;
}

function QuickQuestions({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: string[];
  loading: boolean;
  onSelect: (s: string) => void;
}) {
  const showSkeleton = loading || suggestions.length === 0;
  return (
    <div className="w-full">
      <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-3">
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--surface)" }}
              />
            ))
          : suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="text-left px-3.5 py-2.5 rounded-xl text-[0.8rem] leading-snug transition-all"
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
    </div>
  );
}

function MapPinIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
      />
    </svg>
  );
}

function UtensilsIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 2v20" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 2v8a3 3 0 01-3 3v9"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12L12 3l9 9v9a1 1 0 01-1 1h-5v-7h-4v7H4a1 1 0 01-1-1v-9z"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"
      />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 21l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
