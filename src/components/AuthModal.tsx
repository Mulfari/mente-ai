"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [coupon, setCoupon] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const el = document.getElementById("auth-overlay");
    if (el) el.style.display = "flex";
  }, []);

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
      const { data: existing } = await supabase
        .from("profiles").select("id").eq("email", email).single();
      if (existing) {
        setError("Este correo ya está registrado.");
        setLoading(false);
        return;
      }

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email, password
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      const userId = authData.user?.id;

      if (coupon.trim()) {
        const { data: couponData } = await supabase
          .from("coupons").select("*").eq("code", coupon.trim().toUpperCase())
          .is("used_by", null).single();

        if (!couponData) {
          setError("Código de cupón inválido o ya usado.");
          setLoading(false);
          return;
        }

        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("profiles").insert({
          id: userId,
          email,
          status: "active",
          subscription_weeks: 1,
          subscription_start: startDate,
          weekly_limit: 100,
          weekly_reset_at: endDate,
        });

        await supabase.from("coupons").update({
          used_by: userId,
          used_by_email: email,
          used_at: startDate,
        }).eq("id", couponData.id);

        const { error: profileError } = await supabase.auth.signInWithPassword({ email, password });
        setLoading(false);
        if (!profileError) {
          onSuccess ? onSuccess() : window.location.reload();
          return;
        }
        setSuccess("¡Cuenta creada y activada! Ya puedes iniciar sesión.");
        setMode("login");
        setCoupon("");
        setPassword("");
      } else {
        await supabase.from("profiles").insert({
          id: userId,
          email,
          status: "inactive",
          subscription_weeks: 0,
          weekly_limit: 0,
        });
        setLoading(false);
        setSuccess("¡Cuenta creada! Solicita un código de cupón para activar tu cuenta.");
        setMode("login");
        setCoupon("");
        setPassword("");
      }
    }
  }

  return (
    <div id="auth-overlay" className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", display: "none" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
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