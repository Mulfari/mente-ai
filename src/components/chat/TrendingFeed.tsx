"use client";

import React from "react";
import type { PublicFeed, FeedCard } from "@/lib/feed";

// Feed de tendencias compartido — el MISMO componente para el visitante
// deslogueado y para el usuario en el empty state del chat. La única
// diferencia es qué hace onAsk (registrarse vs. enviar directo).

// Pills de categoría: el fondo se deriva del color con transparencia
// (color-mix) para que funcione igual en tema claro y oscuro.
const CATEGORY_COLORS: Record<string, string> = {
  comida: "#D97706",
  servicios: "#0E8F6F",
  ofertas: "#DB2777",
  tramites: "#2563EB",
  negocios: "#7C3AED",
  salud: "#DC2626",
  general: "#0E8F6F",
};

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = Object.fromEntries(
  Object.entries(CATEGORY_COLORS).map(([id, color]) => [
    id,
    { color, bg: `color-mix(in srgb, ${color} 14%, transparent)` },
  ])
);

function categoryStyle(id: string) {
  return CATEGORY_STYLES[id] ?? CATEGORY_STYLES.general;
}

function Icon({ d, size = 16, color = "currentColor", strokeWidth = 1.75 }: { d: string; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke={color} strokeWidth={strokeWidth} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  flame: "M12 3c1.5 3-1 4.5-1 7a3 3 0 006 .5C18.5 13 20 15 20 17a8 8 0 11-16 0c0-3 2-5.5 3.5-7C8 8.5 9.5 6 12 3z",
  mapPin: "M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11zm0-8.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  clock: "M12 8v4l2.5 2.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  trendingUp: "M3 17l6-6 4 4 8-8m0 0v5m0-5h-5",
};

// Título de sección fijado (patrón lista de iOS): se queda pegado arriba
// del área de scroll mientras su sección está a la vista; cuando llega la
// siguiente sección, su título lo empuja hacia afuera y se fija él (el
// empuje lo hace el navegador — sticky acotado al <section> padre).
// Fondo SÓLIDO + tira degradada: las tarjetas se disuelven al pasar por
// debajo, sin transparencias legibles.
function SectionHeader({ children, swipeHint = false }: { children: React.ReactNode; swipeHint?: boolean }) {
  return (
    <div className="sticky top-0 z-10">
      <div
        className="flex items-center gap-2 pt-1 pb-2"
        style={{ backgroundColor: "var(--background)" }}
      >
        {children}
        {swipeHint && (
          <svg
            className="ml-auto w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
            style={{ color: "var(--text-tertiary)" }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>
      {/* Tira degradada EN FLUJO (sin margen negativo): en reposo es
          invisible (fondo sobre fondo) y solo actúa cuando las tarjetas
          scrollean por debajo del título fijado — antes pisaba los
          primeros 16px del contenido todo el tiempo. */}
      <div
        aria-hidden
        className="h-4"
        style={{ background: "linear-gradient(to bottom, var(--background), transparent)" }}
      />
    </div>
  );
}

function TrendCard({ card, onAsk, delay = 0 }: { card: FeedCard; onAsk: (p: string) => void; delay?: number }) {
  const style = categoryStyle(card.categoryId);
  return (
    <button
      onClick={() => onAsk(card.prompt)}
      className="text-left rounded-2xl p-3.5 cursor-pointer feed-card gentle-fade-up-soft w-[168px] flex flex-col items-start"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        className="inline-block text-[10px] font-medium px-2.5 py-0.5 rounded-full"
        style={{ color: style.color, backgroundColor: style.bg }}
      >
        {card.categoryLabel}
      </span>
      <p className="text-[13px] font-medium mt-2 mb-1 leading-snug flex-1" style={{ color: "var(--text-primary)" }}>
        {card.prompt}
      </p>
      {card.count !== null && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-tertiary)" }}>
          <Icon d={ICONS.trendingUp} size={12} color="var(--primary)" /> {card.count} hoy
        </span>
      )}
    </button>
  );
}

export default function TrendingFeed({
  feed,
  onAsk,
}: {
  feed: PublicFeed | null;
  onAsk: (prompt: string) => void;
}) {
  if (!feed) {
    // Skeleton ligero mientras carga /api/feed — con la forma de las filas
    // deslizables reales.
    return (
      <div className="feed-hrow" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-[140px] w-[168px]"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              animation: `pulse 1.5s ease-in-out infinite ${i * 0.15}s`,
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Cada sección es el límite del sticky de su título: al terminar la
          sección, el título saliente es empujado por el entrante. El
          espaciado entre secciones vive DENTRO (pb-8) para que el título
          siga fijado durante el hueco, hasta que llegue el siguiente. */}
      <section className="relative pb-8">
      <SectionHeader swipeHint>
        <Icon d={ICONS.flame} size={17} color="#D85A30" />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Tendencias ahora
        </h2>
      </SectionHeader>

      {/* Fila deslizable: destacado + tendencias, con snap por tarjeta. */}
      <div className="feed-hrow">
        <button
          onClick={() => onAsk(feed.featured.prompt)}
          className="text-left rounded-2xl p-4 flex flex-col justify-between w-[230px] min-h-[150px] cursor-pointer feed-featured gentle-fade-up-soft"
          style={{
            background:
              "radial-gradient(120% 90% at 85% -10%, rgba(255,255,255,0.18), transparent 50%), linear-gradient(160deg, var(--primary), #0A6B54)",
          }}
        >
          <span
            className="self-start text-[10.5px] font-medium px-2.5 py-1 rounded-full"
            style={{ color: "#C7F3E6", backgroundColor: "rgba(255,255,255,0.16)" }}
          >
            #1 en Venezuela
          </span>
          <div>
            <p className="text-[15px] sm:text-[17px] font-semibold text-white leading-snug mb-1.5">
              “{feed.featured.prompt}”
            </p>
            {feed.featured.count !== null && (
              <span className="text-[11.5px] flex items-center gap-1.5" style={{ color: "#C7F3E6" }}>
                <Icon d={ICONS.trendingUp} size={13} color="#C7F3E6" />
                {feed.featured.count} personas hoy
              </span>
            )}
          </div>
        </button>
        {feed.trending.slice(0, 8).map((card, i) => (
          <TrendCard key={card.prompt} card={card} onAsk={onAsk} delay={60 + i * 55} />
        ))}
      </div>
      </section>

      <section className="relative pb-8">
      <SectionHeader swipeHint>
        <Icon d={ICONS.mapPin} size={16} color="var(--primary)" />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Cerca de ti
        </h2>
        {feed.nearYou.city && (
          <span
            className="text-[10.5px] font-medium px-2.5 py-0.5 rounded-full"
            style={{ color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)" }}
          >
            {feed.nearYou.city}
          </span>
        )}
      </SectionHeader>
      {/* Chips en fila deslizable (sin wrap, sin snap — scroll libre). */}
      <div className="feed-hrow feed-hrow-free">
        {feed.nearYou.prompts.map((p, i) => (
          <button
            key={p}
            onClick={() => onAsk(p)}
            className="text-[12.5px] px-4 py-2 rounded-full cursor-pointer feed-chip gentle-fade-up-soft whitespace-nowrap"
            style={{ color: "var(--text-primary)", animationDelay: `${i * 45}ms` }}
          >
            {p}
          </button>
        ))}
      </div>
      </section>

      <section className="relative">
      <SectionHeader>
        <Icon d={ICONS.clock} size={16} color="var(--text-secondary)" />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Preguntando ahora
        </h2>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--primary)" }} />
      </SectionHeader>
      <div
        className="rounded-2xl px-2 gentle-fade-up-soft"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {feed.recent.map((item, i) => (
          <button
            key={item.prompt}
            onClick={() => onAsk(item.prompt)}
            className="w-full flex items-center justify-between gap-4 py-3 px-2 my-0.5 rounded-xl text-left cursor-pointer group transition-colors hover:bg-[var(--surface-hover)]"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
          >
            <span
              className="text-[13px] truncate"
              style={{ color: "var(--text-primary)" }}
            >
              “{item.prompt}”
            </span>
            <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>
              {item.minutesAgo !== null
                ? item.minutesAgo < 60
                  ? `hace ${item.minutesAgo} min`
                  : `hace ${Math.round(item.minutesAgo / 60)} h`
                : "popular"}
              {item.city ? ` · ${item.city}` : ""}
            </span>
          </button>
        ))}
      </div>
      </section>
    </div>
  );
}
