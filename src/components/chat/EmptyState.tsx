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

  // El bloque hero+input es sticky: arranca centrado (el espaciador de
  // arriba lo empuja) y al scrollear sube hasta pegarse al tope, donde se
  // queda mientras el feed sigue scrolleando por debajo. Para que el input
  // quede centrado igual que siempre (borde inferior al 46% del alto), el
  // espaciador mide 46% MENOS la altura real del bloque — medida en vivo
  // (cambia entre visitante/logueado y cuando el textarea crece).
  const heroRef = React.useRef<HTMLElement>(null);
  const [heroH, setHeroH] = React.useState<number | null>(null);
  React.useLayoutEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const update = () => setHeroH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const spacerHeight =
    heroH === null
      ? "max(0px, calc(46% - 190px))" // estimación pre-medida (un frame)
      : `max(0px, calc(46% - ${Math.round(heroH)}px))`;

  return (
    <div className="h-full overflow-y-auto">
      {/* Espaciador scrolleable: empuja el hero+input al centro vertical al
          cargar; al scrollear hacia el feed se consume y el bloque sticky
          de abajo se pega al tope. */}
      <div aria-hidden style={{ height: spacerHeight }} />

      {/* Hero + input: sticky — sube con el scroll hasta el tope y se queda
          ahí (vidrio esmerilado); el feed sigue scrolleando por debajo. */}
      <section
        ref={heroRef}
        className="sticky top-0 z-10 flex flex-col items-center pt-3 pb-1"
        style={{
          // 95% y no menos: con más transparencia el feed que pasa por
          // debajo se leía a través del vidrio (sobre todo en tema oscuro).
          backgroundColor: "color-mix(in srgb, var(--background) 95%, transparent)",
          backdropFilter: "blur(16px) saturate(1.1)",
          WebkitBackdropFilter: "blur(16px) saturate(1.1)",
        }}
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

      {/* Microcopy / bloqueo — entre el input y el feed */}
      <div className="flex flex-col items-center px-4" style={leaveStyle}>
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

      {/* Feed de tendencias — asomando justo debajo del input */}
      <section className={`max-w-2xl mx-auto px-4 pt-10 pb-20 ${feedShown ? "gentle-fade" : "opacity-0"}`} style={leaveStyle}>
        <TrendingFeed
          feed={feed}
          onAsk={(prompt) => submitSuggestion(prompt, { source: "discover" })}
        />
      </section>
    </div>
  );
}
