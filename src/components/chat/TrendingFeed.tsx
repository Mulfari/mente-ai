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

function TrendCard({ card, onAsk }: { card: FeedCard; onAsk: (p: string) => void }) {
  const style = categoryStyle(card.categoryId);
  return (
    <button
      onClick={() => onAsk(card.prompt)}
      className="text-left rounded-2xl p-3.5 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <span
        className="inline-block text-[10px] font-medium px-2.5 py-0.5 rounded-full"
        style={{ color: style.color, backgroundColor: style.bg }}
      >
        {card.categoryLabel}
      </span>
      <p className="text-[13px] font-medium mt-2 mb-1 leading-snug" style={{ color: "var(--text-primary)" }}>
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
    // Skeleton ligero mientras carga /api/feed
    return (
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-[88px]"
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
      <div className="flex items-center gap-2 mb-3">
        <Icon d={ICONS.flame} size={17} color="#D85A30" />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Tendencias ahora
        </h2>
      </div>

      <div className="grid gap-2.5 mb-8" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
        <button
          onClick={() => onAsk(feed.featured.prompt)}
          className="text-left rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[150px] transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
          style={{
            gridRow: "span 2",
            background: "linear-gradient(160deg, var(--primary), #0A6B54)",
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
        {feed.trending.slice(0, 4).map((card) => (
          <TrendCard key={card.prompt} card={card} onAsk={onAsk} />
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2.5">
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
      </div>
      <div className="flex flex-wrap gap-2 mb-8">
        {feed.nearYou.prompts.map((p) => (
          <button
            key={p}
            onClick={() => onAsk(p)}
            className="text-[12.5px] px-4 py-2 rounded-full transition-colors cursor-pointer hover:bg-[var(--surface-hover)]"
            style={{
              color: "var(--text-primary)",
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-2.5">
        <Icon d={ICONS.clock} size={16} color="var(--text-secondary)" />
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
          Preguntando ahora
        </h2>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--primary)" }} />
      </div>
      <div
        className="rounded-2xl px-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {feed.recent.map((item, i) => (
          <button
            key={item.prompt}
            onClick={() => onAsk(item.prompt)}
            className="w-full flex items-center justify-between gap-4 py-3 text-left cursor-pointer group"
            style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
          >
            <span
              className="text-[13px] truncate group-hover:underline"
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
    </div>
  );
}
