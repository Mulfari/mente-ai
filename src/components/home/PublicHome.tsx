"use client";

import React from "react";
import type { PublicFeed, FeedCard } from "@/lib/feed";

// Home pública (deslogueada). Hero a pantalla completa con el input centrado
// — el chatbot es el producto — y el feed de tendencias vive debajo del fold.
// Cualquier interacción (escribir, tocar una tarjeta o un chip) guarda la
// pregunta y manda a /sign-up; tras crear la cuenta, ChatInterface la
// recupera de localStorage y la envía sola.

export const PENDING_QUESTION_KEY = "vechat-pending-question";

const COLORS = {
  bg: "#FBFBFA",
  card: "#FFFFFF",
  border: "#E8EAED",
  text: "#111827",
  textMuted: "#6B7280",
  textFaint: "#9CA3AF",
  primary: "#10A37F",
  primaryDark: "#0A6B54",
};

const CATEGORY_STYLES: Record<string, { color: string; bg: string }> = {
  comida: { color: "#D97706", bg: "#FEF7E8" },
  servicios: { color: "#0E8F6F", bg: "#E8F6F1" },
  ofertas: { color: "#DB2777", bg: "#FDF2F8" },
  tramites: { color: "#2563EB", bg: "#EFF6FF" },
  negocios: { color: "#7C3AED", bg: "#F5F3FF" },
  salud: { color: "#DC2626", bg: "#FEF2F2" },
  general: { color: "#0E8F6F", bg: "#E8F6F1" },
};

function categoryStyle(id: string) {
  return CATEGORY_STYLES[id] ?? CATEGORY_STYLES.general;
}

// ── Iconos (inline, mismo patrón del resto del código) ──
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
  arrowUp: "M12 19V5m-7 7l7-7 7 7",
  chevronDown: "M6 9l6 6 6-6",
  mic: "M12 15a3 3 0 003-3V7a3 3 0 10-6 0v5a3 3 0 003 3zm6-3a6 6 0 01-12 0M12 18v3",
  trendingUp: "M3 17l6-6 4 4 8-8m0 0v5m0-5h-5",
};

function send(prompt: string) {
  const q = prompt.trim();
  if (!q) return;
  try {
    localStorage.setItem(PENDING_QUESTION_KEY, q);
  } catch {
    /* storage lleno o bloqueado — el registro sigue valiendo */
  }
  window.location.href = "/sign-up";
}

function TrendCard({ card }: { card: FeedCard }) {
  const style = categoryStyle(card.categoryId);
  return (
    <button
      onClick={() => send(card.prompt)}
      className="text-left rounded-2xl p-3.5 transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
      style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
    >
      <span
        className="inline-block text-[10px] font-medium px-2.5 py-0.5 rounded-full"
        style={{ color: style.color, backgroundColor: style.bg }}
      >
        {card.categoryLabel}
      </span>
      <p className="text-[13px] font-medium mt-2 mb-1 leading-snug" style={{ color: COLORS.text }}>
        {card.prompt}
      </p>
      {card.count !== null && (
        <span className="text-[11px] flex items-center gap-1" style={{ color: COLORS.textFaint }}>
          <Icon d={ICONS.trendingUp} size={12} color={COLORS.primary} /> {card.count} hoy
        </span>
      )}
    </button>
  );
}

