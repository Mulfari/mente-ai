"use client";

import Logo from "@/components/Logo";
import type { AnonConv } from "@/lib/anonConvs";

// Sidebar para visitantes SIN cuenta — siempre visible (desktop) + hoja en
// móvil. Muestra las últimas 3 conversaciones (localStorage, caducan a 3 días)
// y un CTA para crear cuenta. Usa el logo OFICIAL.
export default function AnonSidebar({
  convs, activeId, onSelect, onNew, onDelete, onSignUp, showMobile, onCloseMobile,
}: {
  convs: AnonConv[];
  activeId: string | null;
  onSelect: (c: AnonConv) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onSignUp: () => void;
  showMobile: boolean;
  onCloseMobile: () => void;
}) {
  const rail = (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
        backdropFilter: "blur(40px)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Marca (logo oficial) */}
      <div className="h-14 flex items-center px-4 shrink-0">
        <div className="flex items-center gap-2">
          <Logo size={18} />
          <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VeChat</span>
        </div>
        <button onClick={onCloseMobile} aria-label="Cerrar menú"
          className="ml-auto md:hidden p-1.5 rounded-lg transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-tertiary)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Nuevo chat */}
      <div className="px-2 pb-2 shrink-0">
        <button onClick={onNew}
          className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-primary)" }}>
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          <span className="truncate">Nuevo chat</span>
        </button>
      </div>

      <div className="mx-3 h-px shrink-0" style={{ backgroundColor: "var(--border)" }} />

      {/* Conversaciones recientes (máx 3) */}
      <nav className="flex-1 overflow-y-auto px-1.5 py-2" style={{ touchAction: "pan-y" }}>
        {convs.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-[12px] leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
              Tus chats recientes aparecen aquí.<br />Se guardan 3 días en este dispositivo.
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {convs.map((c) => {
              const active = activeId === c.id;
              return (
                <div key={c.id} className="group relative">
                  <button onClick={() => onSelect(c)}
                    className="w-full text-left truncate pl-2.5 pr-8 py-2 rounded-lg text-[13px] transition-colors"
                    style={{
                      backgroundColor: active ? "var(--surface-hover)" : "transparent",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}>
                    {c.title || "Conversación"}
                  </button>
                  <button onClick={() => onDelete(c.id)} aria-label="Eliminar"
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--surface)]"
                    style={{ color: "var(--text-tertiary)" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* CTA crear cuenta */}
      <div className="p-2 shrink-0">
        <div className="rounded-xl p-3" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}>
          <p className="text-[11.5px] mb-2 leading-snug" style={{ color: "var(--text-secondary)" }}>
            Crea tu cuenta y guarda tus chats sin límite.
          </p>
          <button onClick={onSignUp}
            className="w-full h-8 rounded-lg text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}>
            Crear cuenta gratis
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: siempre visible */}
      <div className="hidden md:flex w-[260px] shrink-0">{rail}</div>
      {/* Móvil: hoja */}
      {showMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCloseMobile} />
          <div className="relative w-[280px] max-w-[80%] animate-slide-in-left">{rail}</div>
        </div>
      )}
    </>
  );
}
