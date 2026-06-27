"use client";

import { useState, useEffect, type ReactNode } from "react";
import { applyThemePreference, getThemePreference, type ThemePreference } from "@/lib/theme";
import type { AppConfig } from "@/lib/appConfig";

// Menú de cuenta — diseño "MenuPopover" (HANDOFF §3, dirección A recomendada):
// popover compacto de 316px anclado al chip del pie del sidebar (abre hacia
// arriba), con navegación por sub-vistas main → sus → coupon. Reusa el
// cableado real (tema, contexto+GPS, countdown, planes, métodos de pago,
// cupón, cerrar sesión). El MenuPanel (B) se descartó.

type Props = {
  userId: string;
  email: string;
  profile?: {
    subscription_weeks?: number;
    subscription_start?: string;
    subscription_end?: string;
  } | null;
  userContext: { full_name: string; city: string; custom_notes: string; interests: string } | null;
  onSignOut: () => void;
  onClose: () => void;
  onProfileUpdate?: (updates: Partial<Props["profile"]>) => void;
  onSave?: (data: { full_name: string; city: string; custom_notes: string; interests: string }) => void;
  /** Abre el flujo full-screen de planes (Plans + Checkout). */
  onSeePlans?: () => void;
  appConfig?: AppConfig;
};

// --- helpers de suscripción (countdown) ---
function endTimeOf(profile: Props["profile"]): number {
  if (!profile?.subscription_end) return 0;
  const normalized = profile.subscription_end.replace(/([+-]\d{2}):?(\d{2})?$/, "Z").replace(" ", "T");
  const t = new Date(normalized).getTime();
  return isNaN(t) ? 0 : t;
}

