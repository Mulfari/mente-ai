# Modelo de negocio freemium — Plan de implementación

> **Para quien ejecuta:** implementar tarea por tarea. Los pasos usan checkbox
> (`- [ ]`). Spec de referencia:
> `docs/superpowers/specs/2026-06-13-modelo-negocio-design.md`.

**Goal:** Pasar VeChat de pago-puro-con-activación-manual a freemium: toda cuenta
nueva chatea gratis con tope diario (10/día), convierte a planes Semanal ($2) /
Mensual ($6), con cobro mixto (cupón + WhatsApp manual) y costura lista para
pasarela automática.

**Architecture:** Un único concepto de "tier" resuelto por una función pura
isomórfica (`resolveTier`) que usan por igual el servidor (`/api/chat`, la
verdad) y el cliente (`getBlockReason`, el reflejo). El conteo diario vive en
`profiles` (`daily_msg_count` + `daily_reset_at`, reset a medianoche Venezuela).
Precios y límites en una tabla `app_config` editable desde el admin. La
activación de planes se centraliza en una función llamada hoy por cupones y
admin, mañana por un webhook de pasarela.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS, MCP para
migraciones), Clerk, Vercel. Sin suite de tests unitarios: la verificación es
`npm run build` + E2E en producción con Playwright y usuario Clerk descartable
(patrón establecido en CLAUDE.md).

**Verificación (patrón del proyecto, aplica a varias tareas):**
- `npm run build` debe compilar limpio.
- Deploy: push a `main` → Vercel despliega solo; esperar a que el commit esté
  `READY` (curl a la API de deployments con el token del CLI).
- E2E: crear usuario Clerk vía API → el webhook crea el perfil → ajustar el
  perfil por SQL (MCP Supabase) → sign-in token → Playwright con
  `?__clerk_ticket=` → comprobar → borrar usuario de Clerk + fila de profiles.

---

## Estructura de archivos

**Nuevos:**
- `src/lib/plans.ts` — lógica pura isomórfica: `resolveTier`, `nextVenezuelaMidnightUTC`, tipos de tier y de plan. Sin imports de servidor (lo usa cliente y servidor).
- `src/lib/appConfig.ts` — lectura server-side de `app_config` (precios, límite, días) con defaults; un único `getAppConfig()`.
- `src/lib/activatePlan.ts` — activación centralizada `activatePlan(supabase, profileId, plan, now)`; única vía que escribe `plan`/`subscription_*`. La usan cupones, admin y (futuro) pasarela.
- `src/components/chat/PlansModal.tsx` — modal de planes (Semanal/Mensual desde config, WhatsApp, cupón).
- `src/components/chat/LimitReachedCard.tsx` — tarjeta cálida de cupo agotado (cuenta regresiva + CTAs).

**Modificados:**
- `app_config` y `profiles` (migración SQL vía MCP).
- `src/app/api/chat/route.ts` — gating diario (reemplaza `validateProfile` + incrementa `daily_msg_count`).
- `src/app/api/coupons/apply/route.ts` — usar `activatePlan`.
- `src/app/api/admin/data/route.ts` — usar `activatePlan` al activar/agregar; CRUD de `app_config`.
- `src/components/ChatInterface.tsx` — `getBlockReason` vía `resolveTier`; exponer cuota restante; render de píldora ≤3, `LimitReachedCard` y `PlansModal`; recibir `appConfig` y cuota por props.
- `src/app/page.tsx` — cargar `getAppConfig()` y la cuota del perfil, pasarlas a `ChatInterface`.
- `src/components/AccountMenu.tsx` — la pestaña de suscripción muestra planes desde config y abre el flujo de pago (reusa `PlansModal` o comparte CTAs).
- `src/components/AdminPanelClient.tsx` — sección para editar `app_config`.
- `CLAUDE.md` — actualizar la sección "Modelo de negocio".

---

## Task 1: Migración de datos (profiles + app_config)

**Files:** migración Supabase vía MCP `apply_migration` (proyecto `swioimqjygpolttiequz`).

- [ ] **Step 1: Aplicar migración** — `apply_migration` nombre `freemium_model`:

