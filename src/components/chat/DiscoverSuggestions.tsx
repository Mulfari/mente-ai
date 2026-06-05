"use client";

import React from "react";

type SubOption = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
};

type Category = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
  subOptions: SubOption[];
};

type Props = {
  suggestions: string[];
  loading: boolean;
  onSelect: (s: string) => void;
};

const CATEGORIES: Category[] = [
  {
    id: "comida",
    title: "Comida",
    subtitle: "Restaurantes y delivery",
    prompt: "¿Qué opciones para comer hay cerca de mí?",
    icon: <UtensilsIcon />,
    subOptions: [
      { id: "pizza", title: "Pizza", subtitle: "Cerca de mí, hoy", prompt: "¿Qué pizzerías hay cerca de mí abiertas ahora?", icon: <PizzaIcon /> },
      { id: "sushi", title: "Sushi", subtitle: "Delivery y para llevar", prompt: "¿Dónde pedir sushi con delivery?", icon: <SushiIcon /> },
      { id: "veggie", title: "Vegetariana", subtitle: "Opciones saludables", prompt: "¿Qué restaurantes vegetarianos hay cerca de mí?", icon: <LeafIcon /> },
      { id: "desayuno", title: "Desayunos", subtitle: "Brunch y cafeterías", prompt: "¿Dónde puedo desayunar o brunchear cerca de mí?", icon: <CoffeeIcon /> },
      { id: "postres", title: "Postres", subtitle: "Pastelerías y heladerías", prompt: "¿Dónde conseguir buenos postres cerca de mí?", icon: <CakeIcon /> },
      { id: "cafes", title: "Cafés", subtitle: "Para trabajar o estudiar", prompt: "¿Qué cafés tranquilos hay cerca de mí para trabajar?", icon: <CoffeeIcon /> },
    ],
  },
  {
    id: "servicios",
    title: "Servicios",
    subtitle: "Profesionales y técnicos",
    prompt: "¿Qué servicios hay disponibles cerca de mí?",
    icon: <HomeIcon />,
    subOptions: [
      { id: "plomero", title: "Plomero", subtitle: "Urgencias 24h", prompt: "Necesito un plomero urgente, ¿a quién puedo llamar?", icon: <WrenchIcon /> },
      { id: "electricista", title: "Electricista", subtitle: "Reparaciones rápidas", prompt: "¿Hay electricistas disponibles ahora en mi zona?", icon: <BoltIcon /> },
      { id: "limpieza", title: "Limpieza", subtitle: "Servicio a domicilio", prompt: "¿Cuánto cuesta un servicio de limpieza de hogar?", icon: <BroomIcon /> },
      { id: "mudanza", title: "Mudanza", subtitle: "Económicas y confiables", prompt: "¿Qué empresas de mudanza económicas hay cerca de mí?", icon: <BoxIcon /> },
      { id: "tecnico", title: "Técnico PC", subtitle: "Soporte y reparación", prompt: "Mi computadora está fallando, ¿dónde la pueden revisar?", icon: <MonitorIcon /> },
      { id: "clases", title: "Clases", subtitle: "Particulares y online", prompt: "Busco clases particulares de inglés en mi zona", icon: <BookIcon /> },
    ],
  },
  {
    id: "ofertas",
    title: "Ofertas",
    subtitle: "Promociones del día",
    prompt: "¿Qué ofertas hay hoy cerca de mí?",
    icon: <TagIcon />,
    subOptions: [
      { id: "hoy", title: "Hoy", subtitle: "Las mejores del día", prompt: "¿Qué ofertas hay hoy cerca de mí?", icon: <FireIcon /> },
      { id: "2x1", title: "2x1", subtitle: "En comida y delivery", prompt: "¿Dónde hay promociones 2x1 en comida?", icon: <TagIcon /> },
      { id: "ropa", title: "Ropa", subtitle: "Descuentos en tiendas", prompt: "¿Qué tiendas de ropa tienen descuentos ahora?", icon: <ShirtIcon /> },
      { id: "super", title: "Súper", subtitle: "Promos en mercados", prompt: "¿Cuáles son las promos del supermercado esta semana?", icon: <BasketIcon /> },
      { id: "electronica", title: "Electrónica", subtitle: "Ofertas en gadgets", prompt: "¿Qué ofertas hay en electrónica y gadgets?", icon: <DeviceIcon /> },
      { id: "cupones", title: "Cupones", subtitle: "Descuentos activos", prompt: "¿Qué cupones están activos ahora?", icon: <TicketIcon /> },
    ],
  },
];

