"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  email: string;
  profile: {
    subscription_weeks?: number;
    subscription_start?: string;
    subscription_end?: string;
  } | null;
  onSignOut: () => void;
  onClose: () => void;
  onProfileUpdate?: (updates: Partial<Props["profile"]>) => void;
};

type Tab = "context" | "subscription" | "coupon";

const VENEZUELAN_CITIES = [
  "Caracas", "Maracay", "Valencia", "Barquisimeto", "Maracaibo",
  "Ciudad Bolívar", "Mérida", "San Cristóbal", "Barinas", "Cumaná",
  "Puerto La Cruz", "Guarenas", "Acarigua", "Ciudad Ojeda", "Guatire",
];

const MAX_CHARS = 2000;

export default function AccountMenu({ email, profile, onSignOut, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("context");
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const _ = tick;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex animate-fade-in"
        style={{ backgroundColor: "var(--surface)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)" }}>

        {/* Left sidebar */}
        <div className="w-14 sm:w-56 shrink-0 flex flex-col py-6"
          style={{ backgroundColor: "var(--background)", borderRight: "1px solid var(--border)" }}>

          {/* Header */}
          <div className="px-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mulfai</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
              style={{ backgroundColor: "var(--surface)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                {email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            {([
              { id: "context" as Tab, label: "Mi contexto", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )},
              { id: "subscription" as Tab, label: "Suscripcion", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { id: "coupon" as Tab, label: "Anadir cupon", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              )},
            ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: tab === id ? "var(--surface)" : "transparent",
                  color: tab === id ? "var(--primary)" : "var(--text-secondary)",
                  boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                }}>
                <span style={{ color: tab === id ? "var(--primary)" : "var(--text-tertiary)" }}>{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* Sign out */}
          <div className="px-3 mt-2">
            <button onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: "var(--danger)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Cerrar sesion
            </button>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-5 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                {tab === "context" ? "Mi contexto" : tab === "subscription" ? "Suscripcion" : "Anadir cupon"}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {tab === "context" ? "Personaliza tu experiencia de chat" :
                 tab === "subscription" ? "Gestiona tu suscripcion" :
                 "Introduce un codigo de cupon"}
              </p>
            </div>
            <button onClick={onClose}
              className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-tertiary)" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {tab === "context" ? <ContextTab email={email} /> :
             tab === "subscription" ? <SubscriptionTab profile={profile} tick={tick} /> :
             <CouponTab email={email} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Context Tab ---
function ContextTab({ email }: { email: string }) {
  const [data, setData] = useState({ full_name: "", city: "", interests: "", custom_notes: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.from("user_context").select("full_name, city, interests, custom_notes").maybeSingle()
      .then(({ data: d }) => {
        setLoading(false);
        if (d) setData({ full_name: d.full_name || "", city: d.city || "", interests: d.interests || "", custom_notes: d.custom_notes || "" });
      });
  }, []);

  const total = data.full_name.length + data.city.length + data.interests.length + data.custom_notes.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (total > MAX_CHARS) { setError(`Maximo ${MAX_CHARS} caracteres`); return; }
    setSaving(true); setError(""); setSaved(false);
    const { error: err } = await supabase.from("user_context").upsert({
      full_name: data.full_name.trim(), city: data.city.trim(),
      interests: data.interests.trim(), custom_notes: data.custom_notes.trim(),
    }, { onConflict: "user_id" });
    setSaving(false);
    if (err) setError("Error al guardar.");
    else { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  }

  if (loading) return <LoadingState />;

  return (
    <form onSubmit={handleSave} className="p-6 space-y-5">
      <div className="p-4 rounded-xl flex items-start gap-3"
        style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, var(--background))", border: "1px solid color-mix(in srgb, var(--primary) 15%, var(--border))" }}>
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-xs font-medium" style={{ color: "var(--primary)" }}>Mejora tus respuestas</p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            El asistente usara esta informacion para darte respuestas mas personalizadas.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Tu nombre</label>
          <input type="text" value={data.full_name} onChange={e => setData(d => ({ ...d, full_name: e.target.value }))}
            placeholder="Ej: Juan Perez" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Ciudad</label>
          <select value={data.city} onChange={e => setData(d => ({ ...d, city: e.target.value }))}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none appearance-none"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: data.city ? "var(--text-primary)" : "var(--text-tertiary)" }}>
            <option value="">Selecciona tu ciudad</option>
            {VENEZUELAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Intereses</label>
          <input type="text" value={data.interests} onChange={e => setData(d => ({ ...d, interests: e.target.value }))}
            placeholder="gastronomia, tecnologia, deportes"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Separados por coma</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Notas personalizadas</label>
            <span className="text-xs" style={{ color: total > MAX_CHARS ? "var(--danger)" : "var(--text-tertiary)" }}>
              {total}/{MAX_CHARS}
            </span>
          </div>
          <textarea value={data.custom_notes} onChange={e => setData(d => ({ ...d, custom_notes: e.target.value }))}
            placeholder="Ej: soy estudiante de ingenieria, me gusta la fotografia..."
            rows={4}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {saved && <SuccessBanner message="Guardado correctamente" />}

      <button type="submit" disabled={saving || total > MAX_CHARS}
        className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90"
        style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
        {saving ? "Guardando..." : "Guardar contexto"}
      </button>
    </form>
  );
}

