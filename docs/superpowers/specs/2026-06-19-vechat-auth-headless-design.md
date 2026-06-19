# VeChat: login/registro headless (render instantáneo) — diseño

**Fecha:** 2026-06-19
**Estado:** diseño aprobado por Jose; pendiente plan de implementación.

## Problema

`/sign-in` y `/sign-up` usan el componente pre-armado de Clerk
(`<SignIn>/<SignUp>`). Esos componentes **no traen los inputs en el bundle**:
el navegador baja `clerk-js` (cientos de KB), lo inicializa y **recién entonces
monta los campos** → página → instante en blanco/spinner → aparecen los inputs.
El `preconnect` (ya hecho) adelanta la descarga, no el montaje; un skeleton solo
disimula. Lo único que lo elimina de raíz es ir **headless**.

## Objetivo

Que el formulario **pinte al instante con la página** (inputs en el bundle),
manteniendo el diseño actual y la seguridad. Patrón ya probado en VeLocal
(repo hermano, misma instancia Clerk de producción).

## Alcance

- Solo las páginas **`/sign-in`** y **`/sign-up`** + una ruta nueva
  **`/sso-callback`**.
- **Incluye reset de contraseña** (forgot password) — para que la página no deje
  sin salida a quien olvidó su clave.
- **El modal de auth de la app** (`openSignIn`/`openSignUp`, apariencia global)
  **NO se toca** — sigue con el componente de Clerk. Es el flujo principal y
  queda como red de seguridad.

## Arquitectura

- **`AuthShell` se mantiene** (split: `.formpane` izquierda + `.brandpane`
  derecha, verde de marca). El formulario headless vive donde hoy va `<SignIn>`
  (dentro de `.av-clerk` / `.formcard`). Se le pasan `heading`/`sub` por página.
- **Primitivas propias** en `src/components/auth/AuthPrimitives.tsx`: `AuthInput`
  (con ver/ocultar clave), `GoogleButton` (G a color, SVG inline), `SubmitButton`
  (con spinner), `ErrorMessage`, `OrDivider`. Estilizadas con tokens VeChat
  (verde `#10A37F`, papel cálido) — **no** la marca terracota de VeLocal.
  **Sin dependencias nuevas** (SVG inline; nada de phosphor-icons ni framer/motion).
- **Lógica headless** con la **API Signals/Future** de `@clerk/nextjs` v7
  (NO la clásica):
  - `useSignIn()` → `{ signIn }`; `useSignUp()` → `{ signUp }`. **Arrancan
    `null`** → guardar `if (!signIn) return;` y `disabled={!signIn}` en botones.
  - Métodos: `signIn.create({ identifier, password })` → `{ error }`;
    `signIn.finalize()` → `{ error }`; `signIn.sso({ strategy, redirectUrl,
    redirectCallbackUrl })`.
  - `signUp.create({ emailAddress, password })`;
    `signUp.verifications.sendEmailCode()` / `verifyEmailCode({ code })`;
    `signUp.finalize()`; `signUp.sso({ ... })`.
  - **NO usar** `setActive` / `authenticateWithRedirect` /
    `prepareEmailAddressVerification` (API clásica → rompe el build).
- **Gotchas heredados de VeLocal:** guardas contra `null`; **no animar la
  `opacity`** del contenedor del form (se congelaba cerca de 0 y dejaba el form
  invisible) — animar solo en Y o nada; el `<div id="clerk-captcha">` es
  obligatorio en signup.

## Flujos

1. **Sign-in (correo/clave):** `signIn.create({ identifier, password })` → si
   `signIn.status === "complete"` → `signIn.finalize()` → **recarga al destino**
   (ver Delta VeChat). Error → `ErrorMessage` con fallback español.
2. **Sign-in / Sign-up con Google:** `sso({ strategy: "oauth_google",
   redirectUrl: "/sso-callback", redirectCallbackUrl: <destino> })`.
3. **Sign-up:** `signUp.create({ emailAddress, password })` →
   `signUp.verifications.sendEmailCode()` → paso **"verify"** →
   `verifyEmailCode({ code })` → si `complete` → `finalize()` → recarga.
   `<div id="clerk-captcha" />` en el paso del formulario (sin él, los registros
   headless se bloquean). Botón "Reenviar código".
4. **Reset de contraseña** (sub-flujo dentro de `/sign-in`, link "¿Olvidaste tu
   contraseña?"): pedir código al correo → verificar código → nueva contraseña →
   `finalize` → recarga. **OJO:** la firma exacta de este flujo en la API
   Signals/Future NO está en la referencia de VeLocal; **verificar contra los
   tipos de `@clerk/clerk-js` instalado durante la implementación** (es el flujo
   menos trillado). Plan B si la Future API no lo expone limpio: dejar el link de
   reset apuntando al modal de la app (que sí lo tiene) — decisión en el plan.
5. **`/sso-callback`** (ruta nueva): `<AuthenticateWithRedirectCallback
   signInFallbackRedirectUrl="/" signUpFallbackRedirectUrl="/" />` dentro del
   marco de marca, con un texto "Entrando…".

## Delta VeChat (vs la referencia de VeLocal)

- **Post-login = recarga COMPLETA a `/`** (no `router.push("/inicio")`):
  `window.location.assign(dest)` donde `dest` = `?redirect_url=` si viene, si no
  `/`. La recarga hace que el server resuelva el perfil (`getOrCreateProfile`),
  como ya funciona VeChat. Igual en `/sso-callback` (redirect a `/`).
- Textos en **español propios** (el form es markup mío, no depende de la
  localización de Clerk); errores con fallback español.
- Estilo con **tokens VeChat**, no la marca de VeLocal.

## Se preserva

- `AuthShell` (diseño split) + el modal de auth de la app (Clerk).
- Misma instancia Clerk de producción.

## Riesgos / cómo no romper

- **Clerk está domain-locked a producción** → la auth NO funciona en previews
  `*.vercel.app`. Implicación: el **E2E real es en prod tras el merge**, no en una
  preview. Mitigaciones: (a) las páginas son **fallback** — si algo falla, el
  **modal** (flujo principal) sigue intacto; (b) build verde + revisión de código
  antes de mergear; (c) **revert inmediato** (`git revert` + push) si el E2E en
  prod falla.
- Reset password: verificar la API real (ver Flujo 4).
- CAPTCHA obligatorio; guardas contra `null`; no animar opacity.
- `authDesign.css`: los estilos `.cl-*` (apuntaban al componente Clerk) quedan
  sin uso; limpiarlos es opcional y posterior, no bloquea.

## Testing

- **Build** verde (`next build`).
- **E2E en prod** (tras merge, por el domain-lock): registro nuevo (correo +
  código + captcha), login correo, login Google, reset, y que **tras loguear el
  server resuelva el perfil** (no queda en limbo). Probar también en móvil.
- **Regresión:** el modal de auth de la app sigue funcionando; `/sign-in` y
  `/sign-up` ya no muestran el "render por etapas".

## Archivos

- Crear: `src/components/auth/AuthPrimitives.tsx`, `src/app/sso-callback/page.tsx`.
- Reescribir: `src/app/sign-in/[[...sign-in]]/page.tsx`,
  `src/app/sign-up/[[...sign-up]]/page.tsx` (de `<SignIn>/<SignUp>` a headless,
  manteniendo `AuthShell`).
- (Opcional, posterior) limpiar `.cl-*` muertos en
  `src/components/auth/authDesign.css`.
