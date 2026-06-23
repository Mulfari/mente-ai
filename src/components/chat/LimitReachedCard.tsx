"use client";
import React from "react";

// Aviso de límite diario — estilizado como un MENSAJE DEL ASISTENTE (avatar
// VeChat + burbuja) para que se sienta que "el chat te responde" cuando se
// agotan las preguntas del plan gratis. Reemplaza al input al agotar.
export default function LimitReachedCard({ resetAt, onSeePlans, onRedeem }: {
  resetAt: string | null; onSeePlans: () => void; onRedeem: () => void;
}) {
  const [left, setLeft] = React.useState("");
  React.useEffect(() => {
    if (!resetAt) return;
    const tick = () => {
      const ms = new Date(resetAt).getTime() - Date.now();
      if (ms <= 0) { setLeft(""); return; }
      const h = Math.floor(ms / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(h > 0 ? `${h} h ${m} min` : `${m} min`);
    };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, [resetAt]);

  const waitLine = left ? `o vuelve en ${left} para seguir gratis` : "o vuelve mañana para seguir gratis";

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pt-2"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="flex gap-2.5 items-start">
        {/* Avatar VeChat — para que el aviso se lea como un mensaje del chat */}
        <span className="w-8 h-8 rounded-full flex items-center justify-center text-white shrink-0 mt-0.5"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2z" /></svg>
        </span>
        <div className="flex-1 min-w-0 rounded-2xl rounded-tl-md px-4 py-3.5"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--text-primary)" }}>
            Llegaste a tu límite de preguntas de hoy del plan gratis. Para seguir sin límites hazte{" "}
            <b style={{ color: "var(--primary)" }}>VeChat Plus</b> — {waitLine}.
          </p>
          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={onSeePlans}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13.5px] font-semibold text-white transition-transform active:scale-95"
              style={{ backgroundColor: "var(--primary)", boxShadow: "0 3px 10px color-mix(in srgb, var(--primary) 24%, transparent)" }}>
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z" /></svg>
              Hazte Plus
            </button>
            <button onClick={onRedeem}
              className="px-4 py-2 rounded-full text-[13.5px] font-medium transition-colors hover:opacity-80"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}>
              Tengo un cupón
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
