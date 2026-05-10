"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ConfirmEmailClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Accept token from either param name (Supabase uses both)
  const rawToken = searchParams.get("token") || searchParams.get("token_hash");
  const emailParam = searchParams.get("email");

  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    async function verify() {
      if (!rawToken) {
        setError("Enlace inválido. No se encontró el token de confirmación.");
        return;
      }

      try {
        const res = await fetch("/api/auth/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: rawToken, email: emailParam }),
        });
        const data = await res.json();

        if (data.confirmed) {
          setConfirmed(true);
        } else {
          setError(data.error || "No se pudo confirmar el correo.");
        }
      } catch {
        setError("Error al conectar con el servidor.");
      }
    }

    function startCountdown() {
      const interval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            router.push("/");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    verify().then(() => {
      if (rawToken) startCountdown();
    });
  }, [rawToken, emailParam, router]);

  if (confirmed) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
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
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>¡Correo verificado!</h2>
          <p className="text-sm mb-2" style={{ color: "var(--text-secondary)" }}>
            Tu correo ha sido confirmado exitosamente.
          </p>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Ya puedes iniciar sesión en <strong>mulfai.com.ve</strong> con tus datos de acceso.
          </p>
          <div className="w-full h-px my-4" style={{ backgroundColor: "var(--border)" }} />
          <p className="text-xs mb-4" style={{ color: "var(--text-tertiary)" }}>
            Redirigiendo al inicio de sesión en <span className="font-bold" style={{ color: "var(--primary)" }}>{countdown}</span> segundos...
          </p>
          <a href="/"
            className="inline-block px-6 py-3 rounded-xl text-sm font-semibold transition-all w-full text-center"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            Ir al inicio de sesión
          </a>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
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
          <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>No se pudo verificar</h2>
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            {error}
          </p>
          <a href="/"
            className="text-xs transition-colors hover:underline"
            style={{ color: "var(--primary)" }}>
            Volver al inicio
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
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
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Verificando...</span>
        </div>
      </div>
    </main>
  );
}