```sql
-- Conteo diario del tier gratis
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_msg_count integer NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_reset_at timestamptz;
-- Tier informativo (la vigencia real la dan subscription_weeks/subscription_end)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free';

-- Config editable (precios, límite, duraciones). Una sola fila key->value.
CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_config (key, value) VALUES
  ('free_daily_limit', '10'),
  ('price_weekly_usd', '2'),
  ('price_monthly_usd', '6'),
  ('plan_weekly_days', '7'),
  ('plan_monthly_days', '30'),
  ('whatsapp_number', '')
ON CONFLICT (key) DO NOTHING;

-- RLS: app_config la sirve el servidor con service role; sin políticas (igual que el resto).
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Migrar cuentas existentes al nuevo tier informativo.
UPDATE profiles SET plan = 'unlimited' WHERE subscription_weeks = -1;
UPDATE profiles SET plan = 'free'      WHERE subscription_weeks = 0 OR subscription_weeks IS NULL;
UPDATE profiles SET plan = 'weekly'    WHERE subscription_weeks > 0 AND subscription_end IS NOT NULL;
```

- [ ] **Step 2: Verificar** — `execute_sql`:

```sql
SELECT key, value FROM app_config ORDER BY key;
SELECT plan, count(*) FROM profiles GROUP BY plan;
```

Esperado: 6 filas de config con los defaults; los 2 perfiles actuales en `unlimited` (ambos admin).

- [ ] **Step 3: Regenerar tipos (opcional, si se usan)** — si el proyecto usa
  tipos generados de Supabase, regenerarlos; si no, omitir. (Verificar con
  `Grep` `database.types` en `src/`.)

---

## Task 2: Lógica pura de tiers (`src/lib/plans.ts`)

**Files:** Create `src/lib/plans.ts`.

- [ ] **Step 1: Crear el módulo** con tipos y funciones puras (sin imports):

```ts
// Tier resuelto: única fuente de verdad de acceso, usada por servidor y cliente.
export type Tier = "banned" | "unlimited" | "paid" | "free";
export type PaidPlan = "weekly" | "monthly";

export type TierInput = {
  status?: string | null;
  subscription_weeks?: number | null;
  subscription_end?: string | null;
};

// banned: el admin lo desactivó. unlimited: admin (-1). paid: plan vigente.
// free: todo lo demás (cuenta nueva, o plan vencido que cae a gratis).
export function resolveTier(p: TierInput, now: Date): Tier {
  if (p.status && p.status !== "active") return "banned";
  if ((p.subscription_weeks ?? 0) === -1) return "unlimited";
  if (p.subscription_end && new Date(p.subscription_end).getTime() > now.getTime()) return "paid";
  return "free";
}

// Medianoche del próximo día en hora Venezuela (UTC-4), expresada en UTC.
// VET no tiene horario de verano, así que el offset es fijo.
export function nextVenezuelaMidnightUTC(now: Date): Date {
  const VET_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4
  const vetNow = new Date(now.getTime() - VET_OFFSET_MS);
  const vetMidnight = Date.UTC(
    vetNow.getUTCFullYear(), vetNow.getUTCMonth(), vetNow.getUTCDate() + 1, 0, 0, 0, 0
  );
  return new Date(vetMidnight + VET_OFFSET_MS);
}

export const PLAN_DURATION_KEY: Record<PaidPlan, string> = {
  weekly: "plan_weekly_days",
  monthly: "plan_monthly_days",
};
```

- [ ] **Step 2: Build** — `npm run build`. Esperado: compila (módulo aislado, sin uso aún).

- [ ] **Step 3: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: logica pura de tiers (resolveTier + reset diario Venezuela)"
```

---

## Task 3: Lectura de configuración (`src/lib/appConfig.ts`)

**Files:** Create `src/lib/appConfig.ts`.

- [ ] **Step 1: Crear el helper** (server-side, service role vía cliente existente):

```ts
import { createClient } from "@/lib/supabase/server";

export type AppConfig = {
  freeDailyLimit: number;
  priceWeeklyUsd: number;
  priceMonthlyUsd: number;
  planWeeklyDays: number;
  planMonthlyDays: number;
  whatsappNumber: string;
};

const DEFAULTS: AppConfig = {
  freeDailyLimit: 10,
  priceWeeklyUsd: 2,
  priceMonthlyUsd: 6,
  planWeeklyDays: 7,
  planMonthlyDays: 30,
  whatsappNumber: "",
};

