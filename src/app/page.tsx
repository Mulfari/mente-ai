"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function Home() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();
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
      else router.push("/chat");
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
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="h-14 flex items-center justify-center px-4 shrink-0 border-b"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Mente AI</span>
        </div>
      </header>

      {/* Login card */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          {/* Tabs */}
          <div className="flex rounded-xl p-1 mb-5" style={{ backgroundColor: "var(--surface)" }}>
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email" placeholder="Correo electrónico" value={email}
              onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <input
              type="password" placeholder="Contraseña" value={password}
              onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />

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

      <footer className="py-4 text-center text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}