"use client";

import React from "react";

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

type Props = {
  suggestions: string[];
  loading: boolean;
  onSelect: (s: string) => void;
  recentConvs?: Conversation[];
  onSelectConv?: (conv: Conversation) => void;
  interests?: string;
  onFillInput?: (text: string) => void;
};

const INTEREST_ICONS: Record<string, React.ReactNode> = {
  música: <MusicIcon />,
  musica: <MusicIcon />,
  deportes: <SportsIcon />,
  deporte: <SportsIcon />,
  fútbol: <SportsIcon />,
  futbol: <SportsIcon />,
  cocina: <FoodIcon />,
  comida: <FoodIcon />,
  restaurantes: <FoodIcon />,
  viajes: <TravelIcon />,
  viajar: <TravelIcon />,
  tecnología: <TechIcon />,
  tecnologia: <TechIcon />,
  programación: <TechIcon />,
  programacion: <TechIcon />,
  libros: <BookIcon />,
  lectura: <BookIcon />,
  arte: <ArtIcon />,
  dibujo: <ArtIcon />,
  gaming: <GameIcon />,
  videojuegos: <GameIcon />,
  salud: <HealthIcon />,
  fitness: <HealthIcon />,
  trabajo: <WorkIcon />,
  carrera: <WorkIcon />,
  naturaleza: <NatureIcon />,
  plantas: <NatureIcon />,
  películas: <MovieIcon />,
  peliculas: <MovieIcon />,
  series: <MovieIcon />,
  fotografía: <PhotoIcon />,
  fotografia: <PhotoIcon />,
};

function iconForInterest(interest: string): React.ReactNode {
  const key = interest.toLowerCase().trim();
  return INTEREST_ICONS[key] ?? <SparklesIcon />;
}

function relativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `hace ${weeks} sem`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function pickStarterForInterest(interest: string): string {
  return `Cuéntame más sobre ${interest}`;
}

export default function DiscoverSuggestions({
  suggestions,
  loading,
  onSelect,
  recentConvs,
  onSelectConv,
  interests,
  onFillInput,
}: Props) {
  const hasContinua = !!recentConvs && recentConvs.length > 0 && !!onSelectConv;
  const interestList = interests
    ? interests.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
    : [];
  const hasParaTi = interestList.length > 0 && !!onFillInput;

  return (
    <div className="w-full flex flex-col gap-6">
      {hasContinua && (
        <ContinueRow convs={recentConvs!.slice(0, 6)} onSelectConv={onSelectConv!} />
      )}
      {hasParaTi && (
        <ParaTiRow interests={interestList} onFillInput={onFillInput!} />
      )}
      <HoyRow suggestions={suggestions} loading={loading} onSelect={onSelect} />
    </div>
  );
}

/* ====================== ROW: CONTINÚA ====================== */

function ContinueRow({
  convs,
  onSelectConv,
}: {
  convs: Conversation[];
  onSelectConv: (conv: Conversation) => void;
}) {
  return (
    <div className="w-full">
      <SectionLabel icon={<ClockIcon />}>Continúa</SectionLabel>
      <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2.5 pb-1">
          {convs.map((conv, i) => (
            <ContinueCard
              key={conv.id}
              conv={conv}
              index={i}
              onClick={() => onSelectConv(conv)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ContinueCard({
  conv,
  index,
  onClick,
}: {
  conv: Conversation;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group shrink-0 w-[200px] text-left p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--primary) 12%, var(--surface)) 0%, var(--surface) 60%)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 60}ms backwards`,
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
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
            color: "var(--primary)",
          }}
        >
          <MessageDotIcon />
        </div>
        <span
          className="text-[0.65rem] font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          {relativeTime(conv.updated_at)}
        </span>
      </div>
      <div
        className="text-[0.82rem] font-semibold leading-snug line-clamp-2"
        style={{ color: "var(--text-primary)", minHeight: "2.2em" }}
      >
        {conv.title}
      </div>
    </button>
  );
}

/* ====================== ROW: PARA TI ====================== */

function ParaTiRow({
  interests,
  onFillInput,
}: {
  interests: string[];
  onFillInput: (text: string) => void;
}) {
  return (
    <div className="w-full">
      <SectionLabel icon={<SparklesIcon />}>Para ti</SectionLabel>
      <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2.5 pb-1">
          {interests.slice(0, 8).map((interest, i) => (
            <InterestCard
              key={interest}
              interest={interest}
              index={i}
              onClick={() => onFillInput(pickStarterForInterest(interest))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function InterestCard({
  interest,
  index,
  onClick,
}: {
  interest: string;
  index: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group shrink-0 w-[160px] text-left p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 60}ms backwards`,
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
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)",
          color: "var(--primary)",
        }}
      >
        {iconForInterest(interest)}
      </div>
      <div
        className="text-[0.82rem] font-semibold leading-tight capitalize"
        style={{ color: "var(--text-primary)" }}
      >
        {interest}
      </div>
      <div
        className="text-[0.65rem] mt-1 leading-snug"
        style={{ color: "var(--text-tertiary)" }}
      >
        Toca para empezar
      </div>
    </button>
  );
}

