# VeChat auth headless — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que `/sign-in` y `/sign-up` rendericen el formulario al instante (sin el delay del `<SignIn>/<SignUp>` de Clerk) usando la API headless Future, manteniendo el diseño `AuthShell`.

**Architecture:** Formularios propios (inputs nativos en el bundle) + hooks Future de Clerk (`useSignIn`/`useSignUp`) dentro del `AuthShell` actual. El modal de la app NO se toca. Patrón probado en VeLocal.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind v4, `@clerk/nextjs` 7.4.3 (API Future/Signals — verificada presente).

**Spec:** `docs/superpowers/specs/2026-06-19-vechat-auth-headless-design.md`

---

## Hechos verificados (no re-investigar)

- VeChat tiene `@clerk/nextjs` **7.4.3**; su `useSignIn`/`useSignUp` (main entry) **devuelven la API Future** (`useSignIn: () => SignInSignalValue`, con `signIn.create/finalize/sso/...`). El build confirma; **si fallara** que `finalize`/`sso` no existen, bumpear `@clerk/nextjs` a `^7.5.2` y `npm install` (VeChat NO usa hooks clásicos de auth, así que es seguro).
- **Firmas Future** (de `@clerk/shared/.../signInFuture.d.mts`), todas `=> Promise<{ error: ClerkError | null }>`:
  - `signIn.create({ identifier, password? })`, `signIn.finalize()`, `signIn.sso({ strategy, redirectUrl, redirectCallbackUrl })`, `signIn.status`.
  - `signIn.resetPasswordEmailCode.sendCode()` (usa el identifier ya seteado por un `create({ identifier })` previo), `.verifyCode({ code })` (→ status `needs_new_password`), `.submitPassword({ password })`.
  - `signUp.create({ emailAddress, password })`, `signUp.verifications.sendEmailCode()` / `.verifyEmailCode({ code })`, `signUp.finalize()`, `signUp.sso({...})`, `signUp.status`.
  - `useSignIn()`/`useSignUp()` devuelven `{ signIn }`/`{ signUp }` que **arrancan `null`** → guardar `if (!x) return` y `disabled={!x}`.
- **Delta VeChat:** post-login NO es `router.push`; es **recarga completa** a `?redirect_url=` (solo rutas relativas) o `/`, para que el server resuelva el perfil.
- **CAPTCHA:** `<div id="clerk-captcha" />` obligatorio en el form de signup.
- **No animar opacity** del contenedor del form (gotcha VeLocal: se queda invisible).
- **Sin dependencias nuevas:** SVG inline (sin phosphor), sin framer/motion.

## File Structure

- **Create** `src/components/auth/AuthPrimitives.tsx` — primitivas visuales (`AuthInput`, `GoogleButton`, `SubmitButton`, `ErrorMessage`, `OrDivider`) + `reloadToDest()`. Estilo con tokens VeChat (var(--…)), funciona en claro y oscuro.
- **Rewrite** `src/app/sign-in/[[...sign-in]]/page.tsx` — login headless + sub-flujo de reset.
- **Rewrite** `src/app/sign-up/[[...sign-up]]/page.tsx` — registro headless 2 pasos + captcha.
- **Create** `src/app/sso-callback/page.tsx` — callback de OAuth → `/`.
- **Verify** `src/proxy.ts` — que `/sso-callback` sea ruta pública (alcanzable sin sesión).

---

## Task 1: Primitivas visuales `AuthPrimitives.tsx`

**Files:** Create `src/components/auth/AuthPrimitives.tsx`

- [ ] **Step 1: Escribir el archivo completo**

```tsx
"use client";

import { useState } from "react";

const FOCUS_RING = "0 0 0 3px color-mix(in srgb, var(--primary) 26%, transparent)";

/** Recarga COMPLETA al destino (rutas relativas seguras) → el server resuelve el
 *  perfil. Reemplaza el router.push de VeLocal. */
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

export function GoogleButton({ onClick, disabled, label = "Continuar con Google" }: { onClick: () => void; disabled?: boolean; label?: string; }) {
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

export function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode; }) {
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
      {off
        ? (<><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" /><path d="M1 1l22 22" /></>)
        : (<><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8z" /><circle cx="12" cy="12" r="3" /></>)}
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
```

