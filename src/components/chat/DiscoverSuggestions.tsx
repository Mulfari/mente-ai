"use client";

import React from "react";

type TrendingSubOption = {
  id: string;
  title: string;
  subtitle: string;
  iconKey: string;
  eventCount: number;
  prompts: string[];
  categoryId: string;
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
  trendingTopSubOptions?: TrendingSubOption[];
};

// Cold-start fallback: three fixed categories with curated sub-options. Used
// when the trending API returns nothing (zero events, or down). Kept
// permanently — the static list is the floor, trending is the ceiling.
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

type FilterEntry =
  | { kind: "trending"; sub: TrendingSubOption }
  | { kind: "static"; category: StaticCategory };

export default function DiscoverSuggestions({ onSelect, trendingTopSubOptions }: Props) {
  // Cold start: no trending → show the 3 static categories as filters.
  // Hot path: trending list → each top sub-option becomes its own filter.
  const hasTrending = (trendingTopSubOptions?.length ?? 0) > 0;

  const filters: FilterEntry[] = React.useMemo(() => {
    if (hasTrending) {
      return trendingTopSubOptions!.map((s) => ({ kind: "trending" as const, sub: s }));
    }
    return STATIC_CATEGORIES.map((c) => ({ kind: "static" as const, category: c }));
  }, [hasTrending, trendingTopSubOptions]);

  const [selectedIdx, setSelectedIdx] = React.useState(0);

  // If the filter list shrinks (e.g. trending API returns fewer items than
  // the previous render) keep `selectedIdx` in range.
  React.useEffect(() => {
    if (selectedIdx >= filters.length) setSelectedIdx(0);
  }, [filters.length, selectedIdx]);

  const active = filters[selectedIdx] ?? filters[0];

  return (
    <div className="w-full flex flex-col gap-4">
      <FiltersRow
        filters={filters}
        selectedIdx={selectedIdx}
        onSelect={setSelectedIdx}
      />
      <Divider />
      <Cards
        key={activeFilterKey(active)}
        active={active}
        onSelect={onSelect}
      />
    </div>
  );
}

function activeFilterKey(active: FilterEntry | undefined): string {
  if (!active) return "empty";
  if (active.kind === "trending") return `t:${active.sub.id}`;
  return `s:${active.category.id}`;
}

function FiltersRow({
  filters,
  selectedIdx,
  onSelect,
}: {
  filters: FilterEntry[];
  selectedIdx: number;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="w-full">
      <SectionLabel icon={<MapPinIcon />}>Cerca de ti</SectionLabel>
      <div className="flex flex-wrap gap-2 w-full mt-2.5">
        {filters.map((f, i) => (
          <FilterChip
            key={filterKey(f)}
            entry={f}
            index={i}
            selected={selectedIdx === i}
            onClick={() => onSelect(i)}
          />
        ))}
      </div>
    </div>
  );
}

function filterKey(f: FilterEntry): string {
  if (f.kind === "trending") return `t:${f.sub.id}`;
  return `s:${f.category.id}`;
}

function FilterChip({
  entry,
  index,
  selected,
  onClick,
}: {
  entry: FilterEntry;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  const isTrending = entry.kind === "trending";
  const title = isTrending ? entry.sub.title : entry.category.title;
  const subtitle = isTrending ? entry.sub.subtitle : entry.category.subtitle;
  const icon = isTrending ? subOptionIcon(entry.sub.id) : entry.category.icon;

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.82rem] font-medium transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: selected
          ? "color-mix(in srgb, var(--primary) 15%, var(--surface))"
          : "color-mix(in srgb, var(--text-primary) 4%, transparent)",
        border: selected
          ? "1px solid color-mix(in srgb, var(--primary) 60%, transparent)"
          : "1px solid var(--border)",
        color: selected ? "var(--text-primary)" : "var(--text-secondary)",
        animation: `fadeIn 0.4s ease-out ${index * 60}ms backwards`,
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--primary) 10%, var(--surface))";
        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 50%, transparent)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--text-primary) 4%, transparent)";
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-secondary)";
      }}
      title={subtitle}
    >
      <span
        className="w-3.5 h-3.5 inline-flex items-center justify-center transition-transform group-hover:scale-110"
        style={{ color: "var(--primary)" }}
      >
        {icon}
      </span>
      <span>{title}</span>
    </button>
  );
}

function Cards({
  active,
  onSelect,
}: {
  active: FilterEntry | undefined;
  onSelect: Props["onSelect"];
}) {
  if (!active) {
    return (
      <div className="w-full">
        <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
      </div>
    );
  }

  if (active.kind === "trending") {
    const prompts = active.sub.prompts ?? [];
    return (
      <div className="w-full">
        <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-3">
          {prompts.map((p, i) => (
            <PromptCard
              key={`${active.sub.id}-${i}-${p}`}
              prompt={p}
              icon={subOptionIcon(active.sub.id)}
              trending={i === 0}
              index={i}
              onClick={() =>
                onSelect(p, {
                  categoryId: active.sub.categoryId,
                  subOptionId: active.sub.id,
                  source: "discover",
                })
              }
            />
          ))}
          {prompts.length === 0 && (
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

  // Static fallback — render the category's curated sub-options.
  return (
    <div className="w-full">
      <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full mt-3">
        {active.category.subOptions.map((s, i) => (
          <PromptCard
            key={s.id}
            prompt={s.prompt}
            icon={s.icon}
            title={s.title}
            trending={false}
            index={i}
            onClick={() => onSelect(s.prompt, { categoryId: active.category.id, subOptionId: s.id, source: "discover" })}
          />
        ))}
      </div>
    </div>
  );
}

function PromptCard({
  prompt,
  icon,
  title,
  trending,
  index,
  onClick,
}: {
  prompt: string;
  icon: React.ReactNode;
  title?: string;
  trending: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative flex items-center text-left px-4 py-3 rounded-xl text-[0.88rem] leading-snug transition-all"
      style={{
        color: "var(--text-secondary)",
        backgroundColor: "transparent",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 50}ms backwards`,
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
      <span
        className="shrink-0 mr-2.5 inline-flex items-center transition-colors"
        style={{ color: "var(--text-tertiary)" }}
      >
        {icon}
      </span>
      <span className="flex-1 line-clamp-2">{title ?? prompt}</span>
      {trending && (
        <span
          className="ml-2 shrink-0 inline-flex items-center gap-1 text-[0.62rem] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          style={{
            color: "var(--primary)",
            backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)",
          }}
          title="Tendencia reciente"
        >
          <span aria-hidden>●</span>
          <span>tendencia</span>
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
