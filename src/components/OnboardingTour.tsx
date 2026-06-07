"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Step = "welcome" | "city" | "capabilities";

const STEP_ORDER: Step[] = ["welcome", "city", "capabilities"];

const CITIES = [
  "Maracay",
  "Caracas",
  "Valencia",
  "Barquisimeto",
  "Maracaibo",
  "Mérida",
  "Cumaná",
  "Puerto La Cruz",
];

const STORAGE_KEY = "mulfai_tour_v2_seen";

export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("welcome");
  const [name, setName] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [customCity, setCustomCity] = useState("");
  const [showCustomCity, setShowCustomCity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animKey, setAnimKey] = useState(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const customCityRef = useRef<HTMLInputElement | null>(null);

  const currentIdx = STEP_ORDER.indexOf(step);

  // Persist "seen" and reset internal state whenever the tour is opened
  useEffect(() => {
    if (open) {
      setStep("welcome");
      setName("");
      setCity(null);
      setCustomCity("");
      setShowCustomCity(false);
      setDirection("forward");
      setAnimKey((k) => k + 1);
    }
  }, [open]);

  // Focus first interactive element when entering a step
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (step === "welcome") nameInputRef.current?.focus();
      if (step === "city" && showCustomCity) customCityRef.current?.focus();
    }, 220);
    return () => clearTimeout(t);
  }, [step, open, showCustomCity]);

  // Mark as seen the moment the modal opens, so it doesn't re-appear
  useEffect(() => {
    if (open) {
      try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}
    }
  }, [open]);

  const finish = useCallback(
    async (data: { full_name: string; city: string }) => {
      if (!data.full_name && !data.city) {
        onClose();
        return;
      }
      setSubmitting(true);
      try {
        await fetch("/api/user-context/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch (err) {
        console.error("[OnboardingTour] save failed:", err);
      } finally {
        setSubmitting(false);
        onClose();
      }
    },
    [onClose]
  );

  const advance = useCallback(() => {
    if (submitting) return;
    if (currentIdx < STEP_ORDER.length - 1) {
      setDirection("forward");
      setStep(STEP_ORDER[currentIdx + 1]);
    } else {
      finish({ full_name: name.trim(), city: (city || customCity).trim() });
    }
  }, [currentIdx, name, city, customCity, finish, submitting]);

  const back = useCallback(() => {
    if (submitting) return;
    if (currentIdx > 0) {
      setDirection("back");
      setStep(STEP_ORDER[currentIdx - 1]);
    }
  }, [currentIdx, submitting]);

  const skip = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [onClose, submitting]);

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); skip(); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "TEXTAREA") return;
        e.preventDefault();
        advance();
      }
      if (e.key === "ArrowRight") { e.preventDefault(); advance(); }
      if (e.key === "ArrowLeft" && currentIdx > 0) { e.preventDefault(); back(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, advance, back, skip, currentIdx]);

  if (!open) return null;

  const canAdvance =
    step === "welcome" ? true : // name is optional
    step === "city" ? !!(city || customCity.trim() || showCustomCity === false) : // always allowed (skip = valid)
    true;

  const primaryLabel =
    step === "welcome" ? "Empezar" :
    step === "city" ? "Continuar" :
    "Empezar a chatear";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.78)", backdropFilter: "blur(14px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) skip(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 25px 50px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header gradient bar */}
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-sm">Tour rápido de VeChat</span>
          </div>
          <button
            onClick={skip}
            aria-label="Cerrar"
            className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step content — keyed for fresh animation on each transition */}
        <div
          key={animKey}
          className="px-6 py-7"
          style={{
            animation: `onb-in 320ms cubic-bezier(0.16, 1, 0.3, 1) ${direction === "back" ? "reverse" : "normal"}`,
          }}
        >
          {step === "welcome" && <WelcomeStep name={name} setName={setName} inputRef={nameInputRef} />}
          {step === "city" && (
            <CityStep
              city={city}
              setCity={setCity}
              customCity={customCity}
              setCustomCity={setCustomCity}
              showCustomCity={showCustomCity}
              setShowCustomCity={setShowCustomCity}
              customCityRef={customCityRef}
            />
          )}
          {step === "capabilities" && <CapabilitiesStep />}
        </div>

        {/* Footer: progress + nav */}
        <div className="px-6 pb-5 pt-1 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {STEP_ORDER.map((s, i) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === currentIdx ? 22 : 6,
                  backgroundColor: i === currentIdx ? "var(--primary)" : "var(--border)",
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {currentIdx > 0 ? (
              <button
                onClick={back}
                className="h-9 px-3 rounded-xl text-xs font-medium transition-all hover:opacity-80 active:scale-95"
                style={{ color: "var(--text-tertiary)", backgroundColor: "var(--background)" }}
              >
                ← Atrás
              </button>
            ) : null}
            <button
              onClick={advance}
              disabled={!canAdvance || submitting}
              className="h-9 px-5 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}
            >
              {submitting ? (
                <>
                  <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Guardando…
                </>
              ) : (
                <>
                  {primaryLabel}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Skip link */}
        <div className="px-6 pb-5 -mt-1">
          <button
            onClick={skip}
            className="text-[11px] hover:underline w-full text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            Prefiero no decir, saltar
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({
  name,
  setName,
  inputRef,
}: {
  name: string;
  setName: (v: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))",
          }}
        >
          <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            ¡Hola! Soy VeChat
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Tu asistente para encontrar respuestas y servicios.
          </p>
        </div>
      </div>

      <p className="text-[13px] mb-1.5" style={{ color: "var(--text-primary)" }}>
        ¿Cómo te llamas?
      </p>
      <p className="text-[11px] mb-3" style={{ color: "var(--text-tertiary)" }}>
        Lo uso para que el chat se sienta más cercano.
      </p>
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Tu nombre"
        maxLength={60}
        className="w-full h-11 px-4 rounded-xl text-sm outline-none transition-all"
        style={{
          backgroundColor: "var(--background)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
      />
    </div>
  );
}

