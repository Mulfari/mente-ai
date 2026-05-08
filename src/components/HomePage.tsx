"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => {
      if (d.session) router.push("/chat");
    });
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
      <header className="h-14 flex items-center justify-center px-4 shrink-0 border-b relative z-20"
        style={{ backgroundColor: "rgba(42,42,42,0.9)", borderColor: "var(--border)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg"
            style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Mente AI</span>
        </div>
      </header>

      {/* Chat preview (blurred) */}
      <div className="flex-1 relative overflow-hidden">
        {/* Blurred chat background */}
        <div className="absolute inset-0 flex flex-col opacity-30 blur-sm scale-105 select-none pointer-events-none">
          <div className="h-14 border-b" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }} />
          <div className="flex-1 flex">
            <div className="w-72 border-r" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }} />
            <div className="flex-1 flex flex-col">
              <div className="h-14 border-b" style={{ borderColor: "var(--border)" }} />
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: "var(--surface)" }}>
                    <svg className="w-7 h-7" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Mente AI</p>
                  <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Tu asistente IA personal</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Blur overlay */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(33,33,33,0.5) 0%, rgba(33,33,33,0.7) 50%, rgba(33,33,33,0.95) 100%)" }} />

        {/* Center content */}
        <div className="relative z-10 flex flex-col items-center justify-center h-full px-4">
          <div className="w-full max-w-md">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xl"
                style={{ backgroundColor: "var(--primary)" }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {mode === "login" ? "Inicia sesión para chatear" : "Crea tu cuenta gratis"}
              </h1>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {mode === "login"
                  ? "Accede a tu asistente IA personal"
                  : "Únete y empieza a conversar con IA"}
              </p>
            </div>

            <div className="rounded-2xl p-6 shadow-2xl"
              style={{ backgroundColor: "rgba(42,42,42,0.95)", border: "1px solid var(--border)", backdropFilter: "blur(20px)" }}>
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

              <form onSubmit={handleSubmit} className="space-y-4">
                <input
                  type="email" placeholder="Correo electrónico" value={email}
                  onChange={e => setEmail(e.target.value)} required
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <input
                  type="password" placeholder="Contraseña" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6}
                  className="w-full px-4 py-3.5 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />

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
                    mode === "login" ? "Entrar al chat" : "Crear cuenta"
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      <footer className="py-3 text-center text-xs shrink-0 relative z-20" style={{ color: "var(--text-tertiary)", backgroundColor: "rgba(33,33,33,0.8)", backdropFilter: "blur(12px)" }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}