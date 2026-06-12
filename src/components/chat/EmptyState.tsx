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
  /** True mientras la primera pregunta está creando la conversación:
      hero, microcopy y feed se desvanecen; el input queda visible y
      luego el padre lo anima deslizándose hasta el dock inferior. */
  leaving?: boolean;
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

export default function EmptyState(props: Props) {
  const {
    userName,
    isLoggedIn,
    feed,
    getBlockReason,
    submitSuggestion,
    onShowAccountMenu,
    leaving = false,
    ...chatInputProps
  } = props;

  // Todo lo que NO es el input se desvanece al despegar la conversación.
  const leaveStyle: React.CSSProperties = leaving
    ? { opacity: 0, transition: "opacity 0.25s ease", pointerEvents: "none" }
    : {};

  const firstName = getFirstName(userName);
  const opener = React.useMemo(
    () => pickOpener(firstName, isLoggedIn),
    [firstName, isLoggedIn]
  );

  const block = getBlockReason();

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

  // El feed scrollea en SU PROPIA zona debajo del input; el hero y el input
  // son fijos y no se mueven jamás. La rueda del mouse sobre el hero se
  // reenvía al feed para que la página no se sienta muerta fuera de él.
  const feedScrollRef = React.useRef<HTMLElement>(null);

  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      onWheel={(e) => {
        const el = feedScrollRef.current;
        if (el && !el.contains(e.target as Node)) el.scrollTop += e.deltaY;
      }}
    >
      {/* Hero + input: FIJOS — ocupan la mitad superior anclados a su
          fondo (input centrado en pantalla); nada los tapa ni los mueve. */}
      <section
        className="flex-none flex flex-col items-center justify-end"
        style={{ minHeight: "46%" }}
      >
        <header className={`text-center mb-6 px-4 ${heroShown ? "lm-fade-up" : "opacity-0"}`} style={{ animationDelay: "80ms", ...leaveStyle }}>
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

        {/* 704px = max-w-2xl del contenido del input (672) + su propio
            padding lateral (32). Así la pastilla centrada mide EXACTAMENTE
            lo mismo que la del dock inferior en cualquier viewport y la
            animación de despegue es un deslizamiento puro, sin saltos
            de ancho. */}
        <div className="w-full max-w-[704px]">
          <ChatInput
            {...chatInputProps}
            autoFocus
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
            convId={null}
            isStreaming={false}
          />
        </div>
      </section>

      {/* Microcopy / bloqueo — fijos con el hero, entre el input y el feed */}
      <div className="flex-none flex flex-col items-center px-4" style={leaveStyle}>
        {!isLoggedIn && (
          <p className={`text-[12px] mt-3.5 ${heroShown ? "lm-fade-up" : "opacity-0"}`} style={{ color: "var(--text-tertiary)" }}>
            Gratis para empezar — crea tu cuenta en 10 segundos con Google
          </p>
        )}
        {isLoggedIn && !block.canWrite && (
          <div className={`text-center mt-4 ${heroShown ? "lm-fade-up" : "opacity-0"}`}>
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
      </div>

      {/* Feed de tendencias — asoma justo debajo del input y scrollea en su
          propia zona (el hero no se entera). El desvanecido superior hace
          que las tarjetas entren/salgan suave por el borde, sin rayas ni
          superposiciones. */}
      <section
        ref={feedScrollRef}
        className={`flex-1 min-h-0 overflow-y-auto ${feedShown ? "gentle-fade" : "opacity-0"}`}
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0, black 28px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0, black 28px)",
          touchAction: "pan-y",
          ...leaveStyle,
        }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-7 pb-20">
          <TrendingFeed
            feed={feed}
            onAsk={(prompt) => submitSuggestion(prompt, { source: "discover" })}
          />
        </div>
      </section>
    </div>
  );
}
