import React from "react";

// Marco compartido de /sign-in y /sign-up: fondo claro a juego con la home
// pública, panel de marca a la izquierda en desktop y el componente de Clerk
// centrado a la derecha (solo en móvil).

const BULLETS = [
  { title: "Cerca de ti", detail: "Comida, servicios y ofertas de tu zona" },
  { title: "Háblale por voz", detail: "Pregunta sin escribir, como una llamada" },
  { title: "Tendencias", detail: "Lo que los venezolanos preguntan ahora" },
];

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FBFBFA" }}>
      <div
        className="hidden md:flex flex-col justify-center w-[42%] max-w-[460px] px-12"
        style={{ borderRight: "1px solid #E8EAED" }}
      >
        <a href="/" className="text-[34px] font-semibold leading-none mb-3" style={{ color: "#10A37F" }}>
          V
        </a>
        <p className="text-[22px] font-semibold mb-1.5" style={{ color: "#111827" }}>
          VeChat
        </p>
        <p className="text-[14px] mb-10" style={{ color: "#6B7280" }}>
          La IA que sí sabe de Venezuela.
        </p>
        <div className="space-y-5">
          {BULLETS.map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <span
                className="mt-1 w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "#10A37F" }}
              />
              <div>
                <p className="text-[13.5px] font-medium" style={{ color: "#111827" }}>
                  {b.title}
                </p>
                <p className="text-[12.5px]" style={{ color: "#9CA3AF" }}>
                  {b.detail}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        <a href="/" className="md:hidden text-[15px] font-semibold mb-6" style={{ color: "#111827" }}>
          <span style={{ color: "#10A37F" }}>V</span> VeChat
        </a>
        {children}
      </div>
    </div>
  );
}

// Apariencia compartida de los componentes de Clerk: claro, verde VeChat.
export const authAppearance = {
  variables: {
    colorPrimary: "#10A37F",
    colorBackground: "#ffffff",
    colorText: "#111827",
    colorTextSecondary: "#6B7280",
    colorInputBackground: "#ffffff",
    colorInputText: "#111827",
    borderRadius: "12px",
  },
} as const;
