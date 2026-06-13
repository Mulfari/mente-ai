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
  sparkles: "M12 3l1.8 4.6L18 9.4l-4.2 1.8L12 16l-1.8-4.8L6 9.4l4.2-1.8L12 3zM19 14l.9 2.3L22 17l-2.1.8L19 20l-.9-2.2L16 17l2.1-.7L19 14zM5 14l.9 2.3L8 17l-2.1.8L5 20l-.9-2.2L2 17l2.1-.7L5 14z",
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
          // Pista de "desliza" — solo en móvil (en escritorio es grilla, no
          // hay scroll horizontal que sugerir).
          <svg
            className="ml-auto w-3.5 h-3.5 md:hidden"
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

// Indicador de señal (reemplaza el conteo crudo): 3 barras ascendentes tipo
// señal de celular. `level` 1/2/3 = intensidad relativa del tema en el feed;
// 0 = sin datos reales (semilla) → no se renderiza nada. NUNCA un número.
function SignalBars({ level, on = "var(--primary)" }: { level: 0 | 1 | 2 | 3; on?: string }) {
  if (level <= 0) return null;
  const heights = [5, 8, 11];
  return (
    <span
      className="inline-flex items-end gap-[2px]"
      role="img"
      aria-label={`Intensidad ${level} de 3`}
      title={level === 3 ? "Muy buscado" : level === 2 ? "En alza" : "Activo"}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          style={{
            width: 3,
            height: h,
            borderRadius: 1,
            backgroundColor: i < level ? on : "color-mix(in srgb, currentColor 22%, transparent)",
          }}
        />
      ))}
    </span>
  );
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduce;
}

// Barras de ecualizador animadas — el toque "vivo" del spotlight. Suben y
// bajan en loop (CSS), escalonadas. En reposo (reduced-motion) quedan fijas.
function EqualizerBars({ on = "#C7F3E6", animate = true }: { on?: string; animate?: boolean }) {
  return (
    <span className="inline-flex items-end gap-[3px]" aria-hidden="true" style={{ height: 14 }}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={animate ? "eq-bar" : ""}
          style={{
            width: 3,
            height: animate ? 6 : [6, 11, 8, 13][i],
            borderRadius: 1.5,
            backgroundColor: on,
            animationDelay: `${i * 140}ms`,
          }}
        />
      ))}
    </span>
  );
}

// Spotlight: una sola tarjeta grande que ROTA entre las top tendencias con
// crossfade cada 5s (pausa al hover/focus). Es la "B" pero viva.
function SpotlightHero({ items, onAsk }: { items: FeedCard[]; onAsk: (p: string) => void }) {
  const [idx, setIdx] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const reduce = usePrefersReducedMotion();
  const n = items.length;

  React.useEffect(() => {
    if (reduce || paused || n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 5000);
    return () => clearInterval(t);
  }, [reduce, paused, n]);

  const card = items[Math.min(idx, n - 1)] ?? items[0];

  return (
    <button
      onClick={() => onAsk(card.prompt)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label={`Tendencia: ${card.prompt}`}
      className="w-full text-left rounded-2xl p-4 sm:p-5 flex flex-col justify-between min-h-[150px] sm:min-h-[160px] cursor-pointer feed-featured gentle-fade-up-soft"
      style={{
        background:
          "radial-gradient(120% 90% at 85% -10%, rgba(255,255,255,0.18), transparent 50%), linear-gradient(160deg, var(--primary), #0A6B54)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10.5px] font-medium px-2.5 py-1 rounded-full"
          style={{ color: "#C7F3E6", backgroundColor: "rgba(255,255,255,0.16)" }}
        >
          {idx === 0 ? "#1 en Venezuela" : card.categoryLabel}
        </span>
        {n > 1 && (
          <span className="flex items-center gap-1.5" aria-hidden="true">
            {items.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === idx ? 16 : 6,
                  height: 6,
                  backgroundColor: i === idx ? "#fff" : "rgba(255,255,255,0.42)",
                }}
              />
            ))}
          </span>
        )}
      </div>

      <p key={idx} className="hero-swap text-[16px] sm:text-[19px] font-semibold text-white leading-snug my-3">
        “{card.prompt}”
      </p>

      <div className="flex items-center justify-between">
        <EqualizerBars animate={!reduce} />
        <span className="text-[11.5px]" style={{ color: "#C7F3E6" }}>
          {idx === 0 ? "Lo más buscado" : "En tendencia"}
        </span>
      </div>
    </button>
  );
}