// Lee app_config y cae a DEFAULTS si falta una clave o falla la query.
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_config").select("key, value");
    if (!data) return DEFAULTS;
    const m = new Map(data.map((r: any) => [r.key, r.value]));
    const num = (k: string, d: number) => {
      const v = Number(m.get(k));
      return Number.isFinite(v) ? v : d;
    };
    return {
      freeDailyLimit: num("free_daily_limit", DEFAULTS.freeDailyLimit),
      priceWeeklyUsd: num("price_weekly_usd", DEFAULTS.priceWeeklyUsd),
      priceMonthlyUsd: num("price_monthly_usd", DEFAULTS.priceMonthlyUsd),
      planWeeklyDays: num("plan_weekly_days", DEFAULTS.planWeeklyDays),
      planMonthlyDays: num("plan_monthly_days", DEFAULTS.planMonthlyDays),
      whatsappNumber: String(m.get("whatsapp_number") ?? DEFAULTS.whatsappNumber),
    };
  } catch {
    return DEFAULTS;
  }
}

export { DEFAULTS as APP_CONFIG_DEFAULTS };
```

- [ ] **Step 2: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 3: Commit**

```bash
git add src/lib/appConfig.ts
git commit -m "feat: lectura de app_config (precios/limite/dias) con defaults"
```

---

## Task 4: Activación centralizada de planes (`src/lib/activatePlan.ts`)

**Files:** Create `src/lib/activatePlan.ts`.

- [ ] **Step 1: Crear la función** — única vía que escribe la vigencia. Suma
  sobre el tiempo restante (no pisa días que el usuario ya pagó), igual que la
  lógica de cupones actual:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/lib/appConfig";
import type { PaidPlan } from "@/lib/plans";

// Activa/extiende un plan pago para un perfil (por profiles.id interno).
// Centraliza la escritura de plan + subscription_*; la llaman cupones, admin
// y (futuro) el webhook de una pasarela — sin tocar UI ni gating.
export async function activatePlan(
  supabase: SupabaseClient,
  profileId: string,
  plan: PaidPlan,
  now: Date = new Date()
): Promise<{ subscriptionEnd: string }> {
  const cfg = await getAppConfig();
  const days = plan === "weekly" ? cfg.planWeeklyDays : cfg.planMonthlyDays;

  const { data: profile } = await supabase
    .from("profiles").select("subscription_end").eq("id", profileId).single();

  const prevEnd = profile?.subscription_end ? new Date(profile.subscription_end).getTime() : 0;
  const base = Math.max(prevEnd, now.getTime());
  const subscriptionEnd = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("profiles").update({
    plan,
    status: "active",
    subscription_start: now.toISOString(),
    subscription_end: subscriptionEnd,
    subscription_weeks: Math.ceil(days / 7),
  }).eq("id", profileId);

  return { subscriptionEnd };
}
```

- [ ] **Step 2: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 3: Commit**

```bash
git add src/lib/activatePlan.ts
git commit -m "feat: activacion centralizada de planes (cupones/admin/pasarela)"
```

---

## Task 5: Gating diario en `/api/chat`

**Files:** Modify `src/app/api/chat/route.ts`.

- [ ] **Step 1: Reemplazar `validateProfile`** (líneas 11-40) por el gate de
  tier + cuota diaria. Borra `HOURLY_LIMIT`/`COOLDOWN_MINUTES` (código muerto:
  el contador horario nunca se incrementaba):

```ts
import { resolveTier, nextVenezuelaMidnightUTC } from "@/lib/plans";
import { getAppConfig } from "@/lib/appConfig";

// Devuelve null si puede enviar; si no, el error. Cuando es free y tiene
// cuota, NO incrementa aquí — el incremento es un paso aparte (Step 3) para
// no consumir cuota si el envío falla antes de llamar al VPS.
async function checkAccess(profile: any, now: Date) {
  const tier = resolveTier(profile, now);
  if (tier === "banned") return { error: "Tu cuenta está inactiva.", code: 403 as const };
  if (tier === "unlimited" || tier === "paid") return null;
  // tier === "free": aplica tope diario.
  const cfg = await getAppConfig();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  const count = !resetAt || now >= resetAt ? 0 : (profile.daily_msg_count ?? 0);
  if (count >= cfg.freeDailyLimit) {
    const next = resetAt && now < resetAt ? resetAt : nextVenezuelaMidnightUTC(now);
    return {
      error: "Llegaste a tu límite diario gratis.",
      code: 429 as const,
      resetAt: next.toISOString(),
    };
  }
  return null;
}
```

