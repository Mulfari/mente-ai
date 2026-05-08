"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export default function AuthModal() {
  const [mode, setMode] = useState<Mode>("login");
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
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-6 shadow-2xl"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Logo */}
        <div className="text-center mb-6">
          <span className="text-2xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
          <span className="text-2xl font-semibold" style={{ color: "var(--text-primary)" }}> AI</span>
        </div>

        {/* Tabs */}
        <div className="flex rounded-lg mb-6" style={{ backgroundColor: "var(--background)" }}>
          <button
            onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === "login" ? "var(--primary)" : "transparent",
              color: mode === "login" ? "white" : "var(--text-secondary)",
            }}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: mode === "register" ? "var(--primary)" : "transparent",
              color: mode === "register" ? "white" : "var(--text-secondary)",
            }}
          >
            Registrarse
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Correo electrónico"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: "var(--danger)" }}>{error}</p>
          )}
          {success && (
            <p className="text-sm text-center" style={{ color: "var(--success)" }}>{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            {loading ? "Cargando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>
      </div>
    </div>
  );
}