export default function AccountMenu({ email, profile: profileProp, userContext, onSignOut, onClose, onSave, onSeePlans }: Props) {
  const [profile, setProfile] = useState(profileProp ?? null);
  const [, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((res) => { if (res.profile) setProfile(res.profile); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const weeks = (profile?.subscription_weeks ?? 0) || 0;
  const isUnlimited = weeks < 0;
  const isPlus = isUnlimited || (weeks > 0 && endTimeOf(profile) > Date.now());
  const initial = (userContext?.full_name || email || "U").trim().charAt(0).toUpperCase();

  return (
    <>
      {/* Backdrop transparente — cierra al tocar fuera (no oscurece como el
          modal viejo; un popover no atenúa la pantalla). */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className="mp-pop fixed z-50"
        style={{
          left: 12,
          bottom: 70,
          width: 316,
          maxWidth: "calc(100vw - 24px)",
          maxHeight: "min(80vh, 640px)",
          overflowY: "auto",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "0 18px 48px rgba(0,0,0,0.16), 0 2px 6px rgba(0,0,0,0.06)",
          padding: 8,
        }}
      >
        <MainView
          email={email}
          initial={initial}
          isPlus={isPlus}
          isUnlimited={isUnlimited}
          profile={profile}
          userContext={userContext}
          onSave={onSave}
          onSeePlans={onSeePlans}
          onSignOut={onSignOut}
        />
      </div>
    </>
  );
}

// ============================ MAIN VIEW ============================
function MainView({
  email, initial, isPlus, isUnlimited, profile, userContext, onSave, onSeePlans, onSignOut,
}: {
  email: string; initial: string; isPlus: boolean; isUnlimited: boolean;
  profile: Props["profile"]; userContext: Props["userContext"]; onSave?: Props["onSave"];
  onSeePlans?: () => void; onSignOut: () => void;
}) {
  // Tiempo restante del plan (para el card de estado, mostrado en el menú).
  const rem = Math.max(0, endTimeOf(profile) - Date.now());
  const days = Math.floor(rem / 86_400_000);
  const hours = Math.floor((rem % 86_400_000) / 3_600_000);
  const mins = Math.floor((rem % 3_600_000) / 60_000);

  return (
    <div className="mp-view">
      {/* Cabecera de cuenta */}
      <div className="flex items-center gap-2.5 px-2 pt-2.5 pb-3">
        <span className="relative w-[42px] h-[42px] rounded-full flex items-center justify-center text-[18px] font-semibold shrink-0 text-white"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
          {initial}
          {isPlus && (
            <span className="absolute -right-0.5 -bottom-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center"
              style={{ backgroundColor: "var(--warning)", border: "2px solid var(--surface)" }}>
              <svg className="w-2.5 h-2.5" fill="white" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
            </span>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate text-[14.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{email}</div>
          <div className="text-[12px] font-medium mt-px" style={{ color: isPlus ? "var(--primary)" : "var(--text-tertiary)" }}>
            {isPlus ? "VeChat Plus · Activo" : "Plan gratis"}
          </div>
        </div>
      </div>

      {/* Contexto (nombre · ciudad + Detectar) */}
      <ContextCard userContext={userContext} onSave={onSave} />

      {/* Tema */}
      <ThemeSeg />

      {/* Estado del plan — organizado en el propio menú. Plus: tarjeta con el
          tiempo restante (toca para gestionar / ver planes). Free: CTA a Plus.
          Ambos van a la página de planes, donde vive el canje de cupón. */}
      <div className="px-1.5 pt-1 pb-1.5">
        {isPlus ? (
          <button onClick={onSeePlans}
            className="w-full text-left rounded-[14px] p-3.5 transition-colors hover:brightness-[1.03]"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
            <div className="flex items-center justify-between mb-2.5">
              <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold" style={{ color: "var(--primary)" }}>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
                VeChat Plus
              </span>
              <Caret />
            </div>
            {isUnlimited ? (
              <div className="text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>Acceso ilimitado</div>
            ) : (
              <div className="flex items-center gap-3.5">
                {[{ v: days, l: "días" }, { v: hours, l: "horas" }, { v: mins, l: "min" }].map((c) => (
                  <div key={c.l} className="flex items-baseline gap-1">
                    <span className="text-[20px] font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>{c.v}</span>
                    <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{c.l}</span>
                  </div>
                ))}
                <span className="ml-auto text-[10.5px] font-medium uppercase tracking-wide" style={{ color: "var(--text-tertiary)" }}>restantes</span>
              </div>
            )}
          </button>
        ) : (
          <button onClick={onSeePlans}
            className="w-full h-11 rounded-[13px] flex items-center justify-center gap-2 text-[14.5px] font-semibold text-white transition-transform active:scale-[.98]"
            style={{ backgroundColor: "var(--primary)", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 28%, transparent)" }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2z" /></svg>
            Hazte VeChat Plus
          </button>
        )}
      </div>

      <div className="h-px my-1.5 mx-2" style={{ backgroundColor: "var(--border)", opacity: 0.6 }} />
      <button onClick={onSignOut} className="mp-row flex items-center gap-3 w-full px-2.5 py-2.5 rounded-[11px] text-left">
        <svg className="w-[19px] h-[19px] shrink-0" style={{ color: "var(--danger)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
        <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--danger)" }}>Cerrar sesión</span>
      </button>
    </div>
  );
}

function Caret() {
  return (
    <svg className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

// --- Contexto: muestra "nombre · ciudad" + Detectar; toca para editar ---
function ContextCard({ userContext, onSave }: { userContext: Props["userContext"]; onSave?: Props["onSave"] }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(userContext?.full_name || "");
  const [city, setCity] = useState(userContext?.city || "");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const persist = async (nextName: string, nextCity: string) => {
    setSaving(true);
    try {
      await fetch("/api/user-context/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: nextName.trim(), city: nextCity.trim() }),
      });
      onSave?.({
        full_name: nextName.trim(), city: nextCity.trim(),
        custom_notes: userContext?.custom_notes ?? "", interests: userContext?.interests ?? "",
      });
    } catch { /* best-effort */ }
    setSaving(false);
  };

  const detect = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const json = await res.json();
          const detected = json.address?.city || json.address?.town || json.address?.village || json.address?.state || "";
          if (detected) { setCity(detected); await persist(name, detected); }
        } catch { /* ignore */ } finally { setLocating(false); }
      },
      () => setLocating(false)
    );
  };

  const label = "Mi contexto";
  const display = [name || "Sin nombre", city || "Sin ciudad"].join(" · ");

  return (
    <div className="rounded-[13px] mx-0.5 mb-2 px-3 py-2.5" style={{ backgroundColor: "var(--surface-hover)" }}>
      {!editing ? (
        <div className="flex items-center gap-2.5">
          <svg className="w-[17px] h-[17px] shrink-0" style={{ color: "var(--primary)" }} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg>
          <button onClick={() => setEditing(true)} className="flex-1 min-w-0 text-left">
            <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</div>
            <div className="truncate text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{display}</div>
          </button>
          <button onClick={detect} disabled={locating}
            className="shrink-0 flex items-center gap-1.5 h-[30px] px-2.5 rounded-[9px] text-[12px] font-semibold transition-colors hover:brightness-105 disabled:opacity-50"
            style={{ backgroundColor: "var(--surface)", color: "var(--primary)" }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
            {locating ? "…" : "Detectar"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="text-[9.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</div>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={60}
            className="h-9 rounded-[9px] px-3 text-[13.5px] outline-none"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
          <div className="flex gap-2">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Tu ciudad"
              className="flex-1 h-9 rounded-[9px] px-3 text-[13.5px] outline-none"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
            <button onClick={detect} disabled={locating} title="Detectar por GPS"
              className="shrink-0 w-9 h-9 rounded-[9px] flex items-center justify-center disabled:opacity-50"
              style={{ backgroundColor: "var(--surface)", color: "var(--primary)", border: "1px solid var(--border)" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path strokeLinecap="round" d="M12 2v3m0 14v3M2 12h3m14 0h3" /></svg>
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await persist(name, city); setEditing(false); }} disabled={saving}
              className="flex-1 h-9 rounded-[9px] text-[13px] font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--primary)" }}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button onClick={() => { setName(userContext?.full_name || ""); setCity(userContext?.city || ""); setEditing(false); }}
              className="h-9 px-3 rounded-[9px] text-[13px] font-medium"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Tema: segmentado Claro / Oscuro / Auto con pastilla deslizante ---
function ThemeSeg() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => { setPref(getThemePreference()); }, []);
  const choose = (next: ThemePreference) => { setPref(next); applyThemePreference(next); };

  const OPTS: { id: ThemePreference; label: string; icon: ReactNode }[] = [
    { id: "light", label: "Claro", icon: <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2" /><g stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></g></svg> },
    { id: "dark", label: "Oscuro", icon: <svg className="w-[15px] h-[15px]" fill="currentColor" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg> },
    { id: "system", label: "Auto", icon: <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><rect x="2.5" y="4" width="19" height="13" rx="2" /><path strokeLinecap="round" d="M8.5 21h7m-3.5-4v4" /></svg> },
  ];

  return (
    <div className="px-2 pb-2">
      <div className="text-[9.5px] font-semibold uppercase tracking-wider mx-0.5 mt-1 mb-1.5" style={{ color: "var(--text-tertiary)" }}>Tema</div>
      <div className="flex gap-1 rounded-[12px] p-1" style={{ backgroundColor: "var(--surface-hover)" }}>
        {OPTS.map((o) => {
          const on = pref === o.id;
          return (
            <button key={o.id} onClick={() => choose(o.id)}
              className="relative flex-1 h-[34px] rounded-[9px] flex items-center justify-center gap-1.5 text-[12.5px] font-semibold transition-colors"
              style={{ color: on ? "var(--text-primary)" : "var(--text-secondary)" }}>
              {on && <span className="absolute inset-0 rounded-[9px]" style={{ backgroundColor: "var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />}
              <span className="relative inline-flex items-center gap-1.5">{o.icon}{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
