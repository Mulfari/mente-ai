"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthModal({ onClose }: { onClose?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        window.location.reload();
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
      } else {
        setSuccess("Cuenta creada. Espera a que un administrador active tu cuenta.");
        setMode("login");
        setEmail("");
        setPassword("");
      }
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ backgroundColor: "rgba(15,23,42,0.8)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.58 4.75C9.24 3.47 10.72 2.5 12.5 2.5c1.78 0 3.26.97 3.92 2.25M16.5 8c-2.17 0-4.23.75-5.77 2.13M15.5 16c0 5.25-4.5 9-9.5 9C6.5 25 2 21.25 2 16c0-2.5 1-4.77 2.63-6.33M14.5 12c1.88 0 3.41.97 4.27 2.44" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            Mente<span style={{ color: "var(--accent)" }}>AI</span>
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            {mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          />

          {error && (
            <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>
          )}
          {success && (
            <p className="text-sm text-center" style={{ color: "var(--success)" }}>{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-medium transition-opacity disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        {/* Toggle mode */}
        <div className="mt-4 text-center">
          {mode === "login" ? (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              ¿No tienes cuenta?{" "}
              <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
                className="font-medium" style={{ color: "var(--accent)" }}>
                Regístrate
              </button>
            </p>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              ¿Ya tienes cuenta?{" "}
              <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="font-medium" style={{ color: "var(--accent)" }}>
                Inicia sesión
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}