export default function PublicHome({ feed }: { feed: PublicFeed }) {
  const [question, setQuestion] = React.useState("");
  const feedRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: COLORS.bg, color: COLORS.text }}>
      {/* ── Hero: pantalla completa, input centrado ── */}
      <section className="relative flex flex-col" style={{ minHeight: "100dvh" }}>
        <header className="flex items-center justify-between px-5 sm:px-8 py-4">
          <span className="text-[15px] font-semibold tracking-tight">
            <span style={{ color: COLORS.primary }}>V</span> VeChat
          </span>
          <div className="flex items-center gap-2.5">
            <a
              href="/sign-in"
              className="text-[13px] px-3 py-2 rounded-full transition-colors hover:bg-black/5"
              style={{ color: COLORS.textMuted }}
            >
              Iniciar sesión
            </a>
            <a
              href="/sign-up"
              className="text-[13px] font-medium text-white px-4 py-2 rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: COLORS.primary }}
            >
              Crear cuenta
            </a>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-16">
          <h1 className="text-[28px] sm:text-[34px] font-semibold text-center mb-1.5 tracking-tight">
            Epa, ¿qué te cuenta<span style={{ color: COLORS.primary }}>?</span>
          </h1>
          <p className="text-[14px] text-center mb-8" style={{ color: COLORS.textMuted }}>
            La IA que sí sabe de Venezuela — pregunta lo que sea
          </p>

          <form
            className="w-full max-w-[560px] flex items-center gap-3 rounded-full pl-6 pr-2 py-2"
            style={{
              backgroundColor: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 2px 20px rgba(0,0,0,0.07)",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              send(question);
            }}
          >
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="¿Dónde venden las mejores arepas de tu zona?"
              aria-label="Escribe tu pregunta"
              className="flex-1 min-w-0 bg-transparent outline-none text-[15px] py-2.5"
              style={{ color: COLORS.text }}
            />
            <button
              type="button"
              onClick={() => send(question || "")}
              aria-label="Hablar con VeChat"
              className="p-2 rounded-full transition-colors hover:bg-black/5"
              style={{ color: COLORS.textFaint }}
            >
              <Icon d={ICONS.mic} size={18} />
            </button>
            <button
              type="submit"
              aria-label="Enviar pregunta"
              className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: COLORS.primary, color: "#fff" }}
              disabled={!question.trim()}
            >
              <Icon d={ICONS.arrowUp} size={18} strokeWidth={2.25} />
            </button>
          </form>
          <p className="text-[12px] mt-5" style={{ color: COLORS.textFaint }}>
            Gratis para empezar — crea tu cuenta en 10 segundos con Google
          </p>
        </div>

        <button
          onClick={() => feedRef.current?.scrollIntoView({ behavior: "smooth" })}
          aria-label="Ver tendencias"
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 cursor-pointer transition-opacity hover:opacity-70"
          style={{ color: COLORS.textFaint }}
        >
          <span className="text-[11.5px]">Mira lo que se pregunta la gente</span>
          <span className="animate-bounce">
            <Icon d={ICONS.chevronDown} size={18} />
          </span>
        </button>
      </section>

      {/* ── Feed de tendencias (below the fold) ── */}
      <section ref={feedRef} className="max-w-[760px] mx-auto px-5 sm:px-8 pb-20 pt-10">
        <div className="flex items-center gap-2 mb-4">
          <Icon d={ICONS.flame} size={18} color="#D85A30" />
          <h2 className="text-[16px] font-semibold">Tendencias ahora</h2>
        </div>

        <div className="grid gap-2.5 mb-10" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
          <button
            onClick={() => send(feed.featured.prompt)}
            className="text-left rounded-2xl p-5 flex flex-col justify-between row-span-2 min-h-[180px] transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
            style={{
              gridRow: "span 2",
              background: `linear-gradient(160deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
            }}
          >
            <span
              className="self-start text-[11px] font-medium px-2.5 py-1 rounded-full"
              style={{ color: "#C7F3E6", backgroundColor: "rgba(255,255,255,0.16)" }}
            >
              #1 en Venezuela
            </span>
            <div>
              <p className="text-[17px] sm:text-[19px] font-semibold text-white leading-snug mb-2">
                “{feed.featured.prompt}”
              </p>
              {feed.featured.count !== null && (
                <span className="text-[12px] flex items-center gap-1.5" style={{ color: "#C7F3E6" }}>
                  <Icon d={ICONS.trendingUp} size={14} color="#C7F3E6" />
                  {feed.featured.count} personas preguntaron esto hoy
                </span>
              )}
            </div>
          </button>
          {feed.trending.slice(0, 4).map((card) => (
            <TrendCard key={card.prompt} card={card} />
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Icon d={ICONS.mapPin} size={17} color={COLORS.primary} />
          <h2 className="text-[16px] font-semibold">Cerca de ti</h2>
          {feed.nearYou.city && (
            <span
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
              style={{ color: COLORS.primaryDark, backgroundColor: "#E8F6F1" }}
            >
              {feed.nearYou.city}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-10">
          {feed.nearYou.prompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className="text-[12.5px] px-4 py-2 rounded-full transition-colors cursor-pointer hover:bg-black/5"
              style={{ color: COLORS.text, backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <Icon d={ICONS.clock} size={17} color={COLORS.textMuted} />
          <h2 className="text-[16px] font-semibold">Preguntando ahora</h2>
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: COLORS.primary }} />
        </div>
        <div className="rounded-2xl px-4" style={{ backgroundColor: COLORS.card, border: `1px solid ${COLORS.border}` }}>
          {feed.recent.map((item, i) => (
            <button
              key={item.prompt}
              onClick={() => send(item.prompt)}
              className="w-full flex items-center justify-between gap-4 py-3 text-left cursor-pointer group"
              style={{ borderTop: i === 0 ? "none" : `1px solid #F3F4F6` }}
            >
              <span className="text-[13px] truncate group-hover:underline" style={{ color: COLORS.text }}>
                “{item.prompt}”
              </span>
              <span className="text-[11px] shrink-0" style={{ color: COLORS.textFaint }}>
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

        <div className="mt-14 text-center">
          <p className="text-[15px] font-medium mb-3">¿Listo para preguntar lo tuyo?</p>
          <a
            href="/sign-up"
            className="inline-block text-[14px] font-medium text-white px-7 py-3 rounded-full transition-opacity hover:opacity-90"
            style={{ backgroundColor: COLORS.primary }}
          >
            Crear mi cuenta gratis
          </a>
          <p className="text-[11.5px] mt-8" style={{ color: COLORS.textFaint }}>
            VeChat · Hecho para Venezuela
          </p>
        </div>
      </section>
    </div>
  );
}