export default function DiscoverSuggestions({ suggestions, loading, onSelect }: Props) {
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);
  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory) ?? null;
  return (
    <div className="w-full flex flex-col gap-3">
      <DiscoverSection
        categories={CATEGORIES}
        selectedId={selectedCategory}
        onSelectCategory={(id) => setSelectedCategory((prev) => (prev === id ? null : id))}
        activeSubOptions={activeCategory?.subOptions ?? []}
        onSelectSubOption={onSelect}
      />
      <Divider />
      <QuickQuestions suggestions={suggestions} loading={loading} onSelect={onSelect} />
    </div>
  );
}

function DiscoverSection({
  categories,
  selectedId,
  onSelectCategory,
  activeSubOptions,
  onSelectSubOption,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelectCategory: (id: string) => void;
  activeSubOptions: SubOption[];
  onSelectSubOption: (prompt: string) => void;
}) {
  return (
    <div className="w-full">
      <SectionLabel icon={<MapPinIcon />}>Cerca de ti</SectionLabel>
      <div className="grid grid-cols-3 gap-2 w-full mt-2">
        {categories.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            index={i}
            selected={selectedId === cat.id}
            onClick={() => onSelectCategory(cat.id)}
          />
        ))}
      </div>
      {selectedId && activeSubOptions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full mt-2">
          {activeSubOptions.map((sub, i) => (
            <SubOptionCard
              key={sub.id}
              option={sub}
              index={i}
              onClick={() => onSelectSubOption(sub.prompt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  index,
  selected,
  onClick,
}: {
  category: Category;
  index: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start text-left p-2 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: selected
          ? "color-mix(in srgb, var(--primary) 12%, var(--surface))"
          : "var(--surface)",
        border: selected
          ? "1px solid color-mix(in srgb, var(--primary) 60%, transparent)"
          : "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 70}ms backwards`,
      }}
      onMouseEnter={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 40%, transparent)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        if (selected) return;
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="w-7 h-7 rounded-xl flex items-center justify-center mb-1.5 transition-transform group-hover:scale-105"
        style={{
          backgroundColor: selected
            ? "color-mix(in srgb, var(--primary) 22%, transparent)"
            : "rgba(16,163,127,0.1)",
          color: "var(--primary)",
        }}
      >
        {category.icon}
      </div>
      <div
        className="text-[0.78rem] font-semibold leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {category.title}
      </div>
      <div
        className="text-[0.65rem] mt-0.5 leading-snug"
        style={{ color: "var(--text-tertiary)" }}
      >
        {category.subtitle}
      </div>
    </button>
  );
}

function SubOptionCard({
  option,
  index,
  onClick,
}: {
  option: SubOption;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start text-left p-2.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--primary) 10%, var(--surface)) 0%, var(--surface) 70%)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.35s ease-out ${index * 45}ms backwards`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary) 40%, transparent)";
        e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div
        className="w-6 h-6 rounded-lg flex items-center justify-center mb-1 transition-transform group-hover:scale-105"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "var(--primary)",
        }}
      >
        {option.icon}
      </div>
      <div
        className="text-[0.75rem] font-semibold leading-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {option.title}
      </div>
      <div
        className="text-[0.62rem] mt-0.5 leading-snug line-clamp-1"
        style={{ color: "var(--text-tertiary)" }}
      >
        {option.subtitle}
      </div>
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

function QuickQuestions({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: string[];
  loading: boolean;
  onSelect: (s: string) => void;
}) {
  const showSkeleton = loading || suggestions.length === 0;
  return (
    <div className="w-full">
      <SectionLabel icon={<ChatBubbleIcon />}>O pregúntale algo</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-2">
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--surface)" }}
              />
            ))
          : suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="flex items-center text-left px-3 py-2 rounded-xl text-[0.78rem] leading-snug transition-all"
                style={{
                  color: "var(--text-secondary)",
                  backgroundColor: "transparent",
                  border: "1px solid var(--border)",
                  animation: `fadeIn 0.4s ease-out ${i * 60}ms backwards`,
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
                  className="shrink-0 mr-2 inline-flex items-center transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {iconForChip(i)}
                </span>
                <span className="flex-1">{s}</span>
              </button>
            ))}
      </div>
    </div>
  );
}

function iconForChip(i: number): React.ReactNode {
  const icons = [
    <LightbulbIcon key="lb" />,
    <ChatBubbleIcon key="cb" />,
    <SparklesIcon key="sp" />,
    <TargetIcon key="tg" />,
  ];
  return icons[i % icons.length];
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

function LightbulbIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7c.6.4 1 1.1 1 1.8V18h6v-1.5c0-.7.4-1.4 1-1.8A7 7 0 0012 2z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
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
