"use client";

import React from "react";
import ChatInput from "./ChatInput";
import TrendingFeed from "./TrendingFeed";
import type { PublicFeed } from "@/lib/feed";

// Empty state unificado: la MISMA pantalla para el visitante deslogueado y
// para el usuario sin conversación activa. Hero + input centrados a pantalla
// completa; el feed de tendencias vive debajo del fold (scroll interno).
// La única diferencia entre estados es qué hace interactuar (registrarse vs.
// enviar directo) — eso lo decide el padre (ChatInterface).

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
  feed: PublicFeed | null;
  submitSuggestion: (
    s: string,
    meta?: { categoryId?: string; subOptionId?: string; source?: "discover" | "typed" }
  ) => void;
  onShowAccountMenu: () => void;
};

const OPENERS_NO_NAME = [
  "¿Qué te cuenta?",
  "Dime, ¿qué se te ofrece?",
  "A la orden",
  "¿En qué te ayudo?",
  "Cuéntame",
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

const OPENER_GUEST = "Epa, ¿qué te cuenta?";

function getFirstName(fullName?: string): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

// FNV-1a 32-bit hash — stable across SSR and client, so the same firstName
// always renders the same opener (no hydration mismatch).
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
  if (!isLoggedIn) return OPENER_GUEST;
  if (firstName) {
    return pickStable(OPENERS_WITH_NAME, firstName).replace("{name}", firstName);
  }
  return OPENERS_NO_NAME[0];
}

function ChevronDown() {
  return (
    <svg width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function EmptyState(props: Props) {
  const {
    userName,
    isLoggedIn,
    feed,
    getBlockReason,
    submitSuggestion,
    onShowAccountMenu,
    ...chatInputProps
  } = props;

  const firstName = getFirstName(userName);
  const opener = React.useMemo(
    () => pickOpener(firstName, isLoggedIn),
    [firstName, isLoggedIn]
  );

  const block = getBlockReason();
  const feedRef = React.useRef<HTMLDivElement>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Cascada de entrada: input primero, hero después, feed al final.
  const [heroShown, setHeroShown] = React.useState(false);
  const [feedShown, setFeedShown] = React.useState(false);
  React.useEffect(() => {
    const t1 = setTimeout(() => setHeroShown(true), 320);
    const t2 = setTimeout(() => setFeedShown(true), 770);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      {/* ── Pantalla 1: hero + input centrados ── */}
      <section className="min-h-full relative flex flex-col items-center justify-center px-4">
        <header className={`text-center mb-6 ${heroShown ? "lm-fade-up" : "opacity-0"}`} style={{ animationDelay: "80ms" }}>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tighter"
            style={{ color: "var(--text-primary)" }}
          >
            {opener}
          </h1>
          {!isLoggedIn && (
            <p className="text-[13.5px] mt-1.5" style={{ color: "var(--text-secondary)" }}>
              La IA que sí sabe de Venezuela — pregunta lo que sea
            </p>
          )}
        </header>

        <div className="w-full max-w-xl">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
            convId={null}
            isStreaming={false}
          />
        </div>

        {!isLoggedIn && (
          <p className={`text-[12px] mt-4 ${heroShown ? "lm-fade-up" : "opacity-0"}`} style={{ color: "var(--text-tertiary)" }}>
            Gratis para empezar — crea tu cuenta en 10 segundos con Google
          </p>
        )}

        {isLoggedIn && !block.canWrite && (
          <div className={`text-center mt-5 ${heroShown ? "lm-fade-up" : "opacity-0"}`}>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--warning)" }}>
              Suscripción bloqueada
            </p>
            <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
              {block.reason}
            </p>
            <button
              onClick={onShowAccountMenu}
              className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 text-white"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}
            >
              Añadir tiempo
            </button>
          </div>
        )}

        {/* Hint de scroll hacia el feed */}
        <button
          onClick={() => feedRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Ver tendencias"
          className={`absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 cursor-pointer transition-opacity hover:opacity-70 ${feedShown ? "gentle-fade" : "opacity-0"}`}
          style={{ color: "var(--text-tertiary)" }}
        >
          <span className="text-[11.5px]">Mira lo que se pregunta la gente</span>
          <span className="animate-bounce">
            <ChevronDown />
          </span>
        </button>
      </section>

      {/* ── Pantalla 2: feed de tendencias (debajo del fold) ── */}
      <section ref={feedRef} className={`max-w-2xl mx-auto px-4 pt-8 pb-20 ${feedShown ? "gentle-fade" : "opacity-0"}`}>
        <TrendingFeed
          feed={feed}
          onAsk={(prompt) => submitSuggestion(prompt, { source: "discover" })}
        />
      </section>
    </div>
  );
}