- [ ] **Step 2: Build**

Run: `npm run build`  · Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/AuthPrimitives.tsx
git commit -m "feat(auth): primitivas headless (input/google/submit/error/divider) con tokens VeChat"
```

---

## Task 2: `/sign-in` headless (correo/clave + Google + reset)

**Files:** Rewrite `src/app/sign-in/[[...sign-in]]/page.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { AuthInput, GoogleButton, SubmitButton, ErrorMessage, OrDivider, reloadToDest } from "@/components/auth/AuthPrimitives";

export default function SignInPage() {
  const { signIn } = useSignIn();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"signin" | "reset">("signin");
  const [resetStep, setResetStep] = useState<"request" | "code">("request");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signIn.create({ identifier: email, password });
      if (createErr) { setError(createErr.message ?? "Correo o contraseña incorrectos."); return; }
      if (signIn.status === "complete") {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo iniciar sesión."); return; }
        reloadToDest();
      } else setError("No se pudo iniciar sesión.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Correo o contraseña incorrectos.");
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    if (!signIn) return;
    await signIn.sso({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectCallbackUrl: "/" });
  }

  async function handleResetRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signIn.create({ identifier: email });
      if (createErr) { setError(createErr.message ?? "No encontramos esa cuenta."); return; }
      const { error: sendErr } = await signIn.resetPasswordEmailCode.sendCode();
      if (sendErr) { setError(sendErr.message ?? "No se pudo enviar el código."); return; }
      setResetStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el código.");
    } finally { setLoading(false); }
  }

  async function handleResetSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn) return;
    setLoading(true); setError("");
    try {
      const { error: verifyErr } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (verifyErr) { setError(verifyErr.message ?? "Código inválido."); return; }
      const { error: pwErr } = await signIn.resetPasswordEmailCode.submitPassword({ password: newPassword });
      if (pwErr) { setError(pwErr.message ?? "No se pudo cambiar la contraseña."); return; }
      if (signIn.status === "complete") {
        const { error: finalErr } = await signIn.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo entrar."); return; }
        reloadToDest();
      } else setError("No se pudo completar el cambio.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally { setLoading(false); }
  }

  if (view === "reset") {
    return (
      <AuthShell heading="Recupera tu cuenta" sub="Te enviamos un código para crear una clave nueva.">
        {resetStep === "request" ? (
          <form onSubmit={handleResetRequest} className="flex flex-col gap-4">
            <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
            <SubmitButton loading={loading}>Enviar código</SubmitButton>
            <ErrorMessage message={error} />
          </form>
        ) : (
          <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
            <AuthInput id="code" label="Código" type="text" placeholder="123456" value={code} onChange={setCode} autoComplete="one-time-code" autoFocus />
            <AuthInput id="newPassword" label="Nueva contraseña" type="password" placeholder="Mínimo 8 caracteres" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <SubmitButton loading={loading}>Cambiar contraseña</SubmitButton>
            <ErrorMessage message={error} />
          </form>
        )}
        <button type="button" onClick={() => { setView("signin"); setError(""); setResetStep("request"); }}
          className="mt-4 block w-full cursor-pointer text-center text-[13px] font-medium underline underline-offset-2"
          style={{ color: "var(--text-secondary)" }}>
          Volver a iniciar sesión
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Bienvenido de vuelta" sub="Entra y sigue conversando con lo de aquí.">
      <GoogleButton onClick={handleGoogle} disabled={!signIn} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <AuthInput id="password" label="Contraseña" type="password" placeholder="Tu contraseña" value={password} onChange={setPassword} autoComplete="current-password" />
        <button type="button" onClick={() => { setView("reset"); setError(""); }}
          className="-mt-1 cursor-pointer self-end text-[12.5px] font-medium" style={{ color: "var(--primary)" }}>
          ¿Olvidaste tu contraseña?
        </button>
        <SubmitButton loading={loading}>Iniciar sesión</SubmitButton>
        <ErrorMessage message={error} />
      </form>
      <p className="mt-5 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
        ¿No tienes cuenta? <a href="/sign-up" className="font-medium underline underline-offset-2" style={{ color: "var(--primary)" }}>Crear cuenta</a>
      </p>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Build** — `npm run build`. Expected: `✓ Compiled successfully`. (Esto también confirma que la API Future existe en 7.4.3. Si falla con que `finalize`/`sso`/`resetPasswordEmailCode` no existen → bumpear `@clerk/nextjs` a `^7.5.2`, `npm install`, rebuild.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/sign-in/[[...sign-in]]/page.tsx"
git commit -m "feat(auth): /sign-in headless (correo, Google, reset de contrasena) sin delay de Clerk"
```

---

## Task 3: `/sign-up` headless (2 pasos + CAPTCHA + Google)

**Files:** Rewrite `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: Reemplazar el archivo completo**

```tsx
"use client";

import { useState } from "react";
import { useSignUp } from "@clerk/nextjs";
import AuthShell from "@/components/auth/AuthShell";
import { AuthInput, GoogleButton, SubmitButton, ErrorMessage, OrDivider, reloadToDest } from "@/components/auth/AuthPrimitives";

export default function SignUpPage() {
  const { signUp } = useSignUp();
  const [step, setStep] = useState<"form" | "verify">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true); setError("");
    try {
      const { error: createErr } = await signUp.create({ emailAddress: email, password });
      if (createErr) { setError(createErr.message ?? "No se pudo crear la cuenta."); return; }
      const { error: sendErr } = await signUp.verifications.sendEmailCode();
      if (sendErr) { setError(sendErr.message ?? "No se pudo enviar el código."); return; }
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true); setError("");
    try {
      const { error: verifyErr } = await signUp.verifications.verifyEmailCode({ code });
      if (verifyErr) { setError(verifyErr.message ?? "Código inválido."); return; }
      if (signUp.status === "complete") {
        const { error: finalErr } = await signUp.finalize();
        if (finalErr) { setError(finalErr.message ?? "No se pudo completar el registro."); return; }
        reloadToDest();
      } else setError("Código inválido.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Código inválido.");
    } finally { setLoading(false); }
  }

  async function handleResend() {
    if (!signUp) return;
    setError("");
    const { error: resendErr } = await signUp.verifications.sendEmailCode();
    if (resendErr) setError(resendErr.message ?? "No se pudo reenviar el código.");
  }

  async function handleGoogle() {
    if (!signUp) return;
    await signUp.sso({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectCallbackUrl: "/" });
  }

  if (step === "verify") {
    return (
      <AuthShell heading="Verifica tu correo" sub={`Enviamos un código a ${email}.`}>
        <form onSubmit={handleVerify} className="flex flex-col gap-4">
          <AuthInput id="code" label="Código de verificación" type="text" placeholder="123456" value={code} onChange={setCode} autoComplete="one-time-code" autoFocus />
          <SubmitButton loading={loading}>Verificar</SubmitButton>
          <ErrorMessage message={error} />
        </form>
        <button type="button" onClick={handleResend}
          className="mt-4 block w-full cursor-pointer text-center text-[13px] font-medium underline underline-offset-2"
          style={{ color: "var(--primary)" }}>
          Reenviar código
        </button>
      </AuthShell>
    );
  }

  return (
    <AuthShell heading="Crea tu cuenta" sub="Gratis para empezar — en 10 segundos, sin tarjeta.">
      <GoogleButton onClick={handleGoogle} disabled={!signUp} />
      <OrDivider />
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthInput id="email" label="Correo" type="email" placeholder="tu@correo.com" value={email} onChange={setEmail} autoComplete="email" autoFocus />
        <AuthInput id="password" label="Contraseña" type="password" placeholder="Mínimo 8 caracteres" value={password} onChange={setPassword} autoComplete="new-password" />
        {/* Clerk monta su Smart CAPTCHA aquí. Sin este div, los registros headless se bloquean. */}
        <div id="clerk-captcha" />
        <SubmitButton loading={loading}>Crear cuenta</SubmitButton>
        <ErrorMessage message={error} />
      </form>
      <p className="mt-5 text-center text-[13px]" style={{ color: "var(--text-secondary)" }}>
        ¿Ya tienes cuenta? <a href="/sign-in" className="font-medium underline underline-offset-2" style={{ color: "var(--primary)" }}>Iniciar sesión</a>
      </p>
    </AuthShell>
  );
}
```

- [ ] **Step 2: Build** — `npm run build`. Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/sign-up/[[...sign-up]]/page.tsx"
git commit -m "feat(auth): /sign-up headless (2 pasos + codigo + CAPTCHA + Google) sin delay"
```

---

## Task 4: Ruta `/sso-callback` + ruta pública

**Files:** Create `src/app/sso-callback/page.tsx`; Verify `src/proxy.ts`

- [ ] **Step 1: Crear el callback**

```tsx
"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" style={{ background: "var(--background)" }}>
      <p className="text-[14px] font-medium" style={{ color: "var(--text-secondary)" }}>Entrando…</p>
      <AuthenticateWithRedirectCallback signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />
    </div>
  );
}
```

- [ ] **Step 2: Verificar que `/sso-callback` sea pública en el middleware**

Leer `src/proxy.ts`. Si usa una lista de rutas públicas (`createRouteMatcher`), **agregar `/sso-callback`** (y confirmar que `/sign-in`/`/sign-up` ya están). Si el middleware solo protege rutas específicas (todo lo demás público), no hay cambio — pero verificarlo. El callback DEBE ser alcanzable sin sesión.

- [ ] **Step 3: Build** — `npm run build`. Expected: `✓ Compiled successfully`.

- [ ] **Step 4: Commit**

```bash
git add src/app/sso-callback/page.tsx src/proxy.ts
git commit -m "feat(auth): ruta /sso-callback para el OAuth headless (Google) + ruta publica"
```

---

## Task 5: Build final, merge a main y E2E en producción

> OJO: Clerk está **domain-locked a producción** → la auth NO funciona en previews. El E2E real es en prod tras el merge. Red de seguridad: las páginas son fallback (el **modal** sigue intacto) y se puede **revertir** al instante.

- [ ] **Step 1:** `npm run build` en `main` tras mergear la rama. Expected: verde.
- [ ] **Step 2:** push a `main` (deploy). Esperar READY en Vercel.
- [ ] **Step 3: E2E en prod** (https://www.mulfai.com.ve):
  - `/sign-up` (incógnito): el formulario **aparece al instante** (sin "render por etapas"); registrar un correo nuevo → llega código → verificar → CAPTCHA no bloquea → entra y el server resuelve el perfil (no queda en limbo).
  - `/sign-in`: login con ese correo → entra. "¿Olvidaste tu contraseña?" → código → nueva clave → entra.
  - Google en `/sign-in` y `/sign-up` → `/sso-callback` → `/` logueado.
  - Móvil: el split se ve bien, el form pinta al instante.
  - Regresión: el **modal** de la app (CTAs del chat) sigue funcionando.
- [ ] **Step 4 (si algo falla):** `git revert <merge>` + push → prod vuelve al `<SignIn>` anterior. Diagnosticar en rama.

---

## Self-review

- **Cobertura del spec:** primitivas (T1), sign-in + reset (T2), sign-up + captcha (T3), sso-callback + ruta pública (T4), build/merge/E2E + revert (T5), recarga post-login (`reloadToDest` en T1, usada en T2/T3). ✔
- **API verificada:** todas las firmas Future (`create/finalize/sso/resetPasswordEmailCode.{sendCode,verifyCode,submitPassword}/verifications.{sendEmailCode,verifyEmailCode}`) salen de los tipos instalados; guardas contra `null` y `disabled={!x}` presentes. ✔
- **Sin deps nuevas:** SVG inline (Google/Eye/Spinner), sin framer/phosphor; no se anima opacity. ✔
- **Consistencia:** las primitivas exportadas (`AuthInput/GoogleButton/SubmitButton/ErrorMessage/OrDivider/reloadToDest`) se importan igual en T2 y T3; `AuthShell` recibe `heading`/`sub` como hoy. ✔
- **No placeholders.** El único condicional honesto (bump a 7.5.2) está acotado a "si el build falla", con la acción exacta. ✔
