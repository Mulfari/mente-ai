"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onSuccess, onClose }: { onSuccess?: () => void; onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [wasDownInContent, setWasDownInContent] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else {
        onSuccess ? onSuccess() : window.location.reload();
      }
    } else {
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      if (coupon.trim()) {
        const { data: couponData } = await supabase
          .from("coupons").select("*").eq("code", coupon.trim().toUpperCase())
          .is("used_by", null).single();

        if (!couponData) {
          setError("Código de cupón inválido o ya usado.");
          setLoading(false);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) {
          setError(signUpError.message);
          setLoading(false);
          return;
        }

        const { data: authUser } = await supabase.auth.getUser();
        const userId = authUser.user?.id;

        if (userId) {
          await supabase.from("profiles").upsert({
            id: userId,
            status: "active",
            subscription_weeks: 1,
            subscription_start: startDate,
            weekly_limit: 100,
            weekly_reset_at: endDate,
            used_coupon_id: couponData.id,
          });
          await supabase.from("coupons").update({
            used_by: userId,
            used_by_email: email,
            used_at: startDate,
          }).eq("id", couponData.id);
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (!signInError) {
          onSuccess ? onSuccess() : window.location.reload();
          return;
        }
        setSuccess("¡Cuenta creada y activada! Inicia sesión.");
        setMode("login");
        setCoupon("");
        setPassword("");
      } else {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        setLoading(false);
        if (signUpError) {
          setError(signUpError.message);
          return;
        }
        const { data: authUser } = await supabase.auth.getUser();
        if (authUser.user?.id) {
          await supabase.from("profiles").upsert({
            id: authUser.user.id,
            status: "inactive",
            subscription_weeks: 0,
            weekly_limit: 0,
          });
        }
        setSuccess("¡Cuenta creada! Solicita un código de cupón para activar tu cuenta.");
        setMode("login");
        setCoupon("");
        setPassword("");
      }
    }
  }

  return (
    <div id="auth-overlay" className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !wasDownInContent) onClose?.(); }}
      onMouseUp={() => setWasDownInContent(false)}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl relative"
        ref={contentRef}
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        onClick={e => e.stopPropagation()}
        onMouseDown={(e) => { if (contentRef.current?.contains(e.target as Node)) setWasDownInContent(true); }}
        onBlur={() => setWasDownInContent(false)}>
        <button onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-tertiary)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div className="text-center mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-6 h-6 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 4h2l2.5 8.5L10 5.5 12.5 12.5 15 5.5l2.5 8.5H17L14.5 4h2l-3 10H6L3 4z"/>
            </svg>
          </div>
          <h2 className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h2>
        </div>

        <div className="flex rounded-xl p-1 mb-5" style={{ backgroundColor: "var(--background)" }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); setCoupon(""); }}
              className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "white" : "var(--text-secondary)",
              }}>
              {m === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Correo electrónico" value={email}
            onChange={e => setEmail(e.target.value)} required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <input type="password" placeholder="Contraseña" value={password}
            onChange={e => setPassword(e.target.value)} required minLength={6}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          {mode === "register" && (
            <input type="text" placeholder="Código de cupón (opcional)" value={coupon}
              onChange={e => setCoupon(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          )}

          {error && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>}
          {success && <p className="text-sm text-center" style={{ color: "var(--primary)" }}>{success}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>

          {mode === "login" && (
            <button type="button" onClick={async () => {
              setError("");
              if (!email) { setError("Ingresa tu correo para recuperar la contraseña"); return; }
              setLoading(true);
              const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
              });
              setLoading(false);
              const data = await res.json();
              if (data.success) setSuccess("Revisa tu correo para restablecer la contraseña.");
              else setError("Error 500. Por favor intente nuevamente.");
            }}
              className="w-full py-2 text-xs text-center transition-colors hover:underline"
              style={{ color: "var(--text-tertiary)" }}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {mode === "register" && !coupon && (
            <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
              Sin cupón la cuenta queda pendiente de activación.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}