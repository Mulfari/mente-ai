"use client";

import React, { useEffect, useState } from "react";

// Modal de compartir minimalista: UNA acción protagonista.
//   - Sin enlace todavía: un solo botón "Crear enlace".
//   - Ya compartido: el enlace con "Copiar" y un botón grande "Enviar por
//     WhatsApp" (el canal real del público VE). Nada más.
// La foto se pone al día sola al reabrir (mismo token), así no hace falta un
// botón "Actualizar". Revocar vive fuera del modal (menú ⋮ del sidebar).
export default function ShareModal({
  conversationId,
  title,
  onClose,
}: {
  conversationId: string;
  title: string;
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/c/${token}` : "";
  const prettyUrl = url.replace(/^https?:\/\//, "").replace(/^www\./, "");

  // Al abrir: ¿ya hay enlace? Si lo hay, lo refrescamos en silencio para que la
  // foto quede al día (mismo token); si no, esperamos a "Crear enlace".
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/share?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.token) {
          setToken(j.token);
          // refresco silencioso de la foto (no bloquea la UI)
          fetch("/api/share", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId }),
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [conversationId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function createLink() {
    setBusy(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const j = await res.json();
      if (j.token) setToken(j.token);
    } catch { /* noop */ }
    setBusy(false);
  }

  function copy() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }).catch(() => {});
  }

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Mira esta conversación en VeChat: ${url}`)}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(17,24,39,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-2xl overflow-hidden animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 24px 60px rgba(0,0,0,0.22)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Compartir</p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>{title}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-tertiary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-5">
          {loading ? (
            <div className="h-11 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
          ) : token ? (
            <>
              <div className="flex items-center gap-1.5 mb-3 rounded-xl pl-3.5 pr-1.5 py-1.5"
                style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
                <span className="flex-1 text-[13px] truncate" style={{ color: "var(--text-secondary)" }}>{prettyUrl}</span>
                <button onClick={copy}
                  className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium shrink-0 transition-colors hover:bg-[var(--surface-hover)] inline-flex items-center gap-1.5"
                  style={{ color: copied ? "var(--primary)" : "var(--text-secondary)" }}>
                  {copied ? (
                    <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>Copiado</>
                  ) : (
                    <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>Copiar</>
                  )}
                </button>
              </div>

              <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 inline-flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.47 14.38c-.3-.15-1.74-.86-2.01-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.34.45-.51.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.66-1.6-.91-2.19-.24-.57-.48-.5-.66-.5-.17 0-.37-.03-.56-.03-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.74-.71 1.99-1.4.24-.69.24-1.28.17-1.4-.07-.12-.27-.2-.56-.34z" />
                  <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.1c-1.53 0-3.03-.41-4.34-1.19l-.31-.18-3.12.82.83-3.04-.2-.31a8.21 8.21 0 0 1-1.26-4.39c0-4.54 3.7-8.23 8.24-8.23 4.54 0 8.23 3.69 8.23 8.23 0 4.54-3.69 8.24-8.23 8.24z" />
                </svg>
                Enviar por WhatsApp
              </a>
            </>
          ) : (
            <>
              <p className="text-[12.5px] mb-4" style={{ color: "var(--text-secondary)" }}>
                Se crea un enlace de <strong style={{ color: "var(--text-primary)" }}>solo lectura</strong>. Tu nombre no aparece.
              </p>
              <button onClick={createLink} disabled={busy}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                {busy ? "Creando enlace…" : (
                  <><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>Crear enlace</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
