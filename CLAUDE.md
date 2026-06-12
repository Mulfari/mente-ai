# Mente AI (VeChat)

Chat AI tipo ChatGPT orientado a público venezolano. Registro público con Clerk; el admin activa/gestiona suscripciones.

## Tech Stack
- Next.js (App Router) + Tailwind — deploy en Vercel (proyecto `mente-ai`, dominio `www.mulfai.com.ve`)
- Auth: Clerk (`@clerk/nextjs` v7) — instancia production, dominio `mulfai.com.ve`
- Supabase (`swioimqjygpolttiequz`) — solo base de datos, NO auth
- VPS orchestrator (203.161.47.133) — streaming del modelo, valida JWT firmado con `VPS_SHARED_SECRET`
- API proxy del modelo: `api.selectapi.vip`

## Auth (Clerk)
- MODAL-FIRST: dentro de la app el auth se abre con `openSignIn`/`openSignUp`
  de Clerk encima del chat (requireSignIn y CTAs del header en ChatInterface);
  al autenticarse sin redirect (email/contraseña) un efecto con `useAuth`
  recarga la página para que el server resuelva el perfil
- Apariencia global en `src/lib/clerkAppearance.ts` (clara, verde VeChat),
  inyectada UNA vez en el ClerkProvider — no pasar appearance por componente
- `/sign-in` y `/sign-up` quedan como fallback (correos de Clerk, links
  directos, redirects del middleware) con `AuthShell` (tarjeta centrada)
- Setup estándar con CNAME: Frontend API en `clerk.mulfai.com.ve`
  (DNS en Vercel DNS, `ns1/ns2.vercel-dns.com`; los 5 CNAME de Clerk —
  clerk, accounts, clkmail, clk._domainkey, clk2._domainkey — ya existen
  y el dominio está verificado en Clerk)
- Middleware en `src/proxy.ts` (`clerkMiddleware`) protege rutas; el redirect
  apex→www lo hace Vercel a nivel de plataforma
- Webhook `POST /api/webhooks/clerk` (verifyWebhook): crea/actualiza/soft-borra
  perfiles. OJO: se le pasa `signingSecret: process.env.CLERK_WEBHOOK_SECRET`
  explícito (el default del SDK lee CLERK_WEBHOOK_SIGNING_SECRET)
- Fallback `getOrCreateProfile()` en `src/lib/profile.ts`: si el webhook no
  creó el perfil, se crea en el primer page-load server-side
- La app real en Clerk es **"My Application"** (`ins_3EvTLqEOpB2fLyQ0j7mYFwlEDRc`);
  hay apps duplicadas en el workspace que se pueden borrar

## Identidades (IMPORTANTE)
- `profiles.clerk_user_id` (text) = id de Clerk (`user_xxx`) — el link externo
- `profiles.id` (uuid, default gen_random_uuid) = id interno — TODAS las demás
  tablas (`conversations.user_id`, `user_context.user_id`, `query_events.user_id`,
  `coupons.used_by/created_by`, `knowledge.created_by`) referencian este UUID
- Las páginas server-side resuelven el perfil y pasan `profiles.id` al cliente;
  el browser consulta Supabase directo con el **token de Clerk** (third-party
  auth, ver sección RLS) usando ese UUID
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

## RLS (third-party auth Clerk↔Supabase)
- RLS **habilitado en TODAS las tablas**. El anon key solo no puede leer nada.
- Supabase tiene a Clerk como third-party auth provider (dominio
  `clerk.mulfai.com.ve`). El browser manda el session token de Clerk
  (JWT template `supabase`, claim `role: authenticated`) como Bearer —
  ver `src/lib/supabase/client.ts` (opción `accessToken`).
- Policies en `profiles`/`conversations`/`messages`/`user_context`: mapean
  `auth.jwt()->>'sub'` (clerk_user_id) al UUID interno vía la función
  `public.clerk_profile_id()` (SECURITY DEFINER, STABLE).
- **NUNCA usar `auth.uid()`** en policies: el sub de Clerk (`user_xxx`) no es
  uuid y el cast explota. Siempre `auth.jwt()->>'sub'`.
- El resto de tablas (coupons, knowledge*, query_events, places, etc.) tienen
  RLS ON sin policies: solo las rutas API con el service role key acceden.

## UN SOLO CHAT (arquitectura de la home)
- `ChatInterface` es LA única superficie para todos: deslogueado y logueado
  ven exactamente lo mismo (hero criollo + input centrado a pantalla
  completa + feed de tendencias bajo el fold con scroll interno)
- Deslogueado: sin sidebar, header con marca y CTAs; `getBlockReason`
  permite escribir y `sendMessage`/`submitSuggestion` abren el modal de
  registro guardando la pregunta (`vechat-pending-question` en localStorage),
  que tras autenticarse se teclea sola en el input (typeAndSubmit) y se envía
- Logueado: sidebar con historial; los clicks del feed envían directo;
  cuenta bloqueada (0 semanas) abre el AccountMenu
- Feed: `TrendingFeed` (componente único) + `GET /api/feed` (único endpoint;
  ciudad por user_context o IP) + `src/lib/feed.ts` (agregación 48h/7d de
  query_events, sanitizado PII/groserías, semillas cold-start, contadores
  solo con volumen real ≥3)
- NO recrear páginas/landings paralelas ni segundos empty states — cualquier
  cambio de la home va en EmptyState/TrendingFeed
- Auth en español (`@clerk/localizations` esES en el ClerkProvider); el
  flujo principal es el modal (ver sección Auth), las páginas son fallback
- Tema: claro/oscuro/sistema. Tokens en `:root` (claro) y `[data-theme="dark"]`
  (paleta original) en globals.css; preferencia en localStorage `vechat-theme`
  (default: sistema); script anti-flash en layout + `ThemeWatcher`; selector
  en AccountMenu → Personalización; `useResolvedTheme()` (src/lib/theme.ts)
  para lo que no se puede tokenizar (p. ej. syntax highlighting)

## Modelo de negocio
- Registro libre, pero cuenta nueva queda con `subscription_weeks = 0` (bloqueada para chatear)
- Admin activa cuentas / agrega semanas, o el usuario canjea cupón
- Límite horario para no-pagos: 20 msg/hora
- Sin freemium — un solo plan semanal
