"use client";

import React, { useState, useEffect } from "react";

type TrendingSubOption = {
  id: string;
  title: string;
  subtitle: string;
  iconKey: string;
  eventCount: number;
  prompts: string[];
  categoryId: string;
};

export type TrendingSections = {
  trending: TrendingSubOption[];
  nearYou: TrendingSubOption[];
  forYou: TrendingSubOption[];
  recent: TrendingSubOption[];
};

type StaticSubOption = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
};

type StaticCategory = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  subOptions: StaticSubOption[];
};

type Props = {
  onSelect: (
    s: string,
    meta: { categoryId: string; subOptionId?: string; source?: "discover" | "typed" }
  ) => void;
  sections: TrendingSections;
  loading?: boolean;
};

// Cold-start fallback: three fixed categories with curated sub-options. Used
// when ALL sections are empty (zero events, or down). Kept permanently —
// the static list is the floor, the trending sections are the ceiling.
const SUBOPTION_ICONS: Record<string, React.ReactNode> = {
  pizza: <PizzaIcon />,
  sushi: <SushiIcon />,
  veggie: <LeafIcon />,
  desayuno: <CoffeeIcon />,
  postres: <CakeIcon />,
  cafes: <CoffeeIcon />,
  plomero: <WrenchIcon />,
  electricista: <BoltIcon />,
  limpieza: <BroomIcon />,
  mudanza: <BoxIcon />,
  tecnico: <MonitorIcon />,
  clases: <BookIcon />,
  hoy: <FireIcon />,
  "2x1": <TagIcon />,
  ropa: <ShirtIcon />,
  super: <BasketIcon />,
  electronica: <DeviceIcon />,
  cupones: <TicketIcon />,
};

function subOptionIcon(id: string): React.ReactNode {
  return SUBOPTION_ICONS[id] ?? <ChatBubbleIcon />;
}

const STATIC_CATEGORIES: StaticCategory[] = [
  {
    id: "comida",
    title: "Comida",
    subtitle: "Restaurantes y delivery",
    icon: <UtensilsIcon />,
    subOptions: [
      { id: "pizza", title: "Pizza", subtitle: "Cerca de mí, hoy", prompt: "¿Qué pizzerías hay cerca de mí abiertas ahora?", icon: subOptionIcon("pizza") },
      { id: "sushi", title: "Sushi", subtitle: "Delivery y para llevar", prompt: "¿Dónde pedir sushi con delivery?", icon: subOptionIcon("sushi") },
      { id: "veggie", title: "Vegetariana", subtitle: "Opciones saludables", prompt: "¿Qué restaurantes vegetarianos hay cerca de mí?", icon: subOptionIcon("veggie") },
      { id: "desayuno", title: "Desayunos", subtitle: "Brunch y cafeterías", prompt: "¿Dónde puedo desayunar o brunchear cerca de mí?", icon: subOptionIcon("desayuno") },
      { id: "postres", title: "Postres", subtitle: "Pastelerías y heladerías", prompt: "¿Dónde conseguir buenos postres cerca de mí?", icon: subOptionIcon("postres") },
      { id: "cafes", title: "Cafés", subtitle: "Para trabajar o estudiar", prompt: "¿Qué cafés tranquilos hay cerca de mí para trabajar?", icon: subOptionIcon("cafes") },
    ],
  },
  {
    id: "servicios",
    title: "Servicios",
    subtitle: "Profesionales y técnicos",
    icon: <HomeIcon />,
    subOptions: [
      { id: "plomero", title: "Plomero", subtitle: "Urgencias 24h", prompt: "Necesito un plomero urgente, ¿a quién puedo llamar?", icon: subOptionIcon("plomero") },
      { id: "electricista", title: "Electricista", subtitle: "Reparaciones rápidas", prompt: "¿Hay electricistas disponibles ahora en mi zona?", icon: subOptionIcon("electricista") },
      { id: "limpieza", title: "Limpieza", subtitle: "Servicio a domicilio", prompt: "¿Cuánto cuesta un servicio de limpieza de hogar?", icon: subOptionIcon("limpieza") },
      { id: "mudanza", title: "Mudanza", subtitle: "Económicas y confiables", prompt: "¿Qué empresas de mudanza económicas hay cerca de mí?", icon: subOptionIcon("mudanza") },
      { id: "tecnico", title: "Técnico PC", subtitle: "Soporte y reparación", prompt: "Mi computadora está fallando, ¿dónde la pueden revisar?", icon: subOptionIcon("tecnico") },
      { id: "clases", title: "Clases", subtitle: "Particulares y online", prompt: "Busco clases particulares de inglés en mi zona", icon: subOptionIcon("clases") },
    ],
  },
  {
    id: "ofertas",
    title: "Ofertas",
    subtitle: "Promociones del día",
    icon: <TagIcon />,
    subOptions: [
      { id: "hoy", title: "Hoy", subtitle: "Las mejores del día", prompt: "¿Qué ofertas hay hoy cerca de mí?", icon: subOptionIcon("hoy") },
      { id: "2x1", title: "2x1", subtitle: "En comida y delivery", prompt: "¿Dónde hay promociones 2x1 en comida?", icon: subOptionIcon("2x1") },
      { id: "ropa", title: "Ropa", subtitle: "Descuentos en tiendas", prompt: "¿Qué tiendas de ropa tienen descuentos ahora?", icon: subOptionIcon("ropa") },
      { id: "super", title: "Súper", subtitle: "Promos en mercados", prompt: "¿Cuáles son las promos del supermercado esta semana?", icon: subOptionIcon("super") },
      { id: "electronica", title: "Electrónica", subtitle: "Ofertas en gadgets", prompt: "¿Qué ofertas hay en electrónica y gadgets?", icon: subOptionIcon("electronica") },
      { id: "cupones", title: "Cupones", subtitle: "Descuentos activos", prompt: "¿Qué cupones están activos ahora?", icon: subOptionIcon("cupones") },
    ],
  },
];

