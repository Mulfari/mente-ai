"use client";

import Logo from "@/components/Logo";
import type { AnonConv } from "@/lib/anonConvs";

// Sidebar para visitantes SIN cuenta — replica el look del sidebar logueado
// (ConversationSidebar): mismo ancho, top bar, "Nuevo chat", divisor, filas y
// pie. Diferencias: las filas solo eliminan (las convs son efímeras) y el pie
// es un CTA para crear cuenta en vez del chip de cuenta. Logo OFICIAL.

function NewChatIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.77 9.77 0 01-4-.85L3 20l.9-3.6A7.86 7.86 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

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
  const body = (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
        backdropFilter: "blur(40px)",
        borderRight: "1px solid var(--border)",
      }}
    >
      {/* Top bar — marca (logo oficial) */}
      <div className="h-14 flex items-center shrink-0" style={{ paddingLeft: 16, paddingRight: 12 }}>
        <div className="flex items-center gap-2 min-w-0">
          <Logo size={18} />
          <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap" style={{ color: "var(--text-primary)" }}>VeChat</span>
        </div>
        <button onClick={onCloseMobile} aria-label="Cerrar menú"
          className="ml-auto md:hidden p-1.5 rounded-lg transition-colors duration-150 hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-tertiary)" }}>
          <CloseIcon />
        </button>
      </div>

      {/* Nuevo chat */}
      <div className="shrink-0 space-y-1 px-2 pb-2">
        <button onClick={onNew}
          className="w-full flex items-center gap-2 h-9 px-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
          style={{ color: "var(--text-primary)" }}>
          <NewChatIcon />
          <span className="truncate">Nuevo chat</span>
        </button>
      </div>

      {/* Divisor */}
      <div className="mx-3 h-px shrink-0" style={{ backgroundColor: "var(--border)" }} />

      {/* Lista de conversaciones (máx 3, caducan 3 días) */}
      <nav className="flex-1 overflow-y-auto px-1.5" style={{ touchAction: "pan-y" }} aria-label="Conversaciones">
        {convs.length === 0 ? (
          <div className="py-10 px-4 text-center">
            <div className="w-10 h-10 rounded-xl mx-auto mb-3 flex items-center justify-center"
              style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
              <ChatBubbleIcon />
            </div>
            <p className="text-[13px] font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Sin chats recientes</p>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>Se guardan 3 días en este dispositivo</p>
          </div>
        ) : (
          <div className="pb-3 pt-1 space-y-0.5">
            {convs.map((c) => {
              const active = activeId === c.id;
              return (
                <div key={c.id} role="button" tabIndex={0} title={c.title} onClick={() => onSelect(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(c); } }}
                  className="group relative w-full text-left rounded-lg cursor-pointer flex items-center gap-2 px-2.5 h-9 transition-colors duration-150 hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-[var(--primary)]"
                  style={{ backgroundColor: active ? "var(--surface-hover)" : undefined }}>
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ backgroundColor: "var(--primary)" }} />
                  )}
                  <span className="flex-1 min-w-0 truncate text-[13.5px]" style={{ color: "var(--text-primary)", fontWeight: active ? 600 : 450 }}>
                    {c.title || "Conversación"}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(c.id); }} aria-label="Eliminar conversación"
                    className="shrink-0 p-1 rounded-md opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-100 hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
                    style={{ color: "var(--text-tertiary)" }}>
                    <DeleteIcon />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Pie — CTA crear cuenta (en vez del chip de cuenta del logueado) */}
      <div className="shrink-0 px-2 pt-2 pb-3">
        <div className="rounded-[13px] p-3" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)" }}>
          <p className="text-[11.5px] mb-2 leading-snug" style={{ color: "var(--text-secondary)" }}>
            Crea tu cuenta en VeChat, es gratis y rápido.
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
      {/* Desktop: siempre visible, mismo ancho que el sidebar logueado (280px) */}
      <div className="hidden md:flex w-[280px] shrink-0">{body}</div>
      {/* Móvil: hoja */}
      {showMobile && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCloseMobile} />
          <div className="relative w-[280px] max-w-[85%]">{body}</div>
        </div>
      )}
    </>
  );
}
