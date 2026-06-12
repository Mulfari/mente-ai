"use client";

import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { applyThemePreference, getThemePreference, type ThemePreference } from "@/lib/theme";

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
};

type Tab = "context" | "personalization" | "subscription" | "coupon";

const MAX_CHARS = 2000;

export default function AccountMenu({ userId, email, profile: profileProp, userContext, onSignOut, onClose, onSave }: Props) {
  const [tab, setTab] = useState<Tab>("context");
  const [tick, setTick] = useState(0);
  const [profile, setProfile] = useState(profileProp ?? null);
  const { signOut } = useClerk();

  // Always fetch fresh profile so it's never null
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((res) => {
        if (res.profile) setProfile(res.profile);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const _ = tick;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(17,24,39,0.45)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-[48rem] max-h-[78vh] rounded-2xl overflow-hidden flex animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>

        {/* Left sidebar */}
        <div className="w-14 sm:w-52 shrink-0 self-start sticky top-0 flex flex-col py-5 sm:py-6"
          style={{ backgroundColor: "var(--background)", borderRight: "1px solid var(--border)", height: "78vh" }}>

          {/* Header */}
          <div className="px-4 sm:px-5 mb-5 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <span className="text-xs sm:text-sm font-bold hidden sm:block" style={{ color: "var(--text-primary)" }}>VeChat</span>
            </div>
            <div className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-xl"
              style={{ backgroundColor: "var(--surface)" }}>
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                {email.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 hidden sm:block">
                <p className="text-[10px] sm:text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-3 space-y-1">
            {([
              { id: "context" as Tab, label: "Mi contexto", icon: (
                <svg className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              )},
              { id: "personalization" as Tab, label: "Personalizacion", icon: (
                <svg className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="4" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
                </svg>
              )},
              { id: "subscription" as Tab, label: "Suscripcion", icon: (
                <svg className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )},
              { id: "coupon" as Tab, label: "Anadir cupon", icon: (
                <svg className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              )},
            ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(({ id, label, icon }) => (
              <button key={id} onClick={() => setTab(id)}
                className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: tab === id ? "var(--surface)" : "transparent",
                  color: tab === id ? "var(--primary)" : "var(--text-secondary)",
                  boxShadow: tab === id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                }}>
                <span style={{ color: tab === id ? "var(--primary)" : "var(--text-tertiary)" }}>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Sign out */}
          <div className="px-2 sm:px-3 mt-2">
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ color: "var(--danger)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
              <svg className="w-[18px] h-[18px] sm:w-4 sm:h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Cerrar sesion</span>
            </button>
          </div>
        </div>

        {/* Right content */}
        <div className="flex-1 flex flex-col min-w-0" style={{ height: "78vh" }}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-6 sm:px-8 py-4 shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}>
            <div>
              <h2 className="text-base sm:text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                {tab === "context" ? "Mi contexto" :
                 tab === "personalization" ? "Personalizacion" :
                 tab === "subscription" ? "Suscripcion" : "Anadir cupon"}
              </h2>
              <p className="text-xs sm:text-sm mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {tab === "context" ? "Personaliza tu experiencia de chat" :
                 tab === "personalization" ? "Apariencia de la aplicacion" :
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
          <div className="flex-1 overflow-y-auto" style={{ height: "calc(78vh - 69px)" }}>
            {tab === "context" ? <ContextTab userId={userId} userContext={userContext} onSave={onSave} /> :
             tab === "personalization" ? <PersonalizationTab /> :
             tab === "subscription" ? <SubscriptionTab profile={profile} tick={tick} /> :
             <CouponTab email={email} onClose={onClose} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Personalization Tab ---
function PersonalizationTab() {
  const [pref, setPref] = useState<ThemePreference>("system");
  useEffect(() => {
    setPref(getThemePreference());
  }, []);

  const choose = (next: ThemePreference) => {
    setPref(next);
    applyThemePreference(next);
  };

  const OPTIONS: { id: ThemePreference; label: string; detail: string; icon: React.ReactNode }[] = [
    {
      id: "light",
      label: "Claro",
      detail: "Fondo blanco, ideal de día",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path strokeLinecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      id: "dark",
      label: "Oscuro",
      detail: "Los colores clásicos de VeChat",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      ),
    },
    {
      id: "system",
      label: "Sistema",
      detail: "Sigue la preferencia de tu dispositivo",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <rect x="2" y="4" width="20" height="13" rx="2" />
          <path strokeLinecap="round" d="M8 21h8m-4-4v4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 sm:p-8">
      <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Tema</p>
      <p className="text-xs mb-5" style={{ color: "var(--text-tertiary)" }}>
        Elige cómo se ve VeChat. Con &quot;Sistema&quot; cambia solo según tu dispositivo.
      </p>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        {OPTIONS.map((opt) => {
          const selected = pref === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => choose(opt.id)}
              aria-pressed={selected}
              className="text-left rounded-2xl p-4 transition-all"
              style={{
                backgroundColor: "var(--surface)",
                border: `2px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                boxShadow: selected ? "0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)" : "none",
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{
                  backgroundColor: selected
                    ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                    : "var(--surface-hover)",
                  color: selected ? "var(--primary)" : "var(--text-secondary)",
                }}
              >
                {opt.icon}
              </div>
              <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>
                {opt.label}
              </p>
              <p className="text-[11.5px] leading-snug" style={{ color: "var(--text-tertiary)" }}>
                {opt.detail}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// --- Context Tab ---
function ContextTab({ userId, userContext, onSave }: {
  userId: string;
  userContext: { full_name: string; city: string; custom_notes: string; interests: string } | null;
  onSave?: (data: { full_name: string; city: string; custom_notes: string; interests: string }) => void;
}) {
  const [data, setData] = useState(() => ({
    full_name: userContext?.full_name || "",
    city: userContext?.city || "",
    custom_notes: userContext?.custom_notes || "",
    interests: userContext?.interests || "",
  }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const total = data.full_name.length + data.city.length + data.custom_notes.length + data.interests.length;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    console.log("[AccountMenu] handleSave called, userId:", JSON.stringify(userId), "length:", userId?.length);
    if (total > MAX_CHARS) { setError(`Maximo ${MAX_CHARS} caracteres`); return; }
    setSaving(true); setError(""); setSaved(false);

    try {
      const res = await fetch("/api/user-context/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: data.full_name, city: data.city, custom_notes: data.custom_notes, interests: data.interests }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError("Error al guardar: " + (result.error || "Intenta de nuevo"));
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
        if (onSave) onSave({ full_name: data.full_name.trim(), city: data.city.trim(), custom_notes: data.custom_notes.trim(), interests: data.interests.trim() });
      }
    } catch (err) {
      setError("Error al guardar: Intenta de nuevo");
      console.error("[AccountMenu] handleSave fetch error:", err);
    }

    setSaving(false);
  }

  function handleUpdateClick() {
    if (!navigator.geolocation) return;
    if (data.city && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    doDetectCity();
  }

  function doDetectCity() {
    setShowConfirm(false);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const json = await res.json();
          const city = json.address?.city || json.address?.town || json.address?.village || json.address?.state || "";
          if (city) {
            setData(d => ({ ...d, city }));
            try {
              const apiRes = await fetch("/api/user-context/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ full_name: data.full_name, city, custom_notes: data.custom_notes, interests: data.interests }),
              });
              const apiJson = await apiRes.json();
              if (apiJson.error) console.error("[AccountMenu] doDetectCity API error:", apiJson.error);
            } catch (e) {
              console.error("[AccountMenu] doDetectCity fetch error:", e);
            }
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            if (onSave) onSave({ full_name: data.full_name, city: city.trim(), custom_notes: data.custom_notes, interests: data.interests });
          }
        } catch {
          // ignore
        } finally {
          setLocating(false);
        }
      },
      () => { setLocating(false); }
    );
  }

  return (
    <form onSubmit={handleSave} className="px-5 sm:px-8 py-6 space-y-5">
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
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Ubicacion</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-2.5 rounded-xl text-sm flex items-center gap-2"
              style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: data.city ? "var(--text-primary)" : "var(--text-tertiary)" }}>
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {data.city || "Sin configurar"}
            </div>
            <button type="button" onClick={handleUpdateClick} disabled={locating}
              className="px-3 py-2.5 rounded-xl text-xs font-medium shrink-0 transition-all disabled:opacity-50"
              style={{ backgroundColor: showConfirm ? "rgba(245,158,11,0.15)" : "var(--surface)", border: "1px solid var(--border)", color: showConfirm ? "var(--warning)" : "var(--text-secondary)" }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = showConfirm ? "rgba(245,158,11,0.15)" : "var(--surface)"; }}>
              {locating ? "..." : data.city ? "Actualizar" : "Detectar"}
            </button>
          </div>

          {showConfirm && (
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                Ya tienes: <strong style={{ color: "var(--text-primary)" }}>{data.city}</strong>. Sobrescribir?
              </p>
              <button type="button" onClick={doDetectCity}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                Si
              </button>
              <button type="button" onClick={() => setShowConfirm(false)}
                className="px-3 py-1 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                No
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-primary)" }}>Intereses</label>
          <input type="text" value={data.interests} onChange={e => setData(d => ({ ...d, interests: e.target.value }))}
            placeholder="Ej: programacion, musica, viajes, idiomas"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Lista los temas que te interesan, separados por comas.</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Notas personalizadas</label>
            <span className="text-xs" style={{ color: total > MAX_CHARS ? "var(--danger)" : "var(--text-tertiary)" }}>
              {total}/{MAX_CHARS}
            </span>
          </div>
          <textarea value={data.custom_notes} onChange={e => setData(d => ({ ...d, custom_notes: e.target.value }))}
            placeholder="Agrega contexto adicional sobre ti: hobbies, profesion, temas que te interesan, situaciones relevantes..."
            rows={6}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none transition-all"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }} />
          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Completa tu perfil para respuestas mas precisas. Limite: {MAX_CHARS} caracteres.</p>
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
  const weeks = (profile?.subscription_weeks ?? 0) || 0;
  const isUnlimited = weeks < 0;
  const isActive = profile && (weeks > 0 || isUnlimited);
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  function getEndTime() {
    if (!profile?.subscription_end) return 0;
    const s = profile.subscription_end;
    // Normalize: +00 or +00:00 -> Z so Date parses as UTC
    const normalized = s.replace(/([+-]\d{2}):?(\d{2})?$/, "Z").replace(" ", "T");
    return new Date(normalized).getTime();
  }

  function getStatusColor() {
    if (isUnlimited) return { bg: "rgba(139,92,246,0.15)", color: "#8b5cf6" };
    if (!profile || weeks == null || weeks <= 0) return { bg: "rgba(239,68,68,0.15)", color: "var(--danger)" };
    const diff = getEndTime() - Date.now();
    if (diff <= 0) return { bg: "rgba(239,68,68,0.15)", color: "var(--danger)" };
    if (diff < 3 * 24 * 60 * 60 * 1000) return { bg: "rgba(245,158,11,0.15)", color: "var(--warning)" };
    return { bg: "rgba(16,163,127,0.15)", color: "var(--primary)" };
  }

  function getCountdown() {
    if (isUnlimited) return null;
    if (!profile || weeks == null || weeks <= 0) return null;
    const endTime = getEndTime();
    if (!endTime) return null;
    const diff = endTime - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    const total = Math.floor(diff / 1000);
    return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60, expired: false };
  }

  function copyToClipboard(value: string, label: string) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  }

  const sc = getStatusColor();
  const cd = getCountdown();
  const isFreeUser = weeks === 0 && !profile?.subscription_start;

  return (
    <div className="px-5 sm:px-8 py-6 space-y-5">
      <div className="rounded-xl p-5" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
        <div className="flex items-center gap-3 mb-4">
          {(() => {
            const endTime = getEndTime();
            const now = Date.now();
            return (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: sc.bg, color: sc.color }}>
                  {isUnlimited ? <span className="text-lg font-bold">∞</span> : isFreeUser ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Estado</p>
                  <p className="text-sm font-semibold" style={{ color: sc.color }}>
                    {isUnlimited ? "Ilimitado" : isFreeUser ? "Plan gratis" : !endTime || (now >= endTime) ? "Expirada" : "Activa"}
                  </p>
                </div>
              </>
            );
          })()}
        </div>

        {isUnlimited ? (
          <div className="text-center py-4">
            <span className="text-4xl font-bold" style={{ color: "#8b5cf6" }}>∞</span>
            <p className="text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>Acceso ilimitado</p>
          </div>
        ) : isFreeUser ? (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Plan gratis</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>20 mensajes por hora. Sin tarjeta.</p>
            </div>
            <button
              onClick={() => setShowPaymentInfo((v) => !v)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)" }}
            >
              {showPaymentInfo ? "Ocultar metodos de pago" : "Upgrade a ilimitado"}
            </button>
          </div>
        ) : !cd || cd.expired ? (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-sm font-semibold" style={{ color: "var(--danger)" }}>Suscripcion expirada</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Renueva con un pago local o un cupon</p>
            </div>
            <button
              onClick={() => setShowPaymentInfo((v) => !v)}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:scale-[1.01]"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)" }}
            >
              {showPaymentInfo ? "Ocultar metodos de pago" : "Renueva ahora"}
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
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
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Finaliza</span>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                {(() => {
                  if (!profile?.subscription_end) return "—";
                  const s = profile.subscription_end;
                  const normalized = s.replace(/([+-]\d{2}):?(\d{2})?$/, "Z").replace(" ", "T");
                  const d = new Date(normalized);
                  if (isNaN(d.getTime())) return "—";
                  return d.toLocaleDateString("es-VE", { timeZone: "America/Caracas" });
                })()}
              </span>
            </div>
          </>
        )}
      </div>

      {showPaymentInfo && (
        <div className="rounded-xl p-5" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>Paga con metodo local</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
            Envianos el comprobante y activamos tu cuenta en menos de 24h.
          </p>
          <div className="space-y-2">
            <PaymentRow label="Pago Movil" detail="Banco: 0102 (Venezuela) · Tel: 0414-1234567 · CI: J12345678 · Titular: Mulfari C.A." copyable onCopy={copyToClipboard} copied={copied} />
            <PaymentRow label="Zelle" detail="pagos@mulfai.com.ve" copyable onCopy={copyToClipboard} copied={copied} />
            <PaymentRow label="Binance USDT (TRC20)" detail="TXyZ123abc456def789ghi" copyable onCopy={copyToClipboard} copied={copied} />
          </div>
          <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
            <a href="https://wa.me/584141234567?text=Hola%2C%20quiero%20activar%20mi%20cuenta%20VeChat" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs transition-colors hover:underline"
              style={{ color: "var(--primary)" }}>
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
              Contactanos por WhatsApp
            </a>
            <a href="mailto:pagos@mulfai.com.ve?subject=Comprobante%20VeChat"
              className="flex items-center gap-2 text-xs transition-colors hover:underline"
              style={{ color: "var(--primary)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              pagos@mulfai.com.ve
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentRow({ label, detail, copyable, onCopy, copied }: { label: string; detail: string; copyable?: boolean; onCopy?: (v: string, l: string) => void; copied?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>{label}</p>
        <p className="text-xs truncate" style={{ color: "var(--text-primary)" }}>{detail}</p>
      </div>
      {copyable && onCopy && (
        <button
          onClick={() => onCopy(detail, label)}
          className="shrink-0 p-1.5 rounded-lg transition-colors"
          style={{ color: copied === label ? "var(--primary)" : "var(--text-tertiary)" }}
          aria-label={`Copiar ${label}`}
        >
          {copied === label ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      )}
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
    <form onSubmit={handleApply} className="px-6 sm:px-8 py-6 space-y-5">
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