type SectionDef = {
  key: keyof TrendingSections;
  title: string;
  icon: React.ReactNode;
};

// Clean underline tab row (Twitter / YouTube style). One component for both
// the live trending view and the static cold-start fallback, so they stay
// visually consistent. `position: relative` is the anchor for the indicator.
function TabRow<T extends string>({
  tabs,
  activeKey,
  onChange,
}: {
  tabs: { key: T; title: string; icon: React.ReactNode }[];
  activeKey: T;
  onChange: (key: T) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement | null>(null);
  const tabRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  useEffect(() => {
    const update = () => {
      const row = rowRef.current;
      const btn = tabRefs.current[activeKey];
      if (!row || !btn) return;
      const rowRect = row.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setIndicator({ left: btnRect.left - rowRect.left, width: btnRect.width });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [activeKey, tabs]);

  return (
    <div ref={rowRef} className="relative flex gap-5 flex-wrap" role="tablist">
      {tabs.map((def, i) => {
        const selected = def.key === activeKey;
        return (
          <button
            key={def.key}
            ref={(el) => {
              tabRefs.current[def.key] = el;
            }}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(def.key)}
            className="group flex items-center gap-1.5 py-2 text-[0.92rem] font-semibold transition-colors duration-200"
            style={{
              color: selected ? "var(--text-primary)" : "var(--text-tertiary)",
              animation: `fadeIn 0.4s ease-out ${i * 60}ms backwards`,
            }}
            onMouseEnter={(e) => {
              if (!selected) e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (!selected) e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <span
              className="w-4 h-4 inline-flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ color: selected ? "var(--primary)" : "var(--text-tertiary)" }}
            >
              {def.icon}
            </span>
            <span className="whitespace-nowrap">{def.title}</span>
          </button>
        );
      })}
      {indicator.width > 0 && (
        <span
          aria-hidden
          className="absolute -bottom-[1px] h-[3px] rounded-full pointer-events-none"
          style={{
            left: indicator.left,
            width: indicator.width,
            background: "linear-gradient(90deg, #FF9F0A 0%, #10A37F 100%)",
            transition: "left 0.35s cubic-bezier(0.2, 0, 0, 1), width 0.35s cubic-bezier(0.2, 0, 0, 1)",
            boxShadow: "0 0 14px rgba(16, 163, 127, 0.55)",
          }}
        />
      )}
    </div>
  );
}

const TAB_DEFS: SectionDef[] = [
  { key: "trending", title: "Tendencia",     icon: <FireIcon /> },
  { key: "forYou",   title: "Para vos",      icon: <SparklesIcon /> },
  { key: "nearYou",  title: "Cerca de ti",   icon: <MapPinIcon /> },
];

// Category accent colors. Each card gets a left border and a subtle
// hover glow tinted with its category. The dark-theme tokens are
// intentionally muted so cards stay readable but the eye can group
// them by color (comida = green, servicios = blue, ofertas = yellow).
const CATEGORY_ACCENT: Record<string, { color: string; label: string }> = {
  comida:    { color: "#22c55e", label: "Comida"    },
  servicios: { color: "#3b82f6", label: "Servicios" },
  ofertas:   { color: "#eab308", label: "Ofertas"   },
};
const FALLBACK_ACCENT = { color: "#9ca3af", label: "" };

export default function DiscoverSuggestions({ onSelect, sections, loading }: Props) {
  // Only show tabs that have at least one sub-option. If none have data, fall
  // back to the static curated list (cold start) — but only AFTER the initial
  // fetch has resolved. While the first /api/trending call is in flight, we
  // render a skeleton of the same card size so there's no 6→4 card flash.
  const visibleTabs = TAB_DEFS.filter((def) => sections[def.key].length > 0);
  if (visibleTabs.length === 0) {
    if (loading) return <SkeletonGrid />;
    return <StaticFallback onSelect={onSelect} />;
  }

  // Track the active tab. Default to the first visible one; if the active tab
  // loses its data (e.g., trending goes empty after a re-fetch), fall back
  // to the first visible tab so we never render an empty state.
  const [activeKey, setActiveKey] = useState<keyof TrendingSections>(visibleTabs[0].key);
  useEffect(() => {
    if (!visibleTabs.some((t) => t.key === activeKey)) {
      setActiveKey(visibleTabs[0]?.key ?? "trending");
    }
  }, [visibleTabs, activeKey]);

  const activeItems = sections[activeKey];
  const cards = flattenToCards(activeItems);

  return (
    <div className="w-full flex flex-col gap-4">
      <TabRow
        tabs={visibleTabs}
        activeKey={activeKey}
        onChange={(k) => setActiveKey(k)}
      />

      {/* Cards below — the `key` on the grid re-mounts the cards on tab switch,
          which re-fires the staggered fadeIn animation. Small but feels alive. */}
      <div key={activeKey} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {cards.length > 0 ? (
          cards.map((c, i) => (
            <PromptCard
              key={`${activeKey}-${c.subOptionId}-${i}`}
              prompt={c.prompt}
              icon={subOptionIcon(c.subOptionId)}
              subtitle={c.prompt}
              categoryId={c.categoryId}
              top={i === 0}
              index={i}
              onClick={() =>
                onSelect(c.prompt, {
                  categoryId: c.categoryId,
                  subOptionId: c.subOptionId,
                  source: "discover",
                })
              }
            />
          ))
        ) : (
          <div
            className="col-span-full text-[0.82rem] py-3 text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Sin sugerencias por ahora
          </div>
        )}
      </div>
    </div>
  );
}

// Flatten a section's sub-options into individual prompt cards. Takes up to
// 3 top sub-options, each with up to 2 prompts, capped at 4 cards total.
function flattenToCards(items: TrendingSubOption[]): {
  prompt: string;
  subOptionId: string;
  categoryId: string;
}[] {
  const cards: { prompt: string; subOptionId: string; categoryId: string }[] = [];
  for (const sub of items.slice(0, 3)) {
    for (const prompt of (sub.prompts ?? []).slice(0, 2)) {
      cards.push({
        prompt,
        subOptionId: sub.id,
        categoryId: sub.categoryId,
      });
      if (cards.length >= 4) break;
    }
    if (cards.length >= 4) break;
  }
  return cards;
}

// Skeleton placeholder for the first load. Same card dimensions and grid
// layout as the real cards, so when /api/trending resolves there's no
// layout shift. The user sees a calm 4-card placeholder pulse instead
// of the 6-card StaticFallback flashing in then out.
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center p-3 rounded-xl min-h-[58px]"
          style={{
            backgroundColor: "transparent",
            boxShadow: "inset 0 0 0 1px var(--border)",
          }}
        >
          <span
            className="shrink-0 mr-3 rounded-md"
            style={{ width: 20, height: 20, backgroundColor: "var(--border)" }}
          />
          <span
            className="flex-1 h-3 rounded"
            style={{ backgroundColor: "var(--border)" }}
          />
        </div>
      ))}
    </div>
  );
}

