import React from "react";

// Marco de /sign-in y /sign-up. OJO: el flujo principal de auth dentro de
// la app es el MODAL de Clerk (openSignIn/openSignUp desde ChatInterface)
// — estas páginas quedan para enlaces directos, los correos de Clerk y los
// redirects del middleware. Tarjeta centrada con la marca arriba; la
// apariencia del componente de Clerk viene global del ClerkProvider
// (src/lib/clerkAppearance.ts).
export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ backgroundColor: "#DBE4DF" }}
    >
      <a
        href="/"
        className="flex items-center gap-2 mb-8 text-[17px] font-semibold tracking-tight"
        style={{ color: "#111827" }}
      >
        <svg
          width={20}
          height={20}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "#10A37F" }}
        >
          <path d="M4 5l8 14L20 5" />
        </svg>
        VeChat
      </a>
      {children}
      <p className="mt-8 text-[12px]" style={{ color: "#9CA3AF" }}>
        La IA que sí sabe de Venezuela
      </p>
    </div>
  );
}
