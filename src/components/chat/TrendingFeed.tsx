"use client";

import React from "react";
import type { PublicFeed, FeedCard } from "@/lib/feed";

// "El Lente" (propuesta creativa de Claude Design): UNA sola superficie con un
// control segmentado (Tendencias / Cerca / Para ti) que transforma la lista.
// Resuelve el huérfano (siempre lista limpia de N filas) y la cohesión (un
// sistema, no 3 bloques pegados). El input del chat queda aparte, sin cambios.

type Lens = "trend" | "cerca" | "parati";
type IconKey = "trend" | "pin" | "sparkle" | "arrow";

const ICONS: Record<IconKey, string> = {
  trend: "M3 17l6-6 4 4 8-8m0 0v5m0-5h-5",
  pin: "M12 21s-7-5.5-7-11a7 7 0 1 1 14 0c0 5.5-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  sparkle: "M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3z",
  arrow: "M7 17L17 7M7 7h10v10",
};

function Icon({ k, size = 14, fill = false }: { k: IconKey; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke={fill ? "none" : "currentColor"} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[k]} />
    </svg>
  );
}

// Señal (3 barras ascendentes); nivel 0 = nada (semilla). NUNCA un número.
function SignalBars({ level }: { level: 0 | 1 | 2 | 3 }) {
  if (level <= 0) return null;
  return (
    <span className="lens-sig" aria-label={`Intensidad ${level} de 3`}>
      {[5, 9, 13].map((h, i) => (
        <span key={i} style={{ height: h, background: i < level ? "var(--primary)" : "var(--border)" }} />
      ))}
    </span>
  );
}

export default function TrendingFeed({
  feed,
  onAsk,
}: {
  feed: PublicFeed | null;
  onAsk: (prompt: string) => void;
}) {
  const [lens, setLens] = React.useState<Lens>("trend");

  if (!feed) {
    return (
      <div className="lens-card" aria-hidden="true">
        <div className="lens-seg lens-seg--skel" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lens-skel-row" style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
      </div>
    );
  }

  const LENSES: { id: Lens; label: string; icon: IconKey }[] = [
    { id: "trend", label: "Tendencias", icon: "trend" },
    { id: "cerca", label: "Cerca", icon: "pin" },
    { id: "parati", label: "Para ti", icon: "sparkle" },
  ];

  const paratiEmpty = !(feed.forYou && feed.forYou.items.length >= 2);

  let featured: FeedCard | null = null;
  let rows: { q: string; level?: 0 | 1 | 2 | 3; lead?: IconKey }[] = [];
  if (lens === "trend") {
    featured = feed.featured ?? null;
    rows = feed.trending.map((c) => ({ q: c.prompt, level: c.signal as 0 | 1 | 2 | 3 }));
  } else if (lens === "cerca") {
    rows = feed.nearYou.prompts.map((p) => ({ q: p, lead: "pin" as const }));
  } else {
    const items = paratiEmpty ? feed.recent.map((r) => r.prompt) : feed.forYou!.items.map((i) => i.prompt);
    rows = items.map((q) => ({ q, lead: "sparkle" as const }));
  }

  const lensSub =
    lens === "trend"
      ? "Lo que pregunta el país ahora"
      : lens === "cerca"
      ? feed.nearYou.city
        ? `Preguntas locales de ${feed.nearYou.city}`
        : "Preguntas locales cerca de ti"
      : paratiEmpty
      ? "Preguntando ahora · en vivo"
      : "Elegidas por tu historial";

  return (
    <div className="lens-card">
      <div className="lens-sticky">
      <div className="lens-head">
        <span className="lens-dot">
          <span className="lens-dot-ping" />
          <span className="lens-dot-core" />
        </span>
        <span className="lens-sub">{lensSub}</span>
      </div>

      <div className="lens-seg" role="tablist">
        {LENSES.map((l) => (
          <button key={l.id} type="button" role="tab" aria-selected={lens === l.id}
            onClick={() => setLens(l.id)} className={`lens-tab${lens === l.id ? " is-on" : ""}`}>
            <Icon k={l.icon} size={16} />
            <span>{l.label}</span>
          </button>
        ))}
      </div>
      </div>

      {featured && (
        <button type="button" onClick={() => onAsk(featured!.prompt)} className="lens-featured">
          <span className="lens-featured-label"><span className="lens-beat" />Lo más buscado</span>
          <span className="lens-featured-row">
            <span className="lens-featured-q">{featured.prompt}</span>
            <SignalBars level={(featured.signal || 3) as 0 | 1 | 2 | 3} />
          </span>
        </button>
      )}

      <div className="lens-rows">
        {rows.map((r, i) => (
          <button key={`${lens}-${i}`} type="button" onClick={() => onAsk(r.q)} className="lens-row gentle-fade-up-soft"
            style={{ animationDelay: `${i * 35}ms` }}>
            {r.lead && <span className="lens-row-tile"><Icon k={r.lead} size={15} fill /></span>}
            <span className="lens-row-q">{r.q}</span>
            {r.level ? <SignalBars level={r.level} /> : null}
            <span className="lens-row-arrow"><Icon k="arrow" size={13} /></span>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="lens-empty">Pronto verás preguntas aquí.</div>
        )}
      </div>
    </div>
  );
}