function StaticFallback({ onSelect }: { onSelect: Props["onSelect"] }) {
  const [active, setActive] = React.useState<StaticCategory>(STATIC_CATEGORIES[0]);
  const staticTabs = React.useMemo(
    () => STATIC_CATEGORIES.map((c) => ({ key: c.id, title: c.title, icon: c.icon })),
    []
  );
  return (
    <div className="w-full flex flex-col gap-4">
      <div className="w-full">
        <SectionLabel icon={<MapPinIcon />}>Cerca de ti</SectionLabel>
        <div className="mt-2.5">
          <TabRow
            tabs={staticTabs}
            activeKey={active.id}
            onChange={(id) => {
              const next = STATIC_CATEGORIES.find((c) => c.id === id);
              if (next) setActive(next);
            }}
          />
        </div>
      </div>
      <Divider />
      <div className="w-full">
        <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-3">
          {active.subOptions.map((s, i) => (
            <PromptCard
              key={s.id}
              prompt={s.prompt}
              icon={s.icon}
              subtitle={s.prompt}
              categoryId={active.id}
              top={i === 0}
              index={i}
              onClick={() => onSelect(s.prompt, { categoryId: active.id, subOptionId: s.id, source: "discover" })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  icon,
  subtitle,
  categoryId,
  top,
  index,
  onClick,
}: {
  prompt: string;
  icon: React.ReactNode;
  subtitle?: string;
  categoryId?: string;
  top?: boolean;
  index: number;
  onClick: () => void;
}) {
  // Category color is used ONLY on the icon stroke and the thin left border.
  // No chip background, no card tint, no glow — the card reads as a single
  // surface with one colored accent line. Fallback to neutral for unknown ids.
  const accent = (categoryId && CATEGORY_ACCENT[categoryId]) || FALLBACK_ACCENT;

  // Enlarge the icon from 14px (w-3.5) to 20px (w-5) for better visual weight.
  // The icon components hard-code their className, so we clone and override.
  const bigIcon = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<{ className?: string }>, { className: "w-5 h-5" })
    : icon;

  return (
    <button
      onClick={onClick}
      className="relative flex items-center text-left p-3 rounded-xl transition-colors min-h-[58px]"
      style={{
        backgroundColor: "transparent",
        // Thin (2px) category-colored left border + 1px neutral outline.
        boxShadow: `inset 2px 0 0 0 ${accent.color}, inset 0 0 0 1px var(--border)`,
        animation: `fadeIn 0.4s ease-out ${index * 50}ms backwards`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--surface-hover)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {/* Icon — colored with the category accent, no chip background. */}
      <span
        className="shrink-0 mr-3 inline-flex items-center justify-center"
        style={{ color: accent.color, width: 20, height: 20 }}
      >
        {bigIcon}
      </span>

      {/* Question — single line with ellipsis. Long text just truncates
          with "..." instead of wrapping to a second line so every card
          in the row has the same height. */}
      <span className="flex-1 min-w-0">
        <span
          className="block truncate text-[0.88rem] leading-snug"
          style={{ color: "var(--text-secondary)" }}
          title={subtitle ?? prompt}
        >
          {subtitle ?? prompt}
        </span>
      </span>

      {top && (
        <span
          className="ml-2 shrink-0 self-center text-[0.62rem] font-semibold uppercase tracking-wider"
          style={{ color: "#FF9F0A" }}
          title="Lo más preguntado ahora"
        >
          TOP
        </span>
      )}
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

function MapPinIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function UtensilsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 2v20" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 2v8a3 3 0 01-3 3v9" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12L12 3l9 9v9a1 1 0 01-1 1h-5v-7h-4v7H4a1 1 0 01-1-1v-9z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 21l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function PizzaIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2L3 21h18L12 2z" />
      <circle cx="9" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="13" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SushiIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
      <path strokeLinecap="round" d="M3 12c2 1 4 1 6 0s4-1 6 0 4 1 6 0" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 21c10 0 16-6 16-16-10 0-16 6-16 16z" />
      <path strokeLinecap="round" d="M5 21c2-4 5-7 9-9" />
    </svg>
  );
}

function CoffeeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h13v6a4 4 0 01-4 4H7a4 4 0 01-4-4V8z" />
      <path strokeLinecap="round" d="M16 10h2a2 2 0 010 4h-2M5 4v2M9 4v2M13 4v2" />
    </svg>
  );
}

function CakeIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M4 17h16v4H4zM5 17V12h14v5M12 12V8M9 5l3 3 3-3" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a4 4 0 015 5L17 14l-7 7-3-3 7-7-2.3-2.3a4 4 0 015-5L14.7 6.3z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function BroomIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 3l-5 5M9 11l4 4-3 6-4-4 3-6z" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path strokeLinecap="round" d="M8 20h8M12 16v4" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5v15a2 2 0 002 2h14V7a2 2 0 00-2-2H6a2 2 0 00-2 2v15" />
      <path strokeLinecap="round" d="M4 19h14" />
    </svg>
  );
}

function FireIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-3-2-6-4-8-1 4-4 7-4 12 0 4 3 7 7 7z" />
    </svg>
  );
}

function ShirtIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l4-4h8l4 4-3 3v11H7V10l-3-3zM9 4a3 3 0 006 0" />
    </svg>
  );
}

function BasketIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h18l-2 12H5L3 8zM8 8l2-4h4l2 4" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path strokeLinecap="round" d="M11 18h2" />
    </svg>
  );
}

function TicketIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 100-4V8z" />
      <path strokeLinecap="round" d="M10 8v8" strokeDasharray="2 2" />
    </svg>
  );
}
