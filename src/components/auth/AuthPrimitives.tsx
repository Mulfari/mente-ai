"use client";

import { useState } from "react";

// Primitivas del login/registro headless de VeChat. Inputs nativos (en el bundle
// → render instantáneo, sin el delay del componente <SignIn> de Clerk). Estilo
// con tokens de marca (var(--…)) → funcionan en claro y oscuro. Sin deps nuevas.

const FOCUS_RING = "0 0 0 3px color-mix(in srgb, var(--primary) 26%, transparent)";

/** Recarga COMPLETA al destino (solo rutas relativas, anti open-redirect) → el
 *  server resuelve el perfil. Reemplaza el router.push de la referencia VeLocal. */
export function reloadToDest() {
  const r = new URLSearchParams(window.location.search).get("redirect_url");
  window.location.assign(r && r.startsWith("/") ? r : "/");
}

export function OrDivider({ label = "o con tu correo" }: { label?: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
      <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <div className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35 26.8 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.3 5.3C41.4 36.3 44 30.7 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export function GoogleButton({ onClick, disabled, label = "Continuar con Google" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 text-[15px] font-semibold transition-all hover:brightness-[0.98] active:scale-[0.99] disabled:opacity-50"
      style={{ height: 48, borderRadius: 12, border: "1px solid var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}>
      <GoogleG /> {label}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity=".3" strokeWidth="2.5" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={loading}
      className="flex w-full cursor-pointer items-center justify-center gap-2 text-[15px] font-semibold text-white transition-all hover:brightness-[1.05] active:scale-[0.99] disabled:opacity-60"
      style={{ height: 50, borderRadius: 12, background: "var(--primary)" }}>
      {loading ? (<><Spinner /> Cargando…</>) : children}
    </button>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg px-3 py-2 text-[13px] font-medium"
      style={{ color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, transparent)" }}>
      {message}
    </p>
  );
}

function Eye({ off }: { off?: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {off ? (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M1 1l22 22" />
        </>
      ) : (
        <>
          <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

export function AuthInput({ id, label, type = "text", placeholder, value, onChange, autoComplete, autoFocus, required = true }: {
  id: string; label: string; type?: string; placeholder?: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; autoFocus?: boolean; required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{label}</label>
      <div className="relative">
        <input
          id={id} name={id} type={inputType} required={required} autoFocus={autoFocus}
          autoComplete={autoComplete} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => { e.currentTarget.style.boxShadow = FOCUS_RING; e.currentTarget.style.borderColor = "var(--primary)"; }}
          onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--border)"; }}
          className={`w-full text-[15px] outline-none transition-shadow ${isPassword ? "pr-11" : "pr-4"}`}
          style={{ height: 48, borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-primary)", paddingLeft: 14 }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-black/[.04]"
            style={{ color: "var(--text-secondary)" }}>
            <Eye off={show} />
          </button>
        )}
      </div>
    </div>
  );
}
