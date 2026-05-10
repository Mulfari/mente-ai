"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onSuccess, onClose }: { onSuccess?: () => void; onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [redirectTimer, setRedirectTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Restore remembered email
    const saved = localStorage.getItem("mulfai_email");
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  useEffect(() => {
    if (redirectTimer) clearTimeout(redirectTimer);
    return () => { if (redirectTimer) clearTimeout(redirectTimer); };
  }, [redirectTimer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      if (rememberMe) localStorage.setItem("mulfai_email", email);
      else localStorage.removeItem("mulfai_email");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else { onSuccess ? onSuccess() : window.location.reload(); }
    } else {
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        setLoading(false);
        return;
      }
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: "https://mulfai.com.ve/confirm-email",
        },
      });
      setLoading(false);
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // Get user id and create profile
      const { data: authUser } = await supabase.auth.getUser();
      if (authUser.user?.id) {
        await supabase.from("profiles").upsert({
          id: authUser.user.id,
          status: "active",
          subscription_weeks: 0,
          weekly_limit: 0,
        });
      }
      // Auto-login after registration
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setSuccess("¡Cuenta creada! Ahora puedes iniciar sesión.");
        const timer = setTimeout(() => {
          setMode("login");
          setSuccess("");
          setPassword("");
          setConfirmPassword("");
        }, 2500);
        setRedirectTimer(timer);
      } else {
        onSuccess ? onSuccess() : window.location.reload();
      }
    }
  }

  const inputStyle = (hasError: boolean) => ({
    width: "100%",
    padding: "14px 16px",
    borderRadius: "12px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "var(--background)",
    border: `1px solid ${hasError ? "var(--danger)" : "var(--border)"}`,
    color: "var(--text-primary)",
    transition: "border-color 0.2s, box-shadow 0.2s",
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
      {/* Main card */}
      <div className="w-full max-w-[400px] rounded-2xl p-8 shadow-2xl relative animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" }}>

        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl transition-all hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-tertiary)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", boxShadow: "0 8px 32px rgba(16,163,127,0.3)" }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: "var(--background)" }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); setPassword(""); setConfirmPassword(""); }}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200"
              style={{
                backgroundColor: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "white" : "var(--text-secondary)",
                boxShadow: mode === m ? "0 4px 12px rgba(16,163,127,0.3)" : "none",
              }}>
              {m === "login" ? "Iniciar sesión" : "Registrarse"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Correo electrónico
            </label>
            <input type="email" value={email}
              onChange={e => setEmail(e.target.value)} required
              placeholder="tu@correo.com"
              style={inputStyle(false)} />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Contraseña
            </label>
            <div style={{ position: "relative" }}>
              <input type={showPassword ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6}
                placeholder="••••••••"
                style={{ ...inputStyle(false), paddingRight: "44px" }} />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm password (register only) */}
          {mode === "register" && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                Confirmar contraseña
              </label>
              <div style={{ position: "relative" }}>
                <input type={showConfirm ? "text" : "password"} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••"
                  style={{ ...inputStyle(false), paddingRight: "44px" }} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}>
                  {showConfirm ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Remember me (login only) */}
          {mode === "login" && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded accent-[var(--primary)]" />
                <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Recordar cuenta</span>
              </label>
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
                else setError("Error. Por favor intente nuevamente.");
              }}
                className="text-xs transition-colors hover:underline"
                style={{ color: "var(--primary)" }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.2)" }}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs" style={{ color: "var(--primary)" }}>{success}</span>
            </div>
          )}

          {/* Submit button */}
          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all relative"
            style={{ backgroundColor: "var(--primary)", color: "white", boxShadow: "0 4px 14px rgba(16,163,127,0.4)" }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === "login" ? "Iniciando sesión..." : "Creando cuenta..."}
              </span>
            ) : (
              mode === "login" ? "Iniciar sesión" : "Crear cuenta"
            )}
          </button>
        </form>

        {/* Register hint */}
        {mode === "register" && (
          <p className="text-xs text-center mt-4" style={{ color: "var(--text-tertiary)" }}>
            Solicita un código de cupón para activar tu cuenta.
          </p>
        )}
      </div>
    </div>
  );
}