- [ ] **Step 2: Actualizar el SELECT y la llamada** (líneas ~66-77). Añadir
  `plan, subscription_end, daily_msg_count, daily_reset_at` al select y usar
  `checkAccess`:

```ts
const { data: profile } = await supabase
  .from("profiles")
  .select("id, status, subscription_weeks, subscription_end, plan, daily_msg_count, daily_reset_at")
  .eq("clerk_user_id", userId)
  .single();
if (!profile) return NextResponse.json({ error: "Error 404.", code: 404 }, { status: 404 });
const internalUserId = profile.id;

const now = new Date();
const denied = await checkAccess(profile, now);
if (denied) return NextResponse.json(denied, { status: denied.code });
```

- [ ] **Step 3: Incrementar la cuota diaria tras aceptar el envío** — justo
  después de validar que el mensaje no está vacío (después de la línea ~82,
  antes de cargar historial). Solo cuenta para `free`:

```ts
if (resolveTier(profile, now) === "free") {
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  const fresh = !resetAt || now >= resetAt;
  await supabase.from("profiles").update({
    daily_msg_count: fresh ? 1 : (profile.daily_msg_count ?? 0) + 1,
    daily_reset_at: fresh ? nextVenezuelaMidnightUTC(now).toISOString() : profile.daily_reset_at,
  }).eq("id", internalUserId);
}
```

- [ ] **Step 4: Build** — `npm run build`. Esperado: compila sin referencias a
  `HOURLY_LIMIT`/`validateProfile`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: gating diario por tier en /api/chat (10/dia gratis, pago ilimitado)"
