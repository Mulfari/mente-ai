"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onSuccess }: { onSuccess?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) setError(error.message);
      else {
        setSuccess("¡Cuenta creada! Ya puedes iniciar sesión.");
        setMode("login");
        setEmail("");
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
            style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Mente AI</h2>
        </div>

        <div className="flex rounded-xl p-1 mb-5" style={{ backgroundColor: "var(--background)" }}>
          {(["login", "register"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
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

          {error && <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>}
          {success && <p className="text-sm text-center" style={{ color: "var(--primary)" }}>{success}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}