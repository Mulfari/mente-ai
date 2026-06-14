"use client";

import React, { useEffect, useRef, useState } from "react";

// Demo del app EN VIVO dentro del marco del teléfono (no un screenshot): la
// pantalla imita la app real (papel cálido, barra superior + input) y va
// "escribiendo" respuestas a preguntas criollas, como si estuviera corriendo.
// Colores HARDCODEADOS a la app clara (para que brille sobre la landing oscura).
// Respeta prefers-reduced-motion (muestra la primera, estática).

const C = {
  bg: "#F1ECE3",
  surface: "#FBF8F2",
  line: "#E6DFD2",
  text: "#2A2521",
  text2: "#6E655A",
  text3: "#9B9183",
  primary: "#10A37F",
  bubble: "#DCEFE5",
};

const EXCHANGES = [
  { q: "¿A cuánto está el dólar hoy?", a: [["Te traigo el ", false], ["BCV", true], [" y el paralelo del día y te lo convierto a lo que necesites. ¿Cuántos dólares?", false]] },
  { q: "¿Cómo saco cita en el SAIME?", a: [["Entra a ", false], ["saime.gob.ve", true], [", crea tu usuario, elige Pasaporte y escoge sede y fecha. Te guío en el pago si quieres.", false]] },
  { q: "Receta rápida de tequeños", a: [["Queso blanco duro en tiras, ", false], ["masa fina bien sellada", true], [" y a freír a 170°C. ¿Te paso las cantidades para 50?", false]] },
] as const;

function plain(a: readonly (readonly [string, boolean])[]): string {
  return a.map((s) => s[0]).join("");
}

// Reconstruye el texto recortado a `n` caracteres respetando los segmentos
// en negrita, para que la negrita aparezca mientras "escribe".
function renderTyped(a: readonly (readonly [string, boolean])[], n: number) {
  const out: React.ReactNode[] = [];
  let used = 0;
  for (let i = 0; i < a.length; i++) {
    const [seg, bold] = a[i];
    if (used >= n) break;
    const take = Math.min(seg.length, n - used);
    const piece = seg.slice(0, take);
    out.push(bold ? <strong key={i} style={{ fontWeight: 600 }}>{piece}</strong> : <span key={i}>{piece}</span>);
    used += take;
  }
  return out;
}

function VAvatar({ size = 26 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg, #10A37F, #0d8b6a)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width={size * 0.52} height={size * 0.52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M4 5l8 14L20 5" /></svg>
    </span>
  );
}

export default function LivePhone() {
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState(0);
  const [done, setDone] = useState(false);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce.current) { setTyped(plain(EXCHANGES[0].a).length); setDone(true); }
  }, []);

  useEffect(() => {
    if (reduce.current) return;
    const full = plain(EXCHANGES[idx].a);
    setTyped(0);
    setDone(false);
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const start = setTimeout(function tick() {
      n += 1;
      setTyped(n);
      if (n < full.length) {
        t = setTimeout(tick, 17 + Math.random() * 26);
      } else {
        setDone(true);
        t = setTimeout(() => setIdx((p) => (p + 1) % EXCHANGES.length), 2900);
      }
    }, 600);
    return () => { clearTimeout(start); clearTimeout(t); };
  }, [idx]);

  const ex = EXCHANGES[idx];

  return (
    <div style={{ background: C.bg, height: 560, borderRadius: 36, overflow: "hidden", display: "flex", flexDirection: "column", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      {/* Barra superior estilo app móvil */}
      <div style={{ height: 48, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.text2} strokeWidth={2} strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>VeChat</span>
        <span style={{ width: 24, height: 24, borderRadius: "50%", background: "linear-gradient(135deg, #10A37F, #0d8b6a)", color: "#fff", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>M</span>
      </div>

      {/* Conversación */}
      <div style={{ flex: 1, padding: "16px 14px", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <div style={{ maxWidth: "82%", background: C.bubble, color: C.text, border: "1px solid rgba(16,163,127,0.14)", borderRadius: "16px 16px 5px 16px", padding: "8px 12px", fontSize: 13, lineHeight: 1.45 }}>
            {ex.q}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9 }}>
          <VAvatar />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>VeChat</div>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: C.text, margin: 0 }}>
              {renderTyped(ex.a, typed)}
              {!done && <span className="lp-caret" />}
            </p>
          </div>
        </div>
      </div>

      {/* Input (decorativo) */}
      <div style={{ flexShrink: 0, padding: "10px 12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 999, padding: "9px 9px 9px 14px" }}>
          <span style={{ flex: 1, fontSize: 12.5, color: C.text3 }}>Pregúntale algo a VeChat...</span>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: C.primary, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </span>
        </div>
      </div>
    </div>
  );
}
