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
  inyectada UNA vez en el ClerkProvider para el MODAL (no pasar appearance por
  componente al modal)
- `/sign-in` y `/sign-up` quedan como fallback (correos de Clerk, links
  directos, redirects del middleware): **diseño SPLIT de Claude Design**
  (`AuthShell`) con los lados invertidos — formulario a la IZQUIERDA, panel de
  marca oscuro ("Tu pana digital, aquí" + mini chat) a la DERECHA. El form lo
  dibuja Clerk embebido en `.formpane`, estilizado con `vechatAuthPageAppearance`
  (pasada por `appearance` SOLO a esas páginas, sin tocar el modal; oculta el
  header de Clerk porque AuthShell pone `.f-h/.f-sub`). CSS scoped bajo `.av`
  (authDesign.css); re-generar: `scripts/auth/build-auth.mjs`
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
- `CRON_SECRET` (auth del cron del feed), `FEED_LLM_URL`, `FEED_LLM_KEY`,
  `FEED_LLM_MODEL` (canonicalización del feed; hoy MiniMax-M3)

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

## Home: LANDING (deslogueado) + CHAT (logueado)
- OJO (cambio de arquitectura): el visitante DESLOGUEADO ya NO ve el chat.
  `page.tsx` renderiza `src/components/landing/Landing.tsx` (página de venta)
  cuando no hay `userId`; el chat (`ChatInterface`) es solo para logueados.
- `Landing` (server component) = **diseño v2 importado de Claude Design** (export
  "vechat-landing"). Renderiza markup ESTÁTICO vía `dangerouslySetInnerHTML`
  dentro de un wrapper `.lp`; el CSS (`landingDesign.css`) va con CADA selector
  scoped bajo `.lp` para NO tocar el chat. Tema bloqueado en CLARO (papel cálido,
  el diseño no define variante oscura). Contenedor de scroll propio
  (`h-[100dvh] overflow-y-auto`) porque el body global está bloqueado. Usa las 4
  fuentes que el app ya carga (Inter/Bricolage/Archivo/Plus Jakarta) y los tokens
  de marca. CTAs a `/sign-up` · `/sign-in`; precios desde `appConfig` (placeholders
  `__PRICE_*__`/`__FREE_LIMIT__` que sustituye el server); se conserva el JSON-LD
  (WebApplication + FAQ + Org) para SEO. Secciones (11): hero + teléfono-demo,
  marquee, 3 pasos, face-off vs IA genérica, "lo que sabe" (01–05), formatos de
  respuesta, casos por persona, comparativa, testimonios, precios, FAQ, cierre,
  footer. Parche móvil: el `<nav>` (desktop-first) oculta los links de sección en
  ≤768px. **`landingMarkup.ts` y `landingDesign.css` son AUTO-GENERADOS — no
  editar a mano; re-generar con `scripts/landing/build-landing.mjs`** (lee el
  export crudo en `scripts/landing/landing-{body.html,design.css}`).
- `ChatInterface` sigue siendo LA única superficie del LOGUEADO (hero criollo
  + input + feed). El visitante deslogueado del chat (p.ej. vía link a /chat)
  todavía existe como fallback, pero la home `/` deslogueada es la landing.
- Logueado: sidebar con historial; los clicks del feed envían directo;
  cuenta bloqueada (0 semanas) abre el AccountMenu
- Feed: `TrendingFeed` (componente único) + `GET /api/feed` (único endpoint;
  ciudad por user_context o IP) + secciones Tendencias / Cerca de ti /
  Para ti (personalizada por historial; visitantes ven "Preguntando ahora")
- Algoritmo del feed (corre en Vercel server-side, NO en el VPS):
  - Fase 1 (`src/lib/feed.ts`): score por PERSONAS distintas (repetidos 15%,
    anónimos 40% cap 1.5), decaimiento exp(-edad/18h), bonus de pico 6h,
    diversidad máx 2/categoría, contadores solo con ≥3 personas/48h,
    semillas cold-start que los datos reales desplazan
  - Fase 2 (`src/lib/feedDigest.ts` + cron `/api/cron/feed-digest`): un LLM
    agrupa variantes en temas canónicos (tablas feed_topics/
    feed_topic_aliases), reescribe la pregunta pública, clasifica y filtra
    publicabilidad; materializa agregados en feed_cache. Cron diario 9 UTC
    (vercel.json) + retrigger en background desde /api/feed si la caché
    tiene >6h. getPublicFeed usa la caché (<26h) o cae a fase 1 en vivo.
  - LLM agnóstico: FEED_LLM_URL/KEY/MODEL (OpenAI-compatible; hoy MiniMax
    M3 vía api.minimax.io/v1 — OJO: razonador, mete <think> en el content
    y el parser lo limpia) con fallback ANTHROPIC_API_KEY/BASE_URL
  - SEÑAL, no número: las tarjetas NO muestran "N personas" sino un
    indicador de 3 barras (`SignalBars`) con nivel relativo 0–3 (`FeedCard.
    signal`, derivado del rank entre temas calificados). "Cerca de ti" es
    local de verdad (solo temas con actividad en la ciudad; no se diluye
    con genéricos si hay reales). "Preguntando ahora" va limpio (sin punto
    parpadeante, sin tiempo ni ciudad). Chevron de swipe solo en móvil.
