"use client";
import React from "react";

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

  return (
    <div className="w-full max-w-[704px] mx-auto px-3 sm:px-4 pt-2"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl p-5 text-center"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-11 h-11 rounded-full mx-auto mb-2.5 flex items-center justify-center text-xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)" }}>🎉</div>
        <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Llegaste a tus mensajes de hoy
        </p>
        <p className="text-[13px] mb-3.5" style={{ color: "var(--text-secondary)" }}>
          {left ? `Se renuevan en ${left} · o hazte VeChat Plus` : "Vuelve mañana · o hazte VeChat Plus"}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={onSeePlans}
            className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}>Ver planes</button>
          <button onClick={onRedeem}
            className="px-5 py-2.5 rounded-full text-[14px] transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}>Tengo un cupón</button>
        </div>
      </div>
    </div>
  );
}
