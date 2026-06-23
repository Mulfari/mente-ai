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

type View = "main" | "sus" | "coupon";

// --- helpers de suscripción (countdown) ---
function endTimeOf(profile: Props["profile"]): number {
  if (!profile?.subscription_end) return 0;
  const normalized = profile.subscription_end.replace(/([+-]\d{2}):?(\d{2})?$/, "Z").replace(" ", "T");
  const t = new Date(normalized).getTime();
  return isNaN(t) ? 0 : t;
}

export default function AccountMenu({ email, profile: profileProp, userContext, onSignOut, onClose, onSave, onSeePlans, appConfig }: Props) {
  const [view, setView] = useState<View>("main");
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
  const isFree = !isPlus;
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
        {view === "main" && (
          <MainView
            email={email}
            initial={initial}
            isPlus={isPlus}
            isFree={isFree}
            userContext={userContext}
            onSave={onSave}
            onGoSus={() => setView("sus")}
            onGoCoupon={() => setView("coupon")}
            onSeePlans={onSeePlans}
            onSignOut={onSignOut}
          />
        )}
        {view === "sus" && (
          <SusView
            isPlus={isPlus}
            profile={profile}
            appConfig={appConfig}
            onBack={() => setView("main")}
          />
        )}
        {view === "coupon" && (
          <CouponView onBack={() => setView("main")} onClose={onClose} />
        )}
      </div>
    </>
  );
}