// --- Subscription Tab ---
function SubscriptionTab({ profile, tick }: { profile: Props["profile"]; tick: number }) {
  const weeks = profile?.subscription_weeks ?? 0;
  const isUnlimited = weeks < 0;
  const isActive = profile && (weeks > 0 || isUnlimited);

  function getStatusColor() {
    if (isUnlimited) return { bg: "rgba(139,92,246,0.15)", color: "#8b5cf6" };
    if (!profile || weeks <= 0) return { bg: "rgba(239,68,68,0.15)", color: "var(--danger)" };
    const diff = profile.subscription_end ? new Date(profile.subscription_end).getTime() - Date.now() : 0;
    if (diff <= 0) return { bg: "rgba(239,68,68,0.15)", color: "var(--danger)" };
    if (diff < 3 * 24 * 60 * 60 * 1000) return { bg: "rgba(245,158,11,0.15)", color: "var(--warning)" };
    return { bg: "rgba(16,163,127,0.15)", color: "var(--primary)" };
  }

  function getCountdown() {
    if (isUnlimited) return null;
    if (!profile || weeks <= 0 || !profile.subscription_end) return null;
    const diff = new Date(profile.subscription_end).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const total = Math.floor(diff / 1000);
    return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, expired: false };
  }

  const sc = getStatusColor();
  const cd = getCountdown();

  return (
    <div className="p-6 space-y-5">
      {/* Status card */}
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg, color: sc.color }}>
            {isUnlimited ? <span className="text-lg font-bold">∞</span> : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Estado</p>
            <p className="text-sm font-semibold" style={{ color: sc.color }}>
              {isUnlimited ? "Ilimitado" : isActive ? "Activa" : cd?.expired ? "Expirada" : "Inactiva"}
            </p>
          </div>
        </div>

        {isUnlimited ? (
          <div className="text-center py-4">
            <span className="text-4xl font-bold" style={{ color: "#8b5cf6" }}>∞</span>
            <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>Acceso ilimitado</p>
          </div>
        ) : !cd || cd.expired ? (
          <div className="text-center py-4">
            <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Suscripcion expirada</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Anade tiempo con un cupon</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2 text-center">
            {([
              { value: cd.days, label: "dias" },
              { value: cd.hours, label: "hrs" },
              { value: cd.minutes, label: "min" },
              { value: cd.seconds, label: "seg" },
            ] as { value: number; label: string }[]).map(({ value, label }) => (
              <div key={label} className="rounded-xl py-3" style={{ backgroundColor: "var(--surface)" }}>
                <span className="text-xl font-bold block" style={{ color: sc.color }}>
                  {String(value).padStart(2, "0")}
                </span>
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="rounded-xl p-4" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
        <div className="space-y-2">
          {[
            { label: "Semanas restantes", value: weeks < 0 ? "Ilimitado" : `${weeks} semana${weeks !== 1 ? "s" : ""}` },
            { label: "Inicio", value: profile?.subscription_start ? new Date(profile.subscription_start).toLocaleDateString("es-VE") : "—" },
            { label: "Fin", value: profile?.subscription_end ? new Date(profile.subscription_end).toLocaleDateString("es-VE") : "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{label}</span>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Coupon Tab ---
function CouponTab({ email, onClose }: { email: string; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showAdded, setShowAdded] = useState<number | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true); setError(""); setSuccess("");
    const res = await fetch("/api/coupons/apply", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    const added = data.weeks_added;
    setShowAdded(added);
    setSuccess(added ? `+${added} dias anadidos` : "Cupo aplicado");
    setCode("");
    setTimeout(() => { onClose(); window.location.reload(); }, 2500);
  }

  return (
    <form onSubmit={handleApply} className="p-6 space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Codigo de cupon</label>
        <input type="text" value={code} onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="MLF-XXXXXX" className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all uppercase tracking-wider"
          style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
      </div>

      {error && <ErrorBanner message={error} />}
      {success && <SuccessBanner message={success} />}

      {showAdded && (
        <div className="flex items-center gap-3 p-4 rounded-xl animate-fade-in"
          style={{ backgroundColor: "rgba(16,163,127,0.12)", border: "1px solid rgba(16,163,127,0.25)" }}>
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--primary)" }}>+{showAdded} dias anadidos</p>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Tu suscripcion ha sido extendida</p>
          </div>
        </div>
      )}

      <button type="submit" disabled={loading || !code.trim()}
        className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90"
        style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
        {loading ? "Aplicando..." : "Aplicar cupon"}
      </button>
    </form>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--primary)" }} />
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Cargando...</p>
      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
      style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--danger)" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs" style={{ color: "var(--danger)" }}>{message}</span>
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
      style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.2)" }}>
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-xs" style={{ color: "var(--primary)" }}>{message}</span>
    </div>
  );
}
