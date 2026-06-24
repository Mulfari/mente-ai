"use client";

import React from "react";
import ChatInput from "./ChatInput";
import LimitReachedCard from "./LimitReachedCard";
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
  /** True mientras la primera pregunta está creando la conversación:
      hero, microcopy y feed se desvanecen; el input queda visible y
      luego el padre lo anima deslizándose hasta el dock inferior. */
  leaving?: boolean;
  limitReached?: boolean;
  resetAt?: string | null;
  onSeePlans?: () => void;
  quotaLeft?: number;
  showQuota?: boolean;
};

// Saludos genéricos (sin nombre): visitante deslogueado + logueado sin nombre.
const OPENERS_NO_NAME = [
  "Hola, ¿en qué te ayudo?",
  "¿En qué te ayudo hoy?",
  "Hola, ¿qué necesitas?",
  "Hola, ¿qué resolvemos hoy?",
  "Buenas, ¿en qué te ayudo?",
  "Hola, ¿en qué te ayudo? — yo sé lo de aquí",
];

// Saludos con nombre (logueado).
const OPENERS_WITH_NAME = [
  "Hola, {name}. ¿En qué te ayudo?",
  "¿En qué te ayudo, {name}?",
  "¿Qué resolvemos hoy, {name}?",
  "Buenas, {name}. ¿Qué necesitas?",
  "Hola, {name} 👋 ¿En qué te ayudo?",
];

// Saludos según la franja horaria (hora del dispositivo = hora de Venezuela).
// Se MEZCLAN con los genéricos en el pool del que se elige al azar.
const TIME_NO_NAME: Record<"morning" | "afternoon" | "night", string[]> = {
  morning: ["Buenos días, ¿en qué te ayudo?", "Buenos días, ¿qué necesitas?", "Buenos días, ¿arrancamos?"],
  afternoon: ["Buenas tardes, ¿en qué te ayudo?", "Buenas tardes, ¿qué resolvemos?"],
  night: ["Buenas noches, ¿en qué te ayudo?", "Buenas noches, ¿qué necesitas?"],
};
const TIME_WITH_NAME: Record<"morning" | "afternoon" | "night", string[]> = {
  morning: ["Buenos días, {name}. ¿En qué te ayudo?"],
  afternoon: ["Buenas tardes, {name}. ¿En qué te ayudo?"],
  night: ["Buenas noches, {name}. ¿En qué te ayudo?"],
};

function getFirstName(fullName?: string): string | null {
  const trimmed = fullName?.trim();
  if (!trimmed) return null;
  return trimmed.split(/\s+/)[0];
}

function timeBucket(hour: number): "morning" | "afternoon" | "night" {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 19) return "afternoon";
  return "night";
}

// Saludo inicial DETERMINISTA (SSR + primer render del cliente) — evita el
// mismatch de hidratación. El saludo real (azar + hora) se elige en el cliente
// tras montar; como el hero está oculto (opacity-0) hasta el fade-in, este
// placeholder nunca se ve.
function initialOpener(firstName: string | null, isLoggedIn: boolean): string {
  if (isLoggedIn && firstName) return OPENERS_WITH_NAME[0].replace("{name}", firstName);
  return OPENERS_NO_NAME[0];
}

// Saludo final: al AZAR de un pool que combina los genéricos + los de la franja
// horaria actual. Solo en el cliente (usa Math.random y la hora local).
function pickRandomOpener(firstName: string | null, isLoggedIn: boolean): string {
  const b = timeBucket(new Date().getHours());
  if (isLoggedIn && firstName) {
    const pool = [...OPENERS_WITH_NAME, ...TIME_WITH_NAME[b]];
    return pool[Math.floor(Math.random() * pool.length)].replace("{name}", firstName);
  }
  const pool = [...OPENERS_NO_NAME, ...TIME_NO_NAME[b]];
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function EmptyState(props: Props) {
  const {
    userName,
    isLoggedIn,
    feed,
    getBlockReason,
    submitSuggestion,
    leaving = false,
    limitReached,
    resetAt,
    onSeePlans,
    quotaLeft,
    showQuota,
    ...chatInputProps
  } = props;

  // Todo lo que NO es el input se desvanece al despegar la conversación.
  const leaveStyle: React.CSSProperties = leaving
    ? { opacity: 0, transition: "opacity 0.25s ease", pointerEvents: "none" }
    : {};

  const firstName = getFirstName(userName);
  // SSR-safe: arranca con un saludo determinista; tras montar, el cliente elige
  // uno al azar según la hora (el hero está oculto hasta el fade-in, sin salto).
  const [opener, setOpener] = React.useState(() => initialOpener(firstName, isLoggedIn));
  React.useEffect(() => {
    setOpener(pickRandomOpener(firstName, isLoggedIn));
  }, [firstName, isLoggedIn]);

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
      {/* Hero + input: FIJOS — el bloque se ancla a su fondo (justify-end) y
          la sección mide ~59% del alto, así el INPUT cae centrado vertical en
          la pantalla, con espacio libre arriba y el feed asomando debajo.
          Nada los tapa ni los mueve. */}
      <section
        className="flex-none flex flex-col items-center justify-end"
        style={{ minHeight: "59%" }}
      >
        <header className={`text-center mb-6 px-4 ${heroShown ? "lm-fade-up" : "opacity-0"}`} style={{ animationDelay: "80ms", ...leaveStyle }}>
          <h1
            className="text-2xl sm:text-3xl font-semibold tracking-tighter"
            style={{ color: "var(--text-primary)" }}
          >
            {opener}
          </h1>
        </header>

        {/* 704px = max-w-2xl del contenido del input (672) + su propio
            padding lateral (32). Así la pastilla centrada mide EXACTAMENTE
            lo mismo que la del dock inferior en cualquier viewport y la
            animación de despegue es un deslizamiento puro, sin saltos
            de ancho. */}
        <div className="w-full max-w-[704px]">
          {limitReached ? (
            <LimitReachedCard resetAt={resetAt ?? null} onSeePlans={onSeePlans!} onRedeem={onSeePlans!} />
          ) : (
            <ChatInput
              {...chatInputProps}
              autoFocus
              getBlockReason={getBlockReason}
              isLoggedIn={isLoggedIn}
              convId={null}
              isStreaming={false}
              quotaLeft={quotaLeft}
              showQuota={showQuota}
            />
          )}
        </div>
      </section>

      {/* Microcopy — fijo con el hero, entre el input y el feed. La cuenta
          bloqueada ya NO muestra panel aquí: el placeholder del input lo
          dice y cualquier intento de enviar abre el menú de cuenta. */}
      <div className="flex-none flex flex-col items-center px-4" style={leaveStyle}>
      </div>

      {/* Feed de tendencias — asoma justo debajo del input y scrollea en su
          propia zona (el hero no se entera). El borde superior suave lo
          ponen los títulos de sección fijados (SectionHeader en
          TrendingFeed): fondo sólido + tira degradada bajo el título. */}
      <section
        ref={feedScrollRef}
        className={`flex-1 min-h-0 overflow-y-auto ${feedShown ? "gentle-fade" : "opacity-0"}`}
        style={{
          touchAction: "pan-y",
          ...leaveStyle,
        }}
      >
        {/* En escritorio el feed gana ancho (3xl = 768px) para aprovechar
            mejor el espacio; en móvil se queda en 2xl. */}
        <div className="max-w-2xl md:max-w-3xl mx-auto px-4 pt-7 pb-20">
          <TrendingFeed
            feed={feed}
            onAsk={(prompt) => submitSuggestion(prompt, { source: "discover" })}
          />
        </div>
      </section>
    </div>
  );
}