function CityStep({
  city,
  setCity,
  customCity,
  setCustomCity,
  showCustomCity,
  setShowCustomCity,
  customCityRef,
}: {
  city: string | null;
  setCity: (v: string | null) => void;
  customCity: string;
  setCustomCity: (v: string) => void;
  showCustomCity: boolean;
  setShowCustomCity: (v: boolean) => void;
  customCityRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))",
          }}
        >
          <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            ¿Dónde estás?
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Para mostrarte cosas cerca tuyo.
          </p>
        </div>
      </div>

      <p className="text-[11px] mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 8%, transparent)", color: "var(--text-primary)" }}>
        🔒 No compartimos tu ubicación con nadie.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {CITIES.map((c) => {
          const selected = city === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                setCity(c);
                setShowCustomCity(false);
                setCustomCity("");
              }}
              className="h-11 px-3 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] flex items-center justify-between gap-2"
              style={{
                backgroundColor: selected ? "var(--primary)" : "var(--background)",
                color: selected ? "white" : "var(--text-primary)",
                border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
              }}
            >
              <span className="truncate">{c}</span>
              {selected ? (
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              ) : null}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setCity(null);
            setShowCustomCity(true);
            setTimeout(() => customCityRef.current?.focus(), 50);
          }}
          className="h-11 px-3 rounded-xl text-[13px] font-medium transition-all active:scale-[0.97] col-span-2"
          style={{
            backgroundColor: showCustomCity ? "var(--primary)" : "var(--background)",
            color: showCustomCity ? "white" : "var(--text-primary)",
            border: `1px solid ${showCustomCity ? "var(--primary)" : "var(--border)"}`,
          }}
        >
          Otra ciudad…
        </button>
      </div>

      {showCustomCity ? (
        <input
          ref={customCityRef}
          type="text"
          value={customCity}
          onChange={(e) => setCustomCity(e.target.value)}
          placeholder="Escribe tu ciudad"
          maxLength={60}
          className="w-full h-11 px-4 rounded-xl text-sm outline-none mt-2 transition-all"
          style={{
            backgroundColor: "var(--background)",
            color: "var(--text-primary)",
            border: "1px solid var(--primary)",
          }}
        />
      ) : null}
    </div>
  );
}

function CapabilitiesStep() {
  const items = [
    {
      title: "Pregúntame lo que sea",
      sub: "Respondo casi cualquier cosa, en español.",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 0 1-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8Z" />
        </svg>
      ),
    },
    {
      title: "Envíame fotos",
      sub: "Analizo imágenes: documentos, pantallas, fotos, etc.",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>
      ),
    },
    {
      title: "Pídeme ideas y planes",
      sub: "Te ayudo a pensar: trabajo, estudio, proyectos.",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))",
          }}
        >
          <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          </svg>
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
            Listo para empezar
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
            Esto es lo que puedo hacer por vos.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex items-start gap-3 p-3 rounded-xl"
            style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
              style={{
                background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))",
                color: "var(--primary)",
              }}
            >
              {it.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                {it.title}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                {it.sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
