# Mente AI (VeChat)

Chat AI tipo ChatGPT orientado a público venezolano. Registro público con Clerk; el admin activa/gestiona suscripciones.

## Tech Stack
- Next.js (App Router) + Tailwind — deploy en Vercel (proyecto `mente-ai`, dominio `www.mulfai.com.ve`)
- Auth: Clerk (`@clerk/nextjs` v7) — instancia production, dominio `mulfai.com.ve`
- Supabase (`swioimqjygpolttiequz`) — solo base de datos, NO auth
- VPS orchestrator (203.161.47.133) — streaming del modelo, valida JWT firmado con `VPS_SHARED_SECRET`
- API proxy del modelo: `api.selectapi.vip`

## Auth (Clerk)
- Login/registro en `/sign-in` y `/sign-up` (componentes de Clerk)
- Middleware en `src/proxy.ts` (`clerkMiddleware`) protege rutas y **proxea la
  Frontend API de Clerk por `https://mulfai.com.ve/__clerk`** (sin CNAME
  `clerk.mulfai.com.ve`). Clerk exige el proxy en el dominio registrado (apex,
  sin www); el middleware redirige 308 apex→www para todo lo demás.
- `ClerkProvider` en `layout.tsx` usa `proxyUrl="https://mulfai.com.ve/__clerk"` (absoluto, no relativo)
- DNS en Vercel DNS (`ns1/ns2.vercel-dns.com`) — los CNAME de email de Clerk
  (clkmail, clk._domainkey, clk2._domainkey) ya están agregados
- Webhook `POST /api/webhooks/clerk` (verifyWebhook): crea/actualiza/soft-borra perfiles
- Fallback `getOrCreateProfile()` en `src/lib/profile.ts`: si el webhook no
  creó el perfil, se crea en el primer page-load server-side

## Identidades (IMPORTANTE)
- `profiles.clerk_user_id` (text) = id de Clerk (`user_xxx`) — el link externo
- `profiles.id` (uuid, default gen_random_uuid) = id interno — TODAS las demás
  tablas (`conversations.user_id`, `user_context.user_id`, `query_events.user_id`,
  `coupons.used_by/created_by`, `knowledge.created_by`) referencian este UUID
- Las páginas server-side resuelven el perfil y pasan `profiles.id` al cliente;
  el browser consulta Supabase directo (anon key) con ese UUID
- El JWT del VPS se firma con el UUID interno (igual en `/api/chat` y `/api/auth/vps-token`)

## Supabase Schema
- `profiles` — status, role, semanas de suscripción, límites (link: clerk_user_id)
- `conversations` / `messages` — historial por usuario (FK a profiles)
- `user_context`, `query_events`, `coupons`, `knowledge*`, `places/cities/categories`

## Variables de entorno
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `VPS_SHARED_SECRET`, `VPS_ORCHESTRATOR_URL`
- `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`

## Admin
- Panel en `/admin` — acceso por `profiles.role = 'admin'` (gate en página y en `/api/admin/*`)
- Ver usuarios, activar/cancelar cuentas, agregar semanas, eliminar (borra el usuario en Clerk vía `clerkClient`), cupones

## RLS
- RLS deshabilitado en las tablas de la app — el control de acceso se maneja
  en las rutas API (server-side). Las policies viejas de `auth.uid()` se
  eliminaron (Clerk no crea sesión de Supabase, auth.uid() siempre era NULL).
- Tradeoff conocido: el anon key puede leer/escribir esas tablas. Mejora
  futura: third-party auth de Clerk en Supabase + policies con auth.jwt().

## Modelo de negocio
- Registro libre, pero cuenta nueva queda con `subscription_weeks = 0` (bloqueada para chatear)
- Admin activa cuentas / agrega semanas, o el usuario canjea cupón
- Límite horario para no-pagos: 20 msg/hora
- Sin freemium — un solo plan semanal
