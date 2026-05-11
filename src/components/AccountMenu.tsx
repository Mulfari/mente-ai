"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
  profile: {
    subscription_weeks?: number;
    subscription_start?: string;
    subscription_end?: string;
    weekly_limit?: number;
    messages_used?: number;
  } | null;
  onSignOut: () => void;
  onClose: () => void;
};

export default function AccountMenu({ email, profile, onSignOut, onClose }: Props) {
  const [view, setView] = useState<"main" | "coupon">("main");
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [tick, setTick] = useState(0); // force re-render every second
  const supabase = createClient();

  // Tick every second to update countdown
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const weeks = profile?.subscription_weeks ?? 0;
  const isUnlimited = weeks < 0;
  const isActive = profile && (weeks > 0 || isUnlimited);

  function getCountdown() {
    if (isUnlimited) return null;
    if (!profile || weeks <= 0) return null;
    const endStr = profile.subscription_end;
    if (!endStr) return null;

    const end = new Date(endStr).getTime();
    const now = Date.now();
    const diffMs = end - now;

    if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / (24 * 60 * 60));
    const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds, expired: false };
  }

  function getStatusColor() {
    if (isUnlimited) return { bg: "rgba(139,92,246,0.2)", color: "#8b5cf6" };
    if (!profile || weeks <= 0) return { bg: "rgba(239,68,68,0.2)", color: "var(--danger)" };
    const endStr = profile.subscription_end;
    if (endStr) {
      const diffMs = new Date(endStr).getTime() - Date.now();
      if (diffMs <= 0) return { bg: "rgba(239,68,68,0.2)", color: "var(--danger)" };
      if (diffMs < 3 * 24 * 60 * 60 * 1000) return { bg: "rgba(245,158,11,0.2)", color: "var(--warning)" };
    }
    return { bg: "rgba(16,163,127,0.2)", color: "var(--primary)" };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick; // consume tick to trigger re-render
  const statusColor = getStatusColor();
  const countdown = getCountdown();

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!couponCode.trim()) return;
    setError("");
    setSuccess("");
    setLoading(true);

    const res = await fetch("/api/coupons/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode.trim() }),
    });
    const data = await res.json();
    setLoading(false);

    if (data.error) {
      setError(data.error);
    } else if (data.success) {
      setSuccess("¡Cupón aplicado correctamente!");
      setCouponCode("");
      // Notify parent to reload profile
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 1500);
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm max-sm:max-w-full max-sm:mx-2 rounded-2xl p-5 sm:p-6 shadow-2xl animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>

        {/* Close */}
        <button onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl transition-all hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-tertiary)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo + title */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Mi cuenta
          </h2>
        </div>

        {/* Email */}
        <div className="flex items-center gap-3 mb-5 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "var(--background)" }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
            {email.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Correo</p>
            <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{email}</p>
          </div>
        </div>

        {/* Status */}
        <div className="mb-5 px-4 py-3 rounded-xl"
          style={{ backgroundColor: "var(--background)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0`}
              style={{ background: statusColor.bg, color: statusColor.color }}>
              {isUnlimited ? "∞" : isActive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Estado</p>
              <p className="text-sm font-semibold" style={{ color: statusColor.color }}>
                {isUnlimited ? "Ilimitado" : isActive ? "Activa" : countdown?.expired ? "Expirada" : "Inactiva"}
              </p>
            </div>
          </div>

          {/* Live countdown */}
          {isUnlimited ? (
            <div className="text-center py-2">
              <span className="text-2xl font-bold" style={{ color: "#8b5cf6" }}>∞</span>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Acceso ilimitado</p>
            </div>
          ) : !isActive || !countdown || countdown.expired ? (
            <div className="text-center py-2">
              <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Suscripción expirada</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Añade tiempo para continuar</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 text-center">
              {[
                { value: countdown!.days, label: "días" },
                { value: countdown!.hours, label: "hrs" },
                { value: countdown!.minutes, label: "min" },
                { value: countdown!.seconds, label: "seg" },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-lg py-2 px-1" style={{ backgroundColor: "var(--surface)" }}>
                  <span className="text-lg font-bold block" style={{ color: statusColor.color }}>
                    {String(value).padStart(2, "0")}
                  </span>
                  <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {view === "main" ? (
          <div className="space-y-2">
            <button onClick={() => setView("coupon")}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
              Añadir cupón
            </button>
            <button onClick={onSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors hover:bg-[var(--danger)]/10"
              style={{ color: "var(--danger)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => { setView("main"); setError(""); setSuccess(""); setCouponCode(""); }}
              className="flex items-center gap-2 text-xs transition-colors hover:underline"
              style={{ color: "var(--text-tertiary)" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Volver
            </button>

            <form onSubmit={applyCoupon} className="space-y-2">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Código de cupón
                </label>
                <input type="text" value={couponCode}
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="MLF-XXXXXX"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
                  style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.2)" }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs" style={{ color: "var(--primary)" }}>{success}</span>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Aplicando...
                  </span>
                ) : "Aplicar cupón"}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}