/* ====================== ROW: HOY ====================== */

function HoyRow({
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
      <SectionLabel icon={<BoltIcon />}>Hoy</SectionLabel>
      <div className="mt-3 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        {showSkeleton ? (
          <div className="flex gap-2.5 pb-1">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="shrink-0 w-[160px] h-[100px] rounded-2xl animate-pulse"
                style={{ backgroundColor: "var(--surface)" }}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-2.5 pb-1">
            {suggestions.slice(0, 8).map((s, i) => (
              <TodayCard
                key={i}
                text={s}
                index={i}
                onClick={() => onSelect(s)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TodayCard({
  text,
  index,
  onClick,
}: {
  text: string;
  index: number;
  onClick: () => void;
}) {
  // Show first ~3 words as a "title" for the card visual, keep full text on click
  const title = text.split(/\s+/).slice(0, 3).join(" ");
  const rest = text.split(/\s+/).slice(3).join(" ");
  return (
    <button
      onClick={onClick}
      className="group shrink-0 w-[180px] text-left p-3 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--primary) 10%, var(--surface)) 0%, var(--surface) 60%)",
        border: "1px solid var(--border)",
        animation: `fadeIn 0.4s ease-out ${index * 60}ms backwards`,
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
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 18%, transparent)",
          color: "var(--primary)",
        }}
      >
        <SparklesIcon />
      </div>
      <div
        className="text-[0.82rem] font-semibold leading-snug capitalize"
        style={{ color: "var(--text-primary)" }}
      >
        {title}…
      </div>
      {rest && (
        <div
          className="text-[0.7rem] mt-1 leading-snug line-clamp-2"
          style={{ color: "var(--text-tertiary)" }}
        >
          {rest}
        </div>
      )}
    </button>
  );
}

/* ====================== SHARED ====================== */

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

/* ====================== ICONS ====================== */

function ClockIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0114z" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14z" />
    </svg>
  );
}

function MessageDotIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 21l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function SportsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" />
    </svg>
  );
}

function FoodIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 2v7c0 1.1.9 2 2 2h0a2 2 0 002-2V2M5 2v20M19 2v8a3 3 0 01-3 3v9" />
    </svg>
  );
}

function TravelIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l18-9-6 18-3-7-9-2z" />
    </svg>
  );
}

function TechIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path strokeLinecap="round" d="M2 20h20" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16a2 2 0 002 2h14V6a2 2 0 00-2-2H6a2 2 0 00-2 2zM4 18h14" />
    </svg>
  );
}

function ArtIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 4 4 0 003.46-6L13 14a3 3 0 01-3-3l1.46-2.46A4 4 0 0010 4.46 10 10 0 0112 2z" />
      <circle cx="7" cy="11" r="1" fill="currentColor" />
      <circle cx="9.5" cy="7" r="1" fill="currentColor" />
      <circle cx="14.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function GameIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 7h14a3 3 0 013 3v4a3 3 0 01-3 3h-1l-2-3H8l-2 3H5a3 3 0 01-3-3v-4a3 3 0 013-3z" />
      <path strokeLinecap="round" d="M8 11v2M7 12h2M15 12h.01M17 11h.01M17 13h.01" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path strokeLinecap="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

function NatureIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 22V8M5 12c0-4 3-7 7-7s7 3 7 7c0 2-1 4-3 5h-8c-2-1-3-3-3-5z" />
    </svg>
  );
}

function MovieIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M3 8h18M3 16h18M8 4v16M16 4v16" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <circle cx="18" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
