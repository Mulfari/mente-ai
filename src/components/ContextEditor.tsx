"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const MAX_CHARS = 2000;

const VENEZUELAN_CITIES = [
  "Caracas", "Maracay", "Valencia", "Barquisimeto", "Maracaibo",
  "Ciudad Bolívar", "Mérida", "San Cristóbal", "Barinas", "Cumaná",
  "Puerto La Cruz", "Guarenas", "Acarigua", "Ciudad Ojeda", "Guatire",
];

type Context = {
  id?: string;
  user_id?: string;
  full_name: string;
  city: string;
  interests: string;
  custom_notes: string;
  updated_at?: string;
};

export default function ContextEditor() {
  const [context, setContext] = useState<Context>({
    full_name: "",
    city: "",
    interests: "",
    custom_notes: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: authData }) => {
      const uid = authData?.user?.id;
      if (!uid) { router.push("/auth/login"); return; }
      setUserId(uid);

      supabase
        .from("user_context")
        .select("*")
        .eq("user_id", uid)
        .single()
        .then(({ data, error }) => {
          setLoading(false);
          if (data) {
            setContext({
              full_name: data.full_name || "",
              city: data.city || "",
              interests: data.interests || "",
              custom_notes: data.custom_notes || "",
            });
          }
          if (error && error.code !== "PGRST116") {
            setError("Error cargando contexto");
          }
        });
    });
  }, [supabase, router]);

  function totalChars() {
    return context.full_name.length + context.city.length + context.interests.length + context.custom_notes.length;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || totalChars() > MAX_CHARS) {
      if (!userId) setError("Cargando usuario...");
      if (totalChars() > MAX_CHARS) setError(`Máximo ${MAX_CHARS} caracteres permitidos`);
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);

    const payload = {
      user_id: userId,
      full_name: context.full_name.trim(),
      city: context.city.trim(),
      interests: context.interests.trim(),
      custom_notes: context.custom_notes.trim(),
    };

    const { error: updateError } = await supabase
      .from("user_context")
      .update(payload)
      .eq("user_id", userId);

    if (updateError) {
      if (updateError.code === "PGRST116") {
        // No row to update — insert it
        const { error: insertError } = await supabase
          .from("user_context")
          .insert(payload);
        setSaving(false);
        if (insertError) {
          setError("Error guardando. Intenta de nuevo.");
        } else {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }
      } else {
        setSaving(false);
        setError("Error guardando. Intenta de nuevo.");
      }
      return;
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full animate-spin" style={{ border: "2px solid var(--border)", borderTopColor: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14 shrink-0"
        style={{ backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.back()}
          className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]"
          style={{ color: "var(--text-secondary)" }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mi contexto</h1>
          <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Personaliza tu experiencia</p>
        </div>
        <div className="text-right">
          <span className={`text-xs font-medium ${totalChars() > MAX_CHARS ? "text-danger" : ""}`}
            style={{ color: totalChars() > MAX_CHARS ? "var(--danger)" : totalChars() > MAX_CHARS * 0.9 ? "var(--warning)" : "var(--text-tertiary)" }}>
            {totalChars()} / {MAX_CHARS}
          </span>
        </div>
      </header>

      {/* Form */}
      <form onSubmit={handleSave} className="flex-1 px-4 py-6 space-y-5 max-w-lg mx-auto w-full">
        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 rounded-xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, var(--surface))", border: "1px solid color-mix(in srgb, var(--primary) 20%, var(--border))" }}>
          <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
            style={{ color: "var(--primary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--primary)" }}>Mejora tus respuestas</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Este contexto le dice al asistente quién eres y dónde estás, para darte respuestas más relevantes.
            </p>
          </div>
        </div>

        {/* Full name */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            Tu nombre
          </label>
          <input type="text" value={context.full_name}
            onChange={e => setContext(c => ({ ...c, full_name: e.target.value }))}
            placeholder="Ej: Juan Pérez"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            Ciudad
          </label>
          <select value={context.city}
            onChange={e => setContext(c => ({ ...c, city: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all appearance-none cursor-pointer"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: context.city ? "var(--text-primary)" : "var(--text-tertiary)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}>
            <option value="">Selecciona tu ciudad</option>
            {VENEZUELAN_CITIES.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>

        {/* Interests */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            Intereses
          </label>
          <input type="text" value={context.interests}
            onChange={e => setContext(c => ({ ...c, interests: e.target.value }))}
            placeholder="Ej: tecnología, gastronomía, deportes"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
          <p className="text-xs mt-1.5" style={{ color: "var(--text-tertiary)" }}>
            Separa con comas: gastronomía, tecnología, deportes...
          </p>
        </div>

        {/* Custom notes */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>
            Notas personalizadas
          </label>
          <textarea value={context.custom_notes}
            onChange={e => setContext(c => ({ ...c, custom_notes: e.target.value }))}
            placeholder="Ej: Soy estudiante de ingeniería, me gusta la fotografía, tengo un perro..."
            rows={5}
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--primary)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              style={{ color: "var(--danger)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
          </div>
        )}

        {/* Saved */}
        {saved && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ backgroundColor: "rgba(16,163,127,0.1)", border: "1px solid rgba(16,163,127,0.2)" }}>
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
              style={{ color: "var(--primary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-xs" style={{ color: "var(--primary)" }}>Contexto guardado correctamente</span>
          </div>
        )}

        {/* Save button */}
        <button type="submit" disabled={saving || totalChars() > MAX_CHARS}
          className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Guardando...
            </span>
          ) : "Guardar contexto"}
        </button>
      </form>
    </div>
  );
}