// ============================ MAIN VIEW ============================
function MainView({
  email, initial, isPlus, isFree, userContext, onSave, onGoSus, onGoCoupon, onSeePlans, onSignOut,
}: {
  email: string; initial: string; isPlus: boolean; isFree: boolean;
  userContext: Props["userContext"]; onSave?: Props["onSave"];
  onGoSus: () => void; onGoCoupon: () => void; onSeePlans?: () => void; onSignOut: () => void;
}) {
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

      {/* Filas */}
      <div className="px-1">
        <button onClick={onGoSus} className="mp-row flex items-center gap-3 w-full px-2.5 py-2.5 rounded-[11px] text-left">
          <svg className="w-[19px] h-[19px] shrink-0" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 16L3 5l5.5 4L12 4l3.5 5L21 5l-2 11H5zm0 3h14" /></svg>
          <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Suscripción</span>
          <span className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>{isPlus ? "Activo" : "Gratis"}</span>
          <Caret />
        </button>
        <button onClick={onGoCoupon} className="mp-row flex items-center gap-3 w-full px-2.5 py-2.5 rounded-[11px] text-left">
          <svg className="w-[19px] h-[19px] shrink-0" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
          <span className="flex-1 text-[14px] font-medium" style={{ color: "var(--text-primary)" }}>Añadir cupón</span>
          <Caret />
        </button>
      </div>

      {/* CTA (solo free) */}
      {isFree && (
        <div className="px-1.5 pt-2 pb-1.5">
          <button onClick={onSeePlans ?? onGoSus}
            className="w-full h-11 rounded-[13px] flex items-center justify-center gap-2 text-[14.5px] font-semibold text-white transition-transform active:scale-[.98]"
            style={{ backgroundColor: "var(--primary)", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 28%, transparent)" }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2z" /></svg>
            Hazte VeChat Plus
          </button>
        </div>
      )}

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

// ============================ SUS VIEW ============================
function SusView({ isPlus, profile, appConfig, onBack }: {
  isPlus: boolean; profile: Props["profile"]; appConfig?: AppConfig; onBack: () => void;
}) {
  const [price, setPrice] = useState<"week" | "month">("month");
  const [openMethod, setOpenMethod] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // countdown
  const endTime = endTimeOf(profile);
  const rem = Math.max(0, endTime - Date.now());
  const total = Math.floor(rem / 1000);
  const cd = [
    { v: Math.floor(total / 86400), l: "Días" },
    { v: Math.floor((total % 86400) / 3600), l: "Horas" },
    { v: Math.floor((total % 3600) / 60), l: "Min" },
    { v: total % 60, l: "Seg" },
  ];
  const pad = (n: number) => String(n).padStart(2, "0");

  const priceWeek = appConfig?.priceWeeklyUsd ?? 2;
  const priceMonth = appConfig?.priceMonthlyUsd ?? 6;

  // Métodos de pago — PLACEHOLDERS (igual que el modal viejo; pendientes de
  // configurar antes de cobrar de verdad).
  const methods: { id: string; label: string; sub: string; detail: string; icon: ReactNode; href?: string }[] = [
    { id: "pm", label: "Pago Móvil", sub: "Bancos nacionales", detail: "Banco: 0102 · Tel: 0414-1234567 · CI: J12345678 · Mulfari C.A.", icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><circle cx="12" cy="18" r="1" fill="var(--tint)" /></svg> },
    { id: "zelle", label: "Zelle", sub: "Transferencia en USD", detail: "pagos@mulfai.com.ve", icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M3 10l9-6 9 6v1H3v-1zm1 3h2v5H4v-5zm5 0h2v5H9v-5zm4 0h2v5h-2v-5zm5 0h2v5h-2v-5zM3 20h18v2H3v-2z" /></svg> },
    { id: "binance", label: "Binance USDT", sub: "Cripto estable", detail: "TXyZ123abc456def789ghi", icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 3-3 3-3-3 3-3zm-5 5l3 3-3 3-3-3 3-3zm10 0l3 3-3 3-3-3 3-3zm-5 5l3 3-3 3-3-3 3-3z" /></svg> },
    { id: "wa", label: "WhatsApp", sub: "Coordina con un asesor", detail: "Abrir chat", href: "https://wa.me/584141234567?text=Hola%2C%20quiero%20activar%20mi%20cuenta%20VeChat", icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.747 5.634l-.999 3.648 3.741-.981z" /></svg> },
  ];

  const copy = (id: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  };

  return (
    <div className="mp-view">
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-2.5">
        <button onClick={onBack} className="mp-row w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" style={{ color: "var(--text-primary)" }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-[16px] font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Suscripción</span>
      </div>

      {isPlus ? (
        <div className="mx-1 mb-2.5 rounded-[15px] p-3.5" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
          <div className="flex items-center gap-2 mb-2.5">
            <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: "var(--primary)" }} />
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--primary)" }}>Plan activo · se renueva en</span>
          </div>
          <div className="flex gap-1.5">
            {cd.map((c) => (
              <div key={c.l} className="flex-1 rounded-[11px] py-2 text-center" style={{ backgroundColor: "var(--surface)" }}>
                <div className="text-[20px] font-bold tabular-nums leading-tight" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>{pad(c.v)}</div>
                <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--text-tertiary)" }}>{c.l}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-1 mb-2.5 rounded-[15px] p-3.5" style={{ backgroundColor: "var(--surface-hover)" }}>
          <div className="text-[14px] font-semibold mb-1" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Desbloquea VeChat Plus</div>
          <div className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>Mensajes ilimitados y respuestas más rápidas, hechas para Venezuela.</div>
        </div>
      )}

      {/* Selector de plan */}
      <div className="flex gap-2 px-1 pb-3">
        <button onClick={() => setPrice("week")} className="relative flex-1 rounded-[13px] p-3 text-left" style={{ backgroundColor: "var(--surface-hover)" }}>
          {price === "week" && <span className="absolute inset-0 rounded-[13px]" style={{ border: "2px solid var(--primary)" }} />}
          <div className="relative text-[11.5px] font-medium mb-0.5" style={{ color: "var(--text-secondary)" }}>Semanal</div>
          <div className="relative text-[20px] font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>${priceWeek}</div>
        </button>
        <button onClick={() => setPrice("month")} className="relative flex-1 rounded-[13px] p-3 text-left" style={{ backgroundColor: "var(--surface-hover)" }}>
          {price === "month" && <span className="absolute inset-0 rounded-[13px]" style={{ border: "2px solid var(--primary)" }} />}
          <span className="absolute top-2.5 right-2.5 text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md"
            style={{ color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)" }}>Mejor precio</span>
          <div className="relative text-[11.5px] font-medium mb-0.5" style={{ color: "var(--text-secondary)" }}>Mensual</div>
          <div className="relative text-[20px] font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>${priceMonth}</div>
        </button>
      </div>

      <div className="text-[9.5px] font-semibold uppercase tracking-wider mx-2 mb-1.5" style={{ color: "var(--text-tertiary)" }}>Métodos de pago</div>
      <div className="px-1 pb-1">
        {methods.map((m) => (
          <div key={m.id}>
            {m.href ? (
              <a href={m.href} target="_blank" rel="noopener noreferrer" className="mp-row flex items-center gap-2.5 w-full p-2 rounded-[11px] text-left">
                <MethodIcon>{m.icon}</MethodIcon>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                  <span className="block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{m.sub}</span>
                </span>
                <Caret />
              </a>
            ) : (
              <button onClick={() => setOpenMethod(openMethod === m.id ? null : m.id)} className="mp-row flex items-center gap-2.5 w-full p-2 rounded-[11px] text-left">
                <MethodIcon>{m.icon}</MethodIcon>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium" style={{ color: "var(--text-primary)" }}>{m.label}</span>
                  <span className="block text-[11.5px]" style={{ color: "var(--text-tertiary)" }}>{m.sub}</span>
                </span>
                <Caret />
              </button>
            )}
            {openMethod === m.id && !m.href && (
              <div className="flex items-center gap-2 mx-2 mb-1.5 mt-0.5 px-3 py-2 rounded-[10px]" style={{ backgroundColor: "var(--surface-hover)" }}>
                <span className="flex-1 min-w-0 text-[11.5px] break-words" style={{ color: "var(--text-primary)" }}>{m.detail}</span>
                <button onClick={() => copy(m.id, m.detail)} className="shrink-0 text-[11px] font-semibold" style={{ color: copied === m.id ? "var(--primary)" : "var(--text-tertiary)" }}>
                  {copied === m.id ? "Copiado" : "Copiar"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="px-2 pb-1 pt-1">
        <span className="text-[10.5px]" style={{ color: "var(--warning)" }}>Datos de ejemplo — pendientes de configurar.</span>
      </div>
    </div>
  );
}

function MethodIcon({ children }: { children: ReactNode }) {
  return (
    <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
      style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--primary)" }}>
      {children}
    </span>
  );
}

// ============================ COUPON VIEW ============================
function CouponView({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function apply() {
    if (!code.trim() || loading) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/coupons/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.error) { setError(data.error); setLoading(false); return; }
      const added = data.weeks_added;
      setSuccess(added ? `+${added} días añadidos` : "Cupón aplicado");
      setCode("");
      setTimeout(() => { onClose(); window.location.reload(); }, 1800);
    } catch {
      setError("Error al aplicar. Intenta de nuevo.");
    }
    setLoading(false);
  }

  return (
    <div className="mp-view">
      <div className="flex items-center gap-2 px-1.5 pt-1 pb-3">
        <button onClick={onBack} className="mp-row w-[34px] h-[34px] rounded-[10px] flex items-center justify-center shrink-0">
          <svg className="w-4 h-4" style={{ color: "var(--text-primary)" }} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-[16px] font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Añadir cupón</span>
      </div>
      <div className="px-2 pb-2">
        <div className="text-[13px] leading-normal mb-3" style={{ color: "var(--text-secondary)" }}>¿Tienes un código? Canjéalo para activar tu beneficio.</div>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } }}
            placeholder="MLF-XXXXXX"
            className="flex-1 h-11 rounded-[12px] px-3.5 text-[14px] font-semibold tracking-wider uppercase outline-none"
            style={{ backgroundColor: "var(--surface-hover)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
          />
          <button onClick={apply} disabled={loading || !code.trim()}
            className="h-11 px-4 rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--primary)" }}>
            {loading ? "…" : "Canjear"}
          </button>
        </div>
        {error && <div className="text-[12px] mt-2.5" style={{ color: "var(--danger)" }}>{error}</div>}
        {success && <div className="text-[12px] mt-2.5 font-medium" style={{ color: "var(--primary)" }}>{success}</div>}
      </div>
    </div>
  );
}
