"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

// Aterrizaje del OAuth headless (Google). Clerk completa la sesión y redirige a
// "/" (navegación completa → el server resuelve el perfil). Página transitoria.
export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: "var(--background)" }}>
      <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Entrando…</p>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
    </div>
  );
}
