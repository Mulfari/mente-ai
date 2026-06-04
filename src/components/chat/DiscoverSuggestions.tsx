"use client";

import React from "react";

type Category = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
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
  },
  {
    id: "servicios",
    title: "Servicios",
    subtitle: "Profesionales y técnicos",
    prompt: "¿Qué servicios hay disponibles cerca de mí?",
    icon: <HomeIcon />,
  },
  {
    id: "ofertas",
    title: "Ofertas",
    subtitle: "Promociones del día",
    prompt: "¿Qué ofertas hay hoy cerca de mí?",
    icon: <TagIcon />,
  },
];

export default function DiscoverSuggestions({ suggestions, loading, onSelect }: Props) {
  return (
    <div className="min-h-[16rem] sm:min-h-[14rem] w-full flex flex-col gap-5">
      <DiscoverSection onSelect={onSelect} />
      <Divider />
      <QuickQuestions suggestions={suggestions} loading={loading} onSelect={onSelect} />
    </div>
  );
}

function DiscoverSection({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="w-full">
      <SectionLabel icon={<MapPinIcon />}>Cerca de ti</SectionLabel>
      <div className="grid grid-cols-3 gap-2 w-full mt-3">
        {CATEGORIES.map((cat, i) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            index={i}
            onClick={() => onSelect(cat.prompt)}
          />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  index,
  onClick,
}: {
  category: Category;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start text-left p-2.5 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 70}ms backwards`,
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
        className="w-8 h-8 rounded-xl flex items-center justify-center mb-2 transition-transform group-hover:scale-105"
        style={{ backgroundColor: "rgba(16,163,127,0.1)", color: "var(--primary)" }}
      >
        {category.icon}
      </div>
      <div
        className="text-[0.8rem] font-semibold leading-tight"
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full mt-3">
        {showSkeleton
          ? [0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-xl animate-pulse"
                style={{ backgroundColor: "var(--surface)" }}
              />
            ))
          : suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSelect(s)}
                className="flex items-center text-left px-3.5 py-2.5 rounded-xl text-[0.8rem] leading-snug transition-all"
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
