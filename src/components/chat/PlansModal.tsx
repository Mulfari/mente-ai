"use client";

import { useState, useEffect, useRef } from "react";
import type { AppConfig } from "@/lib/appConfig";

type Props = {
  appConfig: AppConfig;
  initialTab?: "plans" | "coupon";
  onClose: () => void;
  onActivated: () => void;
};

export default function PlansModal({ appConfig, initialTab = "plans", onClose, onActivated }: Props) {
  const [selected, setSelected] = useState<"weekly" | "monthly">("monthly");
  const [showCoupon, setShowCoupon] = useState(initialTab === "coupon");

  // Coupon state (mirroring AccountMenu's CouponTab)
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAdded, setShowAdded] = useState<number | null>(null);
  const couponRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCoupon && couponRef.current) {
      couponRef.current.focus();
    }
  }, [showCoupon]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/coupons/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok || data.error) {
        setError(data.error || "Error al aplicar el cupon");
        return;
      }
      const added = data.weeks_added;
      setShowAdded(added);
      setSuccess(added ? `+${added} dias anadidos` : "Cupon aplicado");
      setCode("");
      setTimeout(() => {
        onActivated();
      }, 2000);
    } catch {
      setLoading(false);
      setError("Error de conexion. Intenta de nuevo.");
    }
  }

  const planLabel = selected === "weekly" ? "Semanal" : "Mensual";
  const whatsappText = encodeURIComponent(`Hola, quiero activar el plan ${planLabel} de VeChat`);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(17,24,39,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl overflow-hidden animate-modal-in"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.18)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              Hazte ilimitado
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              Elige tu plan y chatea sin limites
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Plans section */}
        <div className="px-6 pt-5 pb-4 space-y-3">
          {/* Plan cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Weekly */}
            <button
              onClick={() => setSelected("weekly")}
              className="text-left rounded-xl p-4 transition-all"
              style={{
                backgroundColor: "var(--background)",
                border: `2px solid ${selected === "weekly" ? "var(--primary)" : "var(--border)"}`,
                boxShadow: selected === "weekly" ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)" : "none",
              }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Semanal
              </p>
              <p className="text-2xl font-bold" style={{ color: selected === "weekly" ? "var(--primary)" : "var(--text-primary)" }}>
                ${appConfig.priceWeeklyUsd}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {appConfig.planWeeklyDays} dias
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Chat ilimitado
              </p>
            </button>

            {/* Monthly */}
            <button
              onClick={() => setSelected("monthly")}
              className="text-left rounded-xl p-4 transition-all relative"
              style={{
                backgroundColor: "var(--background)",
                border: `2px solid ${selected === "monthly" ? "var(--primary)" : "var(--border)"}`,
                boxShadow: selected === "monthly" ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)" : "none",
              }}
            >
              <span
                className="absolute -top-2.5 left-3 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                style={{ backgroundColor: "var(--primary)" }}
              >
                Mejor precio
              </span>
              <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                Mensual
              </p>
              <p className="text-2xl font-bold" style={{ color: selected === "monthly" ? "var(--primary)" : "var(--text-primary)" }}>
                ${appConfig.priceMonthlyUsd}
              </p>
              <p className="text-[11px] mt-1" style={{ color: "var(--text-tertiary)" }}>
                {appConfig.planMonthlyDays} dias
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                Chat ilimitado
              </p>
            </button>
          </div>

          {/* WhatsApp button or fallback text */}
          {appConfig.whatsappNumber ? (
            <button
              onClick={() => {
                window.open(
                  `https://wa.me/${appConfig.whatsappNumber}?text=${whatsappText}`,
                  "_blank",
                  "noopener"
                );
              }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--primary), #0d8b6a)",
                boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)",
              }}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
              Pagar por WhatsApp
            </button>
          ) : (
            <p className="text-center text-xs py-3" style={{ color: "var(--text-tertiary)" }}>
              Escribenos para activar tu plan
            </p>
          )}
        </div>

        {/* Coupon section */}
        <div className="px-6 pb-5" style={{ borderTop: "1px solid var(--border)" }}>
          <button
            onClick={() => setShowCoupon((v) => !v)}
            className="w-full flex items-center justify-between py-3 text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <span>Tengo un cupon</span>
            <svg
              className="w-4 h-4 transition-transform"
              style={{ transform: showCoupon ? "rotate(180deg)" : "rotate(0deg)" }}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showCoupon && (
            <form onSubmit={handleApply} className="space-y-3 pb-1">
              <div>
                <input
                  ref={couponRef}
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="MLF-XXXXXX"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all uppercase tracking-wider"
                  style={{
                    backgroundColor: "var(--background)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
                />
              </div>

              {error && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--danger)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
                </div>
              )}

              {success && (
                <div
                  className="flex items-center gap-2 px-4 py-3 rounded-xl"
                  style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.2)" }}
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs" style={{ color: "var(--primary)" }}>{success}</span>
                </div>
              )}

              {showAdded && (
                <div
                  className="flex items-center gap-3 p-4 rounded-xl animate-fade-in"
                  style={{ backgroundColor: "rgba(16,163,127,0.12)", border: "1px solid rgba(16,163,127,0.25)" }}
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>+{showAdded} dias anadidos</p>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Tu suscripcion ha sido extendida</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !code.trim()}
                className="w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90 text-white"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}
              >
                {loading ? "Aplicando..." : "Canjear"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
