"use client";

import { useState } from "react";
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
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-5"
          style={{ backgroundColor: "var(--primary)" }} />
        <div className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full opacity-5"
          style={{ backgroundColor: "var(--primary)" }} />
      </div>

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 md:px-8 shrink-0 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Mente AI</span>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 relative z-10">
        <div className="w-full max-w-md">
          {/* Hero text */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl"
              style={{ backgroundColor: "var(--primary)" }}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              {mode === "login" ? "Bienvenido de nuevo" : "Crea tu cuenta"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              {mode === "login"
                ? "Accede a tu asistente IA personal"
                : "Únete y empieza a conversar con IA"}
            </p>
          </div>

          {/* Card */}
          <div className="rounded-2xl p-6 shadow-2xl animate-fade-in"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", animationDelay: "80ms" }}>
            {/* Tabs */}
            <div className="flex rounded-xl p-1 mb-6"
              style={{ backgroundColor: "var(--background)" }}>
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); setError(""); setSuccess(""); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    backgroundColor: mode === m ? "var(--primary)" : "transparent",
                    color: mode === m ? "white" : "var(--text-secondary)",
                  }}>
                  {m === "login" ? "Iniciar sesión" : "Registrarse"}
                </button>
              ))}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email" placeholder="Correo electrónico" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
              <div>
                <input
                  type="password" placeholder="Contraseña" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none transition-all"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid var(--danger)", color: "var(--danger)" }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                  style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid var(--primary)", color: "var(--primary)" }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Procesando...
                  </span>
                ) : (
                  mode === "login" ? "Iniciar sesión" : "Crear cuenta"
                )}
              </button>
            </form>
          </div>

          {/* Footer note */}
          <p className="text-center text-xs mt-6" style={{ color: "var(--text-tertiary)" }}>
            Al iniciar sesión, aceptas nuestros términos de uso
          </p>
        </div>
      </div>

      <footer className="py-4 text-center text-xs shrink-0 relative z-10" style={{ color: "var(--text-tertiary)" }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}