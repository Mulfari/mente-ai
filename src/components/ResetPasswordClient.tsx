"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = payload.length % 4;
    const padded = payload + (padding > 0 ? "=".repeat(4 - padding) : "");
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export default function ResetPasswordClient() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionOk, setSessionOk] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token");
    const emailParam = urlParams.get("email");
    const typeParam = urlParams.get("type");

    if (!tokenParam || typeParam !== "recovery") {
      setError("Enlace de recuperación inválido o expirado.");
      return;
    }

    setToken(tokenParam);

    if (emailParam) {
      setEmail(emailParam);
      verifySession(tokenParam, emailParam);
    } else {
      const payload = decodeJwtPayload(tokenParam);
      if (payload && payload.email) {
        setEmail(payload.email);
        verifySession(tokenParam, payload.email);
      } else {
        setError("No se pudo extraer la información del enlace.");
      }
    }
  }, []);

  async function verifySession(t: string, e: string) {
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: "recovery",
      email: e,
      token: t,
    });

    if (verifyError) {
      setError("El enlace de recuperación ha expirado o ya fue usado.");
    } else {
      setSessionOk(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("No se pudo actualizar la contraseña. Intenta de nuevo.");
    } else {
      setSuccess(true);
      setTimeout(() => router.push("/"), 3000);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center animate-fade-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 mt-4"
            style={{ backgroundColor: "rgba(16,163,127,0.15)" }}>
            <svg className="w-6 h-6" fill="none" stroke="var(--primary)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>¡Contraseña actualizada!</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Tu contraseña ha sido cambiada exitosamente.
          </p>
          <p className="text-xs mb-6" style={{ color: "var(--text-tertiary)" }}>
            Redirigiendo al inicio de sesión en <span className="font-bold" style={{ color: "var(--primary)" }}>3</span> segundos...
          </p>
          <a href="/"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold w-full text-center"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            Ir al inicio de sesión
          </a>
        </div>
      </main>
    );
  }

  if (error && !sessionOk) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center animate-fade-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 mt-4"
            style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
            <svg className="w-6 h-6" fill="none" stroke="var(--danger)" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Enlace expirado</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {error}
          </p>
          <a href="/" className="text-xs transition-colors hover:underline" style={{ color: "var(--primary)" }}>
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  if (!sessionOk && !error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center animate-fade-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <div className="flex items-center justify-center gap-3 py-10">
            <svg className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Verificando enlace...</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Restablecer contraseña</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Nueva contraseña
            </label>
            <input type="password" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
              Confirmar contraseña
            </label>
            <input type="password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required minLength={6}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "white", boxShadow: "0 4px 14px rgba(16,163,127,0.4)" }}>
            {loading ? "Guardando..." : "Guardar nueva contraseña"}
          </button>
        </form>

        <div className="text-center mt-6">
          <a href="/" className="text-xs transition-colors hover:underline" style={{ color: "var(--primary)" }}>
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  );
}