# Bloque 1 · Embudo: chat-first + trial anónimo (1a + 1b)

**Fecha:** 2026-06-21
**Estado:** aprobado (Jose eligió "chat-first + trial 3 msgs"; monetización = negocio promocionado B2B, DIFERIDO)
**Contexto:** del teardown de ChatGPT — sin landing, directo al chat, no-registrados pueden probar. Abre el embudo. Ver [[vechat-rumbo-bloques]].

## Decisiones
- `/` deslogueado = **el chat** (no la landing). Landing se mueve a **`/landing`** (conserva su SEO/JSON-LD).
- Deslogueado envía **3 mensajes** anónimos; al 4º, **muro de registro** (el `openSignUp` que ya existe).
- Anti-abuso: cap por visitante (cookie `vechat_anon`) **+ guardia por IP** (20/24h).
- Anónimo NO persiste historial (efímero, sin perfil). Sí usa grounding (web/local) para que el trial impresione.
- Monetización (1c) = negocio promocionado B2B → **diferido** (necesita densidad). No se construye ahora.

## Arquitectura
### Identidad + gate anónimo
- Cookie `vechat_anon` (uuid). La setea `/api/auth/vps-token` si falta (robusto al primer mensaje).
- Tabla `anon_usage(id, anon_id, ip, created_at)` — event log, una fila por mensaje anónimo. RLS ON (solo service role).
- `src/lib/anonGate.ts`:
  - PURO (testeable): `anonDecision(byAnon, byIp)` → `AnonDenied | null`; `anonRemaining(byAnon)`; consts `ANON_TRIAL_LIMIT=3`, `ANON_IP_DAILY_LIMIT=20`.
  - DB: `checkAnonAccess(supabase, anonId, ip, now)` (cuenta últimas 24h por anon_id + ip → `anonDecision`); `consumeAnon` (insert); `getAnonRemaining`.

### `/api/auth/vps-token` (rama anónima)
- `POST(request)`: si hay Clerk userId → flujo actual (sin cambios). Si NO → rama anónima:
  - lee/crea cookie `vechat_anon`; obtiene IP (`x-forwarded-for`).
  - `checkAnonAccess` → si denied (429 `register:true`) lo devuelve.
  - `consumeAnon`; firma JWT `{ userId: "anon_"+anonId, anon: true }` (mismo secreto) 30s; devuelve token.
- Quitar `/api/auth/vps-token` del matcher protegido en `src/proxy.ts` (el handler hace su propio gate).

### `/api/web-context` (permitir anónimo)
- Hoy 401 si no hay userId. Cambio: si no hay userId pero la cookie `vechat_anon` existe, permitir (grounding sin personalización). `logDemand` usa `clerkUserId: null`.

### `page.tsx` + `/landing`
- `/` deslogueado → `<ChatInterface initialIsLoggedIn={false} appConfig=... />` (modo anónimo). Logueado: sin cambios.
- NUEVO `src/app/landing/page.tsx` → `<Landing appConfig={...} />` (lo que hoy hace `/`).

### `ChatInterface` (modo anónimo)
- Hoy: deslogueado → `requireSignIn()` al primer mensaje. Cambio: deslogueado **envía** por el camino normal (vps-token anónimo); el `429 {register:true}` dispara `requireSignIn(pendingPrompt)` (el muro). El flujo LOGUEADO queda **intacto**.
- Pill "Te quedan N de 3 · regístrate gratis" para anónimos (estado `anonLeft`, refrescado del header `x-anon-left` o un GET ligero).
- Sin sidebar/historial/persistencia para anónimos (ya gateado por `isLoggedIn`).

## Tests
- `src/lib/anonGate.test.ts` (vitest): `anonDecision` (bajo cap → null; en cap visitante → 429 register; cap IP → register; ip null no bloquea), `anonRemaining` (0→3, 3→0, no negativo).
- Build + E2E en prod: **(a)** logueado sigue chateando igual (no romper el core); **(b)** deslogueado en `/` ve el chat, envía 3, al 4º sale el muro; **(c)** `/landing` muestra la landing.

## Riesgo
Toca el core de auth + el archivo más complejo (ChatInterface). Mitigación: el camino logueado NO se modifica (solo se agrega la rama anónima); verificar AMBOS flujos en prod; rollback de Vercel listo.

## Fuera de alcance
- 1c monetización (negocio promocionado) — diferido.
- Persistencia de chats anónimos.
- Detección de bots avanzada (hoy: cap por cookie + IP).