- Intereses aprendidos (chips de "Mi contexto" + sección "Para ti"):
  - Tabla `user_interests` (user_id, tag, label, weight, source
    learned|manual, pinned). RLS ON sin policies (solo rutas API).
  - EN VIVO: `/api/track-query` extrae tags baratos de cada búsqueda
    (`extractTags`), los bombea con decaimiento vía RPC `bump_user_interests`
    (weight*exp(-Δt/14d)+1, poda a 60/usuario) y re-materializa el top en
    `user_context.interests` (la columna que el chat ya envía al VPS).
  - IA: el cron del feed (`refineUserInterests` en feedDigest) agrupa los
    tags 'learned' en hashtags limpios (junta sinónimos, descarta ruido).
  - UI: `/api/user-context/interests` (GET con backfill perezoso desde el
    texto viejo; POST add/remove/pin/unpin). En AccountMenu → ContextTab,
    un solo grupo de chips (los aprendidos con puntito; tocar = fijar). Se
    eliminó el textarea de notas libres. `/api/user-context/save` ahora solo
    actualiza los campos provistos (no pisa `interests` al guardar nombre/ciudad).
  - "Para ti" del feed se nutre de `user_interests` (no solo del historial).
- NO recrear páginas/landings paralelas ni segundos empty states — cualquier
  cambio de la home va en EmptyState/TrendingFeed
- Auth en español (`@clerk/localizations` esES en el ClerkProvider); el
  flujo principal es el modal (ver sección Auth), las páginas son fallback
- Tema: claro/oscuro/sistema. Tokens en `:root` (claro) y `[data-theme="dark"]`
  (paleta original) en globals.css; preferencia en localStorage `vechat-theme`
  (default: sistema); script anti-flash en layout + `ThemeWatcher`; selector
  en AccountMenu → Personalización; `useResolvedTheme()` (src/lib/theme.ts)
  para lo que no se puede tokenizar (p. ej. syntax highlighting)
