"use client";

import React, { useEffect, useState } from "react";

// Modal de compartir: estado del enlace (GET), crear/actualizar la foto fija
// (POST), desactivar (DELETE). Copiar + atajos a WhatsApp/Telegram/X.
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
  const [updatedFlash, setUpdatedFlash] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = token ? `${origin}/c/${token}` : "";

  useEffect(() => {
    fetch(`/api/share?conversationId=${conversationId}`)
      .then((r) => r.json())
      .then((j) => setToken(j.token ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function createOrUpdate() {
    setBusy(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const j = await res.json();
      if (j.token) {
        setToken(j.token);
        if (j.updated) { setUpdatedFlash(true); setTimeout(() => setUpdatedFlash(false), 2200); }
      }
    } catch { /* noop */ }
    setBusy(false);
  }

  async function revoke() {
    setBusy(true);
    try {
      await fetch(`/api/share?conversationId=${conversationId}`, { method: "DELETE" });
      setToken(null);
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

  const shareText = `Mira esta conversación en VeChat: ${url}`;
  const socials = [
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Mira esta conversación en VeChat")}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent("Mira esta conversación en VeChat")}` },
  ];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(17,24,39,0.45)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-fade-in"
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
              <p className="text-[15px] font-semibold leading-tight" style={{ color: "var(--text-primary)" }}>Compartir conversación</p>
              <p className="text-[12px] truncate" style={{ color: "var(--text-tertiary)" }}>{title}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-tertiary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-[12.5px] mb-4" style={{ color: "var(--text-secondary)" }}>
            Cualquiera con el enlace verá una <strong style={{ color: "var(--text-primary)" }}>copia de solo lectura</strong> de esta conversación. Tu nombre no aparece.
          </p>

          {loading ? (
            <div className="h-11 rounded-xl animate-pulse" style={{ backgroundColor: "var(--surface-hover)" }} />
          ) : token ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 px-3.5 py-2.5 rounded-xl text-[13px] truncate" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                  {url}
                </div>
                <button onClick={copy} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-[13px] font-semibold shrink-0 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>

              <div className="flex items-center gap-2 mb-4">
                {socials.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    className="flex-1 text-center py-2 rounded-lg text-[12.5px] font-medium transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                    {s.label}
                  </a>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                <button onClick={createOrUpdate} disabled={busy}
                  className="text-[12.5px] font-medium transition-colors hover:underline disabled:opacity-50" style={{ color: "var(--primary)" }}>
                  {busy ? "Actualizando…" : updatedFlash ? "Enlace actualizado ✓" : "Actualizar con lo nuevo"}
                </button>
                <button onClick={revoke} disabled={busy}
                  className="text-[12.5px] font-medium transition-colors hover:underline disabled:opacity-50" style={{ color: "var(--danger)" }}>
                  Desactivar enlace
                </button>
              </div>
            </>
          ) : (
            <button onClick={createOrUpdate} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              {busy ? "Creando enlace…" : "Crear enlace público"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
