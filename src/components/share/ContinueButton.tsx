"use client";

import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import { saveAnonConv } from "@/lib/anonConvs";

type Msg = { role: string; content: string };

// "Continuar esta conversación" en la página pública de un enlace compartido.
// Logueado → bifurca a su cuenta (API) y abre /chat/{id}. Sin cuenta → bifurca a
// su historial anónimo (localStorage) y abre /?ac={id} (migra al registrarse).
// El enlace original NUNCA se toca; cada quien sigue su propia copia.
export default function ContinueButton({ token, title, messages }: { token: string; title: string; messages: Msg[] }) {
  const { isSignedIn, isLoaded } = useAuth();
  const [busy, setBusy] = useState(false);

  async function onContinue() {
    if (busy) return;
    setBusy(true);
    if (isSignedIn) {
      try {
        const r = await fetch("/api/share/fork", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const j = await r.json();
        if (j?.conversationId) { window.location.href = `/chat/${j.conversationId}`; return; }
      } catch { /* noop */ }
      setBusy(false);
    } else {
      const id = crypto.randomUUID();
      saveAnonConv({
        id,
        title: title || "Conversación",
        messages: messages.map((m, i) => ({ id: `f${i}`, role: m.role, content: m.content })),
      });
      window.location.href = `/?ac=${id}`;
    }
  }

  return (
    <button
      onClick={onContinue}
      disabled={busy || !isLoaded}
      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
      {busy ? "Abriendo…" : "Continuar esta conversación"}
    </button>
  );
}