- Claro = "papel cálido + verde esmeralda": el principio es CALIDEZ, no oscuridad
  (un gris-verde frío y apagado quedaba "nublado/triste"; el blanco puro frío
  "pega a la vista"). La PÁGINA es papel cálido (`--background` #F1ECE3, greige
  tibio = menos luz azul, acogedor) y las SUPERFICIES son marfil cálido casi
  blanco (`--surface` #FBF8F2: crujientes y luminosas = vida + profundidad, pero
  cálidas, no pinchan). Texto espresso cálido (`--text-primary` #2A2521), no
  negro. El verde de marca (`--primary` #10A37F) se mantiene VIVO en los acentos
  (botones, burbujas `--user-bubble` #DCEFE5, enlaces) para dar energía. El área
  central del chat NO pinta fondo: hereda `--background`.
- OJO con blancos hardcodeados: como `--surface` NO es blanco, cualquier
  `#FFFFFF`/`bg-white` usado como superficie se vería más frío/brillante que el
  tema. El color claro vive en: globals.css (`:root`), el theme-color de la barra
  del navegador (layout.tsx script anti-flash, src/lib/theme.ts CHROME_COLORS,
  AuthShell.tsx) y la apariencia de Clerk (src/lib/clerkAppearance.ts). Si tocas
  el tono claro, muévelos juntos.

## Compartir conversaciones
- Modelo "foto fija" (snapshot) EFÍMERA: al compartir se congela una copia de
  solo lectura que CADUCA SOLA a las 24h. No hay "dejar de compartir" manual.
  Tabla `shared_conversations` (token PK aleatorio base62, conversation_id
  UNIQUE, owner_id, title, messages jsonb, `expires_at` = now()+24h). RLS ON
  sin policies (solo API).
- Caducidad: GET y la página pública tratan un enlace con `expires_at <= now()`
  como inexistente (correctitud). El cron diario (`/api/cron/feed-digest`)
  barre las filas vencidas (`purgeExpiredShares`, best-effort, solo higiene).
- `/api/share` valida que la conversación es del usuario; el snapshot excluye
  mensajes `in_progress` o vacíos (OJO: `public.messages` NO tiene columna
  `private` — esa pertenece a `realtime.messages`; pedirla rompe el query).
  - GET ?conversationId → { token, expiresAt } solo si está vivo, si no null.
  - POST: si hay enlace VIVO reusa token Y conserva su `expires_at` (reabrir
    refresca el contenido pero NO reinicia el reloj); si no hay o venció, acuña
    token nuevo con 24h frescas. Upsert onConflict `conversation_id`.
  - DELETE existe pero ya no lo usa la UI (la caducidad reemplaza al revoke).
- Página pública `/c/[token]` (server, lee por token con service role; NO está
  en el middleware → pública, sin cuenta): solo lectura con los bubbles del
  chat (`SharedConversation`), marca VeChat + CTA "Pruébalo gratis" arriba y
  "Empieza tu propia conversación" abajo (embudo). `generateMetadata` con OG
  para previews en WhatsApp/Telegram. Su contenedor de scroll es propio
  (`h-[100dvh]` + `overflow-y-auto`) porque el body global está bloqueado.
- Entradas: item "Compartir" en el menú ⋮ del sidebar (solo Compartir/Renombrar/
  Eliminar) y botón flotante arriba del chat → `ShareModal`. El dueño nunca
  aparece en la página pública.
- `ShareModal` MINIMALISTA (a propósito): una sola acción protagonista. Sin
  enlace aún → botón "Crear enlace" (avisa que caduca a las 24h). Ya compartido
  → el enlace con "Copiar" + botón grande "Enviar por WhatsApp" (el canal real
  en VE) + una línea gris con las horas que le quedan. NADA más (sin Telegram/X,
  sin "Actualizar", sin "Desactivar"). La foto se pone al día sola al reabrir.

## Modelo de negocio (FREEMIUM)
- Spec/plan: `docs/superpowers/specs/2026-06-13-modelo-negocio-design.md` +
  `docs/superpowers/plans/2026-06-13-modelo-negocio-freemium.md`
- Tiers resueltos por `resolveTier()` (src/lib/plans.ts, función PURA
  isomórfica usada por server y cliente) sobre (status, subscription_weeks,
  subscription_end): **banned** (status!='active'), **unlimited** (weeks=-1,
  admin), **paid** (subscription_end > now), **free** (todo lo demás).
- **Gratis**: toda cuenta nueva nace `plan='free'` (ya NO bloqueada) y chatea
  con tope diario (`free_daily_limit`, default 10) que se reinicia a
  medianoche Venezuela (04:00 UTC, ver `nextVenezuelaMidnightUTC`). Conteo en
  `profiles.daily_msg_count` + `daily_reset_at`.
- **Planes pago** (chat ilimitado mientras vigentes): Semanal y Mensual.
  Al **vencer** caen a free (NO bloqueo total; "sin acceso" solo si el admin
  pone `status='inactive'`).
- **Gating REAL en `/api/auth/vps-token`** (helper `src/lib/dailyGate.ts`:
  `checkDailyAccess` + `consumeDailyQuota`). OJO: el chat NO pasa por
  `/api/chat` — el cliente pide token a vps-token (1 por envío) y llama a
  `/api/stream`. vps-token devuelve 403/429 y consume cuota; `/api/chat`
  conserva el gate (sin consumo) por si algún path legacy lo usa.
- **UI**: píldora "Te quedan N" cuando quota ≤3 (ChatInput); al agotar,
  `LimitReachedCard` (cuenta regresiva al reset) reemplaza el input y abre
  `PlansModal` (precios desde config + WhatsApp + canje de cupón).
  `getBlockReason`/`quotaLeft` en ChatInterface usan `resolveTier`; `appConfig`
  llega por props desde los server components (page.tsx, chat/*).
- **Cobro MIXTO**: cupones (canje en `/api/coupons/apply`, sincroniza `plan`)
  + WhatsApp manual; activación centralizada en `src/lib/activatePlan.ts`
  (la usa el admin vía `POST /api/admin/data?type=activate-plan`; mañana la
  pasarela). Pasarela automática = fuera de alcance (solo la costura lista).
- **Config editable** sin redeploy: tabla `app_config` (free_daily_limit,
  price_weekly_usd=2, price_monthly_usd=6, plan_weekly_days=7,
  plan_monthly_days=30, whatsapp_number). Lectura server: `getAppConfig()`
  (src/lib/appConfig.ts, con defaults). Admin la edita en `/admin` →
  Configuración (`GET/POST /api/admin/data?type=config`).
- Límite horario viejo (20/hora) ELIMINADO (era código muerto).
