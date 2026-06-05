"use client";

import { ReactNode } from "react";

type LandingPageProps = {
  onShowAuth: (mode: "login" | "register") => void;
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
          boxShadow: "0 4px 16px color-mix(in srgb, var(--primary) 30%, transparent)",
        }}
      >
        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </div>
      <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
        <span style={{ color: "var(--primary)" }}>V</span>eChat
      </span>
    </div>
  );
}

const VALUE_PROPS: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 11l18-8-8 18-2-8-8-2z" />
      </svg>
    ),
    title: "Pizza cerca de ti",
    body: "Pizzerías y delivery abiertos ahora en tu ciudad.",
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    ),
    title: "Plomería urgente",
    body: "Técnicos disponibles para emergencias en tu zona.",
  },
  {
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    title: "Ofertas de hoy",
    body: "Las promociones del día en tu supermercado favorito.",
  },
];

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.02] active:scale-100"
      style={{
        background: "linear-gradient(135deg, var(--primary), var(--primary-hover))",
        boxShadow: "0 8px 32px color-mix(in srgb, var(--primary) 35%, transparent)",
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-6 py-3 rounded-xl text-sm font-medium transition-all"
      style={{
        color: "var(--text-secondary)",
        background: "color-mix(in srgb, var(--surface) 60%, transparent)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </button>
  );
}

export default function LandingPage({ onShowAuth }: LandingPageProps) {
  return (
    <div className="relative min-h-full overflow-y-auto">
      {/* Top bar */}
      <div
        className="sticky top-0 z-10 px-4 sm:px-6 py-3 flex items-center justify-between"
        style={{
          backgroundColor: "color-mix(in srgb, var(--background) 75%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Logo />
        <button
          onClick={() => onShowAuth("login")}
          className="text-sm font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          ¿Ya tienes cuenta? <span style={{ color: "var(--primary)" }}>Inicia sesión</span>
        </button>
      </div>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-10 text-center">
        <h1
          className="text-4xl sm:text-5xl font-semibold tracking-tighter"
          style={{ color: "var(--text-primary)" }}
        >
          <span style={{ color: "var(--primary)" }}>V</span>eChat
        </h1>
        <p
          className="mt-3 text-base sm:text-lg max-w-xl mx-auto"
          style={{ color: "var(--text-secondary)" }}
        >
          Tu asistente de IA hecho para Venezuela. Pregúntale por pizza, plomería u ofertas — lo que pasa en tu ciudad, hoy.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <PrimaryButton onClick={() => onShowAuth("register")}>Crear cuenta gratis</PrimaryButton>
          <GhostButton onClick={() => onShowAuth("login")}>Ya tengo cuenta</GhostButton>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-wider mb-4 text-center"
          style={{ color: "var(--text-tertiary)" }}
        >
          Lo que puedes preguntarle
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          {VALUE_PROPS.map((v) => (
            <button
              key={v.title}
              onClick={() => onShowAuth("register")}
              className="group rounded-xl px-4 py-4 text-left transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-2 mb-1.5" style={{ color: "var(--primary)" }}>
                {v.icon}
                <span className="text-[0.95rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                  {v.title}
                </span>
              </div>
              <p className="text-[0.82rem] leading-snug" style={{ color: "var(--text-secondary)" }}>
                {v.body}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-xl mx-auto px-4 sm:px-6 pb-20 text-center">
        <p
          className="text-[0.65rem] font-semibold uppercase tracking-wider mb-3"
          style={{ color: "var(--text-tertiary)" }}
        >
          Empieza gratis
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Sin tarjeta. <strong style={{ color: "var(--text-primary)" }}>20 mensajes por hora.</strong>
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          Upgrade cuando quieras, con Pago Móvil, Zelle o Binance.
        </p>
        <div className="mt-6">
          <PrimaryButton onClick={() => onShowAuth("register")}>Crear cuenta gratis</PrimaryButton>
        </div>
      </section>
    </div>
  );
}
