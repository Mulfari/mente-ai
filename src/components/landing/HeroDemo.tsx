"use client";

import React, { useEffect, useRef, useState } from "react";

// Demo REAL del producto (no un screenshot falso): reusa las burbujas del chat
// y va pasando por preguntas típicas de Venezuela, "escribiendo" la respuesta.
// Respeta prefers-reduced-motion (muestra la primera, estática).
const EXCHANGES = [
  {
    q: "¿A cuánto está el dólar hoy?",
    a: "Te traigo la tasa del BCV y la del paralelo del día y te la convierto a lo que necesites. ¿Cuántos dólares o bolívares?",
  },
  {
    q: "¿Cómo saco cita en el SAIME para el pasaporte?",
    a: "Entra a saime.gob.ve, crea tu usuario, elige Pasaporte, escoge sede y fecha, y paga el arancel. Te guío en cada paso si quieres.",
  },
  {
    q: "Dame una receta rápida de tequeños",
    a: "Queso blanco duro en tiras, masa fina bien sellada y a freír a fuego medio hasta dorar. ¿Te paso las cantidades para 50 unidades?",
  },
];

function VAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5l8 14L20 5" />
      </svg>
    </div>
  );
}

export default function HeroDemo() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceRef.current) {
      setTyped(EXCHANGES[0].a);
      setDone(true);
    }
  }, []);

  useEffect(() => {
    if (reduceRef.current) return;
    const ex = EXCHANGES[idx];
    setTyped("");
    setDone(false);
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const startDelay = setTimeout(function tick() {
      i += 1;
      setTyped(ex.a.slice(0, i));
      if (i < ex.a.length) {
        t = setTimeout(tick, 16 + Math.random() * 26);
      } else {
        setDone(true);
        t = setTimeout(() => setIdx((p) => (p + 1) % EXCHANGES.length), 2800);
      }
    }, 520);
    return () => {
      clearTimeout(startDelay);
      clearTimeout(t);
    };
  }, [idx]);

  const ex = EXCHANGES[idx];

  return (
    <div
      className="w-full rounded-[26px] p-4 sm:p-5"
      style={{
        backgroundColor: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 30px 70px -30px rgba(42,37,33,0.35)",
      }}
    >
      {/* Encabezado del panel: marca del producto */}
      <div className="flex items-center justify-between pb-3 mb-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
            <path d="M4 5l8 14L20 5" />
          </svg>
          <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>VeChat</span>
        </div>
        <div className="flex gap-1">
          {EXCHANGES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === idx ? 16 : 6,
                backgroundColor: i === idx ? "var(--primary)" : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>

      <div className="min-h-[230px] sm:min-h-[250px]">
        {/* Pregunta del usuario */}
        <div className="flex justify-end mb-4">
          <div
            className="text-[13.5px] leading-relaxed max-w-[80%]"
            style={{
              color: "var(--text-primary)",
              backgroundColor: "var(--user-bubble)",
              border: "1px solid color-mix(in srgb, var(--primary) 14%, transparent)",
              borderRadius: "18px 18px 6px 18px",
              padding: "9px 14px",
            }}
          >
            {ex.q}
          </div>
        </div>

        {/* Respuesta de VeChat */}
        <div className="flex gap-2.5">
          <VAvatar />
          <div className="flex-1 min-w-0">
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--text-primary)" }}>VeChat</span>
            <p
              className={`text-[13.5px] leading-relaxed mt-0.5 ${!done ? "lp-caret" : ""}`}
              style={{ color: "var(--text-primary)" }}
            >
              {typed}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