```

---

## Task 6: Cupones y admin usan `activatePlan` + CRUD de config

**Files:** Modify `src/app/api/coupons/apply/route.ts`, `src/app/api/admin/data/route.ts`.

- [ ] **Step 1: Leer el admin actual** — `Read src/app/api/admin/data/route.ts`
  para localizar dónde activa/agrega semanas (busca `subscription_weeks` y
  `update`). Anota la forma del payload (acción + userId + semanas/plan).

- [ ] **Step 2: Cupones → setear `plan`** — en `coupons/apply/route.ts`, en el
  `update` del perfil (líneas 74-80) añadir `plan`:

```ts
await supabase.from("profiles").update({
  subscription_weeks: newWeeks,
  subscription_end: subscriptionEnd,
  status: newStatus,
  plan: coupon.is_unlimited ? "unlimited" : ((coupon.duration_days ?? 7) >= 28 ? "monthly" : "weekly"),
  used_coupon_label: label,
  used_coupon_color: color,
}).eq("id", profile.id);
```

(No se refactoriza a `activatePlan` aquí porque el cupón ya calcula su propia
duración/etiqueta; solo se sincroniza la columna `plan`.)

- [ ] **Step 3: Admin → usar `activatePlan`** — en `admin/data/route.ts`, en la
  acción de activar un plan nominal (semanal/mensual), reemplazar el `update`
  directo por la función centralizada (este es su consumidor real; mañana la
  pasarela la llamará igual):

```ts
import { activatePlan } from "@/lib/activatePlan";
// ...dentro de la acción de activar plan (profileId = profiles.id interno):
await activatePlan(supabase, profileId, plan === "monthly" ? "monthly" : "weekly", new Date());
```

  Para la acción de "agregar N semanas sueltas" (si existe), mantener el `update`
  directo pero sincronizando `plan` (`>= 4 semanas` → `monthly`, si no `weekly`;
  `-1` → `unlimited`). Para "quitar acceso": `plan:'free'`, `subscription_end:null`,
  `subscription_weeks:0`.

- [ ] **Step 4: Endpoint de config en el admin** — añadir a
  `admin/data/route.ts` (o crear `src/app/api/admin/config/route.ts`) un
  `GET` que lea `app_config` y un `POST` que actualice claves dadas (validando
  que sean numéricas salvo `whatsapp_number`). Gate admin igual que el resto de
  `/api/admin/*` (rol admin).

```ts
// POST body: { updates: { free_daily_limit?: string, price_weekly_usd?: string, ... } }
for (const [key, value] of Object.entries(updates)) {
  await supabase.from("app_config").update({ value: String(value), updated_at: new Date().toISOString() }).eq("key", key);
}
```

- [ ] **Step 5: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/coupons/apply/route.ts src/app/api/admin/data/route.ts
git commit -m "feat: cupones/admin sincronizan plan + CRUD de app_config en admin"
```

---

## Task 7: `getBlockReason` por tier + cuota a props (`ChatInterface` + `page.tsx`)

**Files:** Modify `src/components/ChatInterface.tsx`, `src/app/page.tsx`.

- [ ] **Step 1: page.tsx pasa config y cuota** — en el branch logueado, cargar
  `getAppConfig()` y los campos de cuota del perfil
  (`plan, subscription_end, daily_msg_count, daily_reset_at`) y pasarlos como
  props nuevas a `<ChatInterface>`: `appConfig`, y dentro de `initialProfile`
  asegurar que vienen esos campos. (El logueado-fuera no necesita config de
  límite; pasar `appConfig` igual para el modal de planes cuando se registre.)

- [ ] **Step 2: Tipos de props** — en `ChatInterface`, extender el tipo de
  `initialProfile` con `plan?: string; daily_msg_count?: number;
  daily_reset_at?: string` y añadir prop `appConfig: AppConfig` (importar el
  tipo de `@/lib/appConfig`). Sembrar el estado `profile` con esos campos
  (el SELECT de refresco en el efecto ~290 y ~375 debe incluirlos también).

- [ ] **Step 3: Reescribir `getBlockReason`** (líneas 809-817) usando
  `resolveTier`, y exponer la cuota restante:

```ts
import { resolveTier } from "@/lib/plans";

function quotaLeft(): number {
  if (!profile) return appConfig.freeDailyLimit;
  const now = new Date();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  const count = !resetAt || now >= resetAt ? 0 : (profile.daily_msg_count ?? 0);
  return Math.max(0, appConfig.freeDailyLimit - count);
}

function getBlockReason(): { canSend: boolean; canWrite: boolean; reason: string } {
  if (!isLoggedIn) return { canSend: true, canWrite: true, reason: "" };
  const tier = resolveTier(profile ?? {}, new Date());
  if (tier === "banned") return { canSend: false, canWrite: false, reason: "Tu cuenta está inactiva." };
  if (tier === "unlimited" || tier === "paid") return { canSend: true, canWrite: true, reason: "" };
  // free
  if (quotaLeft() <= 0) return { canSend: false, canWrite: true, reason: "limit-daily" };
  return { canSend: true, canWrite: true, reason: "" };
}
```

(Nota: `canWrite:true` aun sin cuota — la conversación queda visible y el textarea
no se "muere"; el bloqueo de envío y la tarjeta los maneja la UI en Task 9.)

- [ ] **Step 4: Incremento optimista local** — tras enviar con éxito en el tier
  free, reflejar el consumo en `profile.daily_msg_count` localmente para que la
  píldora/tarjeta reaccionen sin esperar al refetch (el servidor ya es la
  verdad). En el path de éxito de envío, `setProfile(p => ...)` incrementando
  `daily_msg_count` (creando `daily_reset_at` si era nulo o ya pasó).

- [ ] **Step 5: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 6: Commit**

```bash
git add src/components/ChatInterface.tsx src/app/page.tsx
git commit -m "feat: getBlockReason por tier + cuota diaria a la UI"
```

---

## Task 8: Píldora de aviso anticipado (≤3 restantes)

**Files:** Modify `src/components/chat/ChatInput.tsx` (recibe la cuota) y
`src/components/ChatInterface.tsx` (la pasa).

- [ ] **Step 1: Prop de cuota** — `ChatInput` recibe `quotaLeft?: number` y
  `showQuota?: boolean` (true solo para tier free; los pagos no la ven). El
  padre pasa `quotaLeft={quotaLeft()}` y `showQuota={resolveTier(...) === "free"}`.

- [ ] **Step 2: Render de la píldora** — dentro del wrapper del input, encima de
  la pastilla, visible solo si `showQuota && quotaLeft <= 3 && quotaLeft > 0`:

```tsx
{showQuota && quotaLeft !== undefined && quotaLeft <= 3 && quotaLeft > 0 && (
  <div className="flex justify-center mb-2">
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1 rounded-full"
      style={{ color: "var(--primary)", backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)" }}>
      Te {quotaLeft === 1 ? "queda 1 mensaje" : `quedan ${quotaLeft} mensajes`} gratis hoy
    </span>
  </div>
)}
```

- [ ] **Step 3: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 4: Commit**

```bash
git add src/components/chat/ChatInput.tsx src/components/ChatInterface.tsx
git commit -m "feat: pildora de aviso cuando quedan <=3 mensajes gratis"
```

---

## Task 9: Tarjeta de cupo agotado + modal de planes

**Files:** Create `src/components/chat/LimitReachedCard.tsx`,
`src/components/chat/PlansModal.tsx`; Modify `src/components/ChatInterface.tsx`.

- [ ] **Step 1: `LimitReachedCard.tsx`** — reemplaza el input cuando
  `tier==='free' && quotaLeft<=0`. Cuenta regresiva derivada de
  `daily_reset_at`; CTAs "Ver planes" y "Tengo un cupón":

```tsx
"use client";
import React from "react";

export default function LimitReachedCard({ resetAt, onSeePlans, onRedeem }: {
  resetAt: string | null; onSeePlans: () => void; onRedeem: () => void;
}) {
  const [left, setLeft] = React.useState("");
  React.useEffect(() => {
    if (!resetAt) return;
    const tick = () => {
      const ms = new Date(resetAt).getTime() - Date.now();
      if (ms <= 0) { setLeft(""); return; }
      const h = Math.floor(ms / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
      setLeft(h > 0 ? `${h} h ${m} min` : `${m} min`);
    };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, [resetAt]);

  return (
    <div className="w-full max-w-[704px] mx-auto px-3 sm:px-4 pt-2"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
      <div className="rounded-2xl p-5 text-center"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        <div className="w-11 h-11 rounded-full mx-auto mb-2.5 flex items-center justify-center text-xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--primary) 14%, transparent)" }}>🎉</div>
        <p className="text-[15px] font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
          Llegaste a tus mensajes de hoy
        </p>
        <p className="text-[13px] mb-3.5" style={{ color: "var(--text-secondary)" }}>
          {left ? `Se renuevan en ${left} · o pásate a ilimitado` : "Vuelve mañana · o pásate a ilimitado"}
        </p>
        <div className="flex gap-2 justify-center flex-wrap">
          <button onClick={onSeePlans}
            className="px-5 py-2.5 rounded-full text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--primary)" }}>Ver planes</button>
          <button onClick={onRedeem}
            className="px-5 py-2.5 rounded-full text-[14px] transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}>Tengo un cupón</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `PlansModal.tsx`** — modal (scrim `rgba(17,24,39,0.45)`, patrón de
  los modales existentes) con dos tarjetas de plan desde `appConfig`
  (Semanal `priceWeeklyUsd` / Mensual `priceMonthlyUsd`, el mensual marcado
  "Mejor precio"), botón "Pagar por WhatsApp" (abre
  `https://wa.me/<whatsappNumber>?text=...` con mensaje pre-armado del plan
  elegido) y un campo para canjear cupón que llama a `POST /api/coupons/apply`
  (reusar la lógica que ya exista en `AccountMenu`; si está, extraerla a un
  helper compartido para no duplicar). Props: `appConfig`, `onClose`,
  `onRedeemed`.

- [ ] **Step 3: Cablear en `ChatInterface`** — estado `showPlans`. En el render
  del dock inferior y del EmptyState: si `tier==='free' && quotaLeft()<=0`,
  renderizar `<LimitReachedCard resetAt={profile?.daily_reset_at ?? null}
  onSeePlans={() => setShowPlans(true)} onRedeem={() => setShowPlans(true)} />`
  en lugar del `<ChatInput>`. Renderizar `{showPlans && <PlansModal
  appConfig={appConfig} onClose={() => setShowPlans(false)} onRedeemed={...}/>}`.
  Tras canje exitoso: refetch del perfil (sube el tier) y cerrar modal.

- [ ] **Step 4: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 5: Commit**

```bash
git add src/components/chat/LimitReachedCard.tsx src/components/chat/PlansModal.tsx src/components/ChatInterface.tsx
git commit -m "feat: tarjeta de cupo agotado (cuenta regresiva) + modal de planes"
```

---

## Task 10: Admin edita config + AccountMenu muestra planes

**Files:** Modify `src/components/AdminPanelClient.tsx`, `src/components/AccountMenu.tsx`.

- [ ] **Step 1: Admin** — añadir una sección "Configuración" que hace `GET` a
  la config (Task 6 Step 4), muestra inputs para `free_daily_limit`,
  `price_weekly_usd`, `price_monthly_usd`, `plan_weekly_days`,
  `plan_monthly_days`, `whatsapp_number`, y un botón "Guardar" que hace `POST`.
  Seguir el estilo de formularios del panel (ver `categoryForm`).

- [ ] **Step 2: AccountMenu** — la pestaña de suscripción muestra los planes y
  precios desde la config (no hardcodeados) y abre el mismo flujo de pago
  (reusar `PlansModal` o sus CTAs). Mantener el canje de cupón existente.

- [ ] **Step 3: Build** — `npm run build`. Esperado: compila.

- [ ] **Step 4: Commit**

```bash
git add src/components/AdminPanelClient.tsx src/components/AccountMenu.tsx
git commit -m "feat: admin edita precios/limite; AccountMenu muestra planes desde config"
```

---

## Task 11: Verificación E2E en producción + docs

**Files:** Modify `CLAUDE.md`. Verificación con usuario de prueba.

- [ ] **Step 1: Push y esperar deploy** — push de todos los commits; esperar a
  que el último commit esté `READY` en Vercel.

- [ ] **Step 2: Usuario de prueba GRATIS** — crear usuario Clerk vía API; el
  webhook crea el perfil (nace `plan='free'`, `subscription_weeks=0`). NO
  activar nada. Sign-in token → Playwright.

- [ ] **Step 3: Verificar tope diario** — bajar temporalmente el límite por SQL
  para no enviar 10 mensajes reales:
  `UPDATE app_config SET value='2' WHERE key='free_daily_limit';`
  Enviar 2 mensajes (deben entrar). Al 3º: el cliente muestra
  `LimitReachedCard` y `POST /api/chat` responde 429. Verificar en la respuesta
  de red y en el DOM (`LimitReachedCard` visible, input reemplazado).
  Restaurar: `UPDATE app_config SET value='10' WHERE key='free_daily_limit';`

- [ ] **Step 4: Verificar reset** — `UPDATE profiles SET daily_reset_at = now()
  WHERE clerk_user_id='<test>';` recargar → vuelve a poder enviar (cuota
  reseteada a 0). Confirma el path de reset.

- [ ] **Step 5: Verificar conversión por cupón** — generar/usar un cupón válido,
  canjear desde `PlansModal`; el perfil sube a `plan` pago, `subscription_end`
  futuro, y desaparecen píldora y tope (envío ilimitado). Verificar `resolveTier`
  → `paid` por SQL.

- [ ] **Step 6: Verificar vencimiento → free** —
  `UPDATE profiles SET subscription_end = now() - interval '1 day', plan='weekly'
  WHERE clerk_user_id='<test>';` recargar → vuelve a tier free con tope diario
  (NO bloqueo total). Confirma la regla "vencido cae a gratis".

- [ ] **Step 7: Verificar config en vivo** — cambiar `price_weekly_usd` desde el
  admin y confirmar que `PlansModal`/AccountMenu reflejan el nuevo precio sin
  redeploy.

- [ ] **Step 8: Limpieza** — borrar el usuario de Clerk (DELETE API) y su fila de
  `profiles` (+ conversations/messages/query_events si creó). Confirmar que solo
  quedan los perfiles reales.

- [ ] **Step 9: Actualizar `CLAUDE.md`** — reemplazar la sección "Modelo de
  negocio" por el modelo nuevo (gratis 10/día, planes Semanal $2/Mensual $6
  ilimitados, vencido cae a gratis, cobro mixto + activación centralizada,
  config en `app_config` editable desde admin, tier vía `resolveTier`). Commit:

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md — modelo freemium (gratis 10/dia + planes semanal/mensual)"
```

- [ ] **Step 10: Push final** y esperar deploy `READY`.

---

## Notas de alcance

- **Fuera (YAGNI):** pasarela automática (solo se deja `activatePlan` lista),
  diferenciación de features por tier, plan anual, reset por zona horaria del
  usuario (todos usan hora Venezuela).
- **Riesgo conocido:** `app_config` se sirve solo por API con service role
  (RLS ON sin políticas), así que el cliente nunca la lee directo — la recibe
  por props desde server components o por endpoints. No exponer el service role.