// Fila compacta del ranking debajo del spotlight: posición + pregunta +
// categoría + señal. Reemplaza la cuadrícula de cajas (más liviano).
function TrendRow({ card, rank, onAsk, delay = 0 }: { card: FeedCard; rank: number; onAsk: (p: string) => void; delay?: number }) {
  const cat = categoryStyle(card.categoryId);
  return (
    <button
      onClick={() => onAsk(card.prompt)}
      className="w-full flex items-center gap-3 py-2.5 px-2 my-0.5 rounded-xl text-left cursor-pointer transition-colors hover:bg-[var(--surface-hover)] gentle-fade-up-soft"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[14px] font-semibold w-5 text-center shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {rank}
      </span>
      <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
        {card.prompt}
      </span>
      <span
        className="hidden sm:inline-block text-[9.5px] font-medium px-2 py-0.5 rounded-full shrink-0"
        style={{ color: cat.color, backgroundColor: cat.bg }}
      >
        {card.categoryLabel}
      </span>
      {card.signal > 0 && (
        <span className="shrink-0" style={{ color: "var(--text-tertiary)" }}>
          <SignalBars level={card.signal} />
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
      <div className="feed-row-trending" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl h-[140px] feed-skel"
            style={{ animation: `pulse 1.5s ease-in-out infinite ${i * 0.15}s` }}
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
      {(() => {
        // Pool = destacado + tendencias (sin duplicados, feed.ts ya lo
        // garantiza). El spotlight rota las primeras; el resto va en lista.
        const pool = [feed.featured, ...feed.trending];
        const heroItems = pool.slice(0, 4);
        const listItems = pool.slice(4, 9);
        return (
          <section className="relative pb-8">
          <SectionHeader>
            <Icon d={ICONS.flame} size={17} color="#D85A30" />
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              Tendencias ahora
            </h2>
          </SectionHeader>

          <SpotlightHero items={heroItems} onAsk={onAsk} />

          {listItems.length > 0 && (
            <div className="mt-3">
              {listItems.map((card, i) => (
                <TrendRow
                  key={card.prompt}
                  card={card}
                  rank={i + heroItems.length + 1}
                  onAsk={onAsk}
                  delay={80 + i * 55}
                />
              ))}
            </div>
          )}
          </section>
        );
      })()}

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
      {/* Móvil: chips en fila deslizable; escritorio: con wrap clásico. */}
      <div className="feed-row-chips">
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

      {/* Tercera sección: "Para ti" (personalizada por el historial) cuando
          el algoritmo tiene material; si no, "Preguntando ahora" (visitantes
          y usuarios nuevos). */}
      {feed.forYou && feed.forYou.items.length >= 2 ? (
        <section className="relative">
        <SectionHeader>
          <Icon d={ICONS.sparkles} size={16} color="var(--primary)" />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Para ti
          </h2>
        </SectionHeader>
        <div
          className="rounded-2xl px-2 gentle-fade-up-soft"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {feed.forYou.items.map((item, i) => (
            <button
              key={item.prompt}
              onClick={() => onAsk(item.prompt)}
              className="w-full flex items-center gap-3 py-3 px-2 my-0.5 rounded-xl text-left cursor-pointer group transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
                “{item.prompt}”
              </span>
            </button>
          ))}
        </div>
        </section>
      ) : (
        <section className="relative">
        <SectionHeader>
          <Icon d={ICONS.clock} size={16} color="var(--text-secondary)" />
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
            Preguntando ahora
          </h2>
        </SectionHeader>
        {/* Limpio: solo la pregunta (sin punto parpadeante, sin "hace X min"
            ni ciudad — esos no aportan y ensuciaban la lista). */}
        <div
          className="rounded-2xl px-2 gentle-fade-up-soft"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {feed.recent.map((item, i) => (
            <button
              key={item.prompt}
              onClick={() => onAsk(item.prompt)}
              className="w-full flex items-center gap-3 py-3 px-2 my-0.5 rounded-xl text-left cursor-pointer group transition-colors hover:bg-[var(--surface-hover)]"
              style={{ borderTop: i === 0 ? "none" : "1px solid var(--border)" }}
            >
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true" style={{ color: "var(--text-tertiary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="text-[13px] truncate" style={{ color: "var(--text-primary)" }}>
                “{item.prompt}”
              </span>
            </button>
          ))}
        </div>
        </section>
      )}
    </div>
  );
}
