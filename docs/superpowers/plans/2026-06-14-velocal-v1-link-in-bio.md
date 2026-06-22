# VeLocal v1 (link-in-bio) — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App standalone (VeLocal) donde un negocio se registra, llena una ficha y obtiene una página pública link-in-bio con su link compartible — directo a producción.

**Architecture:** Next.js (App Router) en Vercel. Clerk (app nueva) para la cuenta del negocio. Supabase COMPARTIDO con VeChat pero con tabla propia `velocal_businesses` (no se toca ninguna tabla de VeChat). Todo el acceso a datos es server-side con el service role; la sesión de Clerk autoriza al dueño. La indexación hacia `places` (lo que VeChat lee) es FASE POSTERIOR, fuera de este plan.

**Tech Stack:** Next.js 15 + React, Tailwind, @clerk/nextjs, @supabase/supabase-js (service role server-side), Supabase Storage, Vitest (lógica pura), Vercel.

**Spec:** `docs/superpowers/specs/2026-06-14-producto-link-in-bio-negocios-v1-design.md`

**Repo destino:** `C:\Users\joses\Documents\velocal` (repo GitHub nuevo). El plan se copia a ese repo al crearlo.

---

## File Structure (lo que el proyecto tendrá)

```
velocal/
  src/
    app/
      page.tsx                      # landing del producto (qué es + "Registrar mi negocio")
      layout.tsx                    # ClerkProvider + estilos
      (dashboard)/
        panel/page.tsx              # panel del dueño: crear/editar ficha + ver link
      [slug]/page.tsx               # PÁGINA PÚBLICA del negocio (la Vitrina)
      api/
        business/route.ts           # POST/PUT crea/actualiza la ficha (server, service role)
        upload/route.ts             # POST sube logo/imágenes a Supabase Storage
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
    lib/
      supabaseAdmin.ts              # cliente service-role (solo server)
      slug.ts                       # generación + unicidad de slug (PURO, testeado)
      hours.ts                      # isOpenNow() + tipos de horario (PURO, testeado)
      business.ts                   # tipos Business + capa de datos (get/create/update)
    middleware.ts                   # clerkMiddleware (protege /panel)
  supabase/migrations/
    0001_velocal_businesses.sql     # tabla propia + RLS ON (sin policies)
  tests/
    slug.test.ts
    hours.test.ts
```

---

## Phase 0 — Scaffold y deploy a producción (skeleton primero)

### Task 0.1: Crear la app Next y subirla a GitHub

**Files:** todo el repo nuevo en `C:\Users\joses\Documents\velocal`.

- [ ] **Step 1: Scaffold**

Run:
```bash
cd /c/Users/joses/Documents
npx create-next-app@latest velocal --ts --tailwind --app --eslint --src-dir --use-npm --no-import-alias
cd velocal
```

- [ ] **Step 2: Commit inicial y repo en GitHub**

Run:
```bash
git add -A && git commit -m "chore: scaffold VeLocal (Next + Tailwind)"
gh repo create velocal --private --source=. --remote=origin --push
```
Expected: repo creado y `main` empujado.

### Task 0.2: Deploy a Vercel (producción temprano)

- [ ] **Step 1:** Crear proyecto Vercel ligado al repo `velocal` (framework Next.js detectado).
- [ ] **Step 2:** Deploy de producción. Expected: una URL `velocal-*.vercel.app` viva con el landing por defecto. (El dominio propio se decide después.)

---

## Phase 1 — Datos: tabla propia en la base compartida

### Task 1.1: Migración `velocal_businesses`

**Files:** Create `supabase/migrations/0001_velocal_businesses.sql`

- [ ] **Step 1: Escribir la migración**

```sql
create table if not exists public.velocal_businesses (
  id uuid primary key default gen_random_uuid(),
  owner_clerk_id text not null,
  slug text not null unique,
  name text not null,
  category text not null,
  city text not null default 'Maracay',
  address text,
  description text,
  whatsapp text,
  phone text,
  instagram text,
  maps_url text,
  hours jsonb not null default '{}'::jsonb,
  logo_url text,
  images text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists velocal_businesses_owner_idx on public.velocal_businesses(owner_clerk_id);
alter table public.velocal_businesses enable row level security;
-- RLS ON sin policies: solo el service role (server-side) accede. Igual patrón que
-- las tablas API-only de VeChat. NO se crea policy pública.
```

- [ ] **Step 2: Aplicar la migración** a la base compartida (`swioimqjygpolttiequz`) vía el panel SQL de Supabase o `apply_migration`. Expected: tabla creada, RLS habilitado. **No se modifica ninguna tabla de VeChat.**

- [ ] **Step 3: Crear el bucket de Storage** `velocal` (público para lectura de logos/menús).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_velocal_businesses.sql
git commit -m "feat(db): tabla velocal_businesses (aislada, RLS on)"
```

### Task 1.2: Variables de entorno

- [ ] **Step 1:** En Vercel (y `.env.local`) configurar:
  - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (de la base compartida).
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (app Clerk NUEVA de VeLocal).
  - `NEXT_PUBLIC_VELOCAL_URL` (la URL de prod, para armar links compartibles).

### Task 1.3: Cliente Supabase server-side

**Files:** Create `src/lib/supabaseAdmin.ts`

- [ ] **Step 1: Implementar**

```ts
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
```
Solo se importa desde código server (route handlers / server components). Nunca desde el cliente.

---

## Phase 2 — Lógica pura (testeada): slug y horario

### Task 2.1: Slug

**Files:** Create `src/lib/slug.ts`, Test `tests/slug.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { toSlug, ensureUniqueSlug } from "../src/lib/slug";

describe("toSlug", () => {
  it("normaliza nombre criollo a slug", () => {
    expect(toSlug("Lonchería El Budare")).toBe("loncheria-el-budare");
  });
  it("evita colisión agregando sufijo", () => {
    const taken = new Set(["pizzeria-la-criolla"]);
    expect(ensureUniqueSlug("Pizzería La Criolla", taken)).toBe("pizzeria-la-criolla-2");
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/slug.test.ts` → FAIL (módulo no existe).

- [ ] **Step 3: Implementar**

```ts
export function toSlug(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function ensureUniqueSlug(name: string, taken: Set<string>): string {
  const base = toSlug(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

- [ ] **Step 4:** `npx vitest run tests/slug.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: slug util con unicidad`.

### Task 2.2: Horario / Abierto-Cerrado

**Files:** Create `src/lib/hours.ts`, Test `tests/hours.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { isOpenNow, type Hours } from "../src/lib/hours";

const h: Hours = { mon: [["07:00","20:00"]], tue: [], wed: [["07:00","20:00"]] };

describe("isOpenNow", () => {
  it("abierto dentro del rango (hora Venezuela)", () => {
    // Lunes 10:00 en Caracas
    expect(isOpenNow(h, new Date("2026-06-15T14:00:00Z"))).toBe(true);
  });
  it("cerrado si el día no tiene rangos", () => {
    // Martes
    expect(isOpenNow(h, new Date("2026-06-16T14:00:00Z"))).toBe(false);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/hours.test.ts` → FAIL.

- [ ] **Step 3: Implementar** (`America/Caracas`, sin libs externas)

```ts
export type Range = [string, string];
export type Hours = Partial<Record<"sun"|"mon"|"tue"|"wed"|"thu"|"fri"|"sat", Range[]>>;
const DAYS = ["sun","mon","tue","wed","thu","fri","sat"] as const;

export function isOpenNow(hours: Hours, now = new Date()): boolean {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas", weekday: "short", hour: "2-digit",
    minute: "2-digit", hour12: false,
  }).formatToParts(now);
  const wd = fmt.find(p => p.type === "weekday")!.value.toLowerCase().slice(0,3);
  const hh = fmt.find(p => p.type === "hour")!.value;
  const mm = fmt.find(p => p.type === "minute")!.value;
  const cur = `${hh === "24" ? "00" : hh}:${mm}`;
  const ranges = hours[wd as typeof DAYS[number]] ?? [];
  return ranges.some(([a, b]) => cur >= a && cur <= b);
}
```

- [ ] **Step 4:** `npx vitest run tests/hours.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat: isOpenNow en hora Venezuela`.

---

## Phase 3 — Auth (Clerk app nueva) + capa de datos

### Task 3.1: Clerk

- [ ] **Step 1:** Crear app Clerk NUEVA "VeLocal", copiar claves a env.
- [ ] **Step 2:** `npm i @clerk/nextjs`. Envolver `app/layout.tsx` en `<ClerkProvider>` (español con `@clerk/localizations` esES, como VeChat).
- [ ] **Step 3:** `src/middleware.ts` con `clerkMiddleware()` que protege `/panel`. Crear páginas `sign-in` / `sign-up`.
- [ ] **Step 4: Commit** `feat(auth): Clerk (app VeLocal) + proteger /panel`.

### Task 3.2: Tipos y capa de datos del negocio

**Files:** Create `src/lib/business.ts`

- [ ] **Step 1: Implementar** (server-only; usa `supabaseAdmin`)

```ts
import { supabaseAdmin } from "./supabaseAdmin";
import { Hours } from "./hours";

export type Business = {
  id: string; owner_clerk_id: string; slug: string; name: string;
  category: string; city: string; address?: string; description?: string;
  whatsapp?: string; phone?: string; instagram?: string; maps_url?: string;
  hours: Hours; logo_url?: string; images: string[]; active: boolean;
};

export async function getBusinessBySlug(slug: string) {
  const { data } = await supabaseAdmin
    .from("velocal_businesses").select("*")
    .eq("slug", slug).eq("active", true).maybeSingle();
  return data as Business | null;
}
export async function getBusinessByOwner(ownerClerkId: string) {
  const { data } = await supabaseAdmin
    .from("velocal_businesses").select("*")
    .eq("owner_clerk_id", ownerClerkId).maybeSingle();
  return data as Business | null;
}
export async function listTakenSlugs(): Promise<Set<string>> {
  const { data } = await supabaseAdmin.from("velocal_businesses").select("slug");
  return new Set((data ?? []).map((r: { slug: string }) => r.slug));
}
export async function upsertBusiness(b: Partial<Business> & { owner_clerk_id: string }) {
  const { data, error } = await supabaseAdmin
    .from("velocal_businesses").upsert(b, { onConflict: "owner_clerk_id" })
    .select().single();
  if (error) throw error;
  return data as Business;
}
```

- [ ] **Step 2: Commit** `feat(data): capa de negocios`.

---

## Phase 4 — Registro / panel del dueño

### Task 4.1: API de la ficha

**Files:** Create `src/app/api/business/route.ts`

- [ ] **Step 1: Implementar** POST/PUT: toma el `userId` de Clerk (`auth()`), valida campos mínimos (name, category, whatsapp), genera slug único (`ensureUniqueSlug` con `listTakenSlugs`) si es creación, y hace `upsertBusiness`. Devuelve `{ slug }`.
- [ ] **Step 2:** Probar con la sesión real en prod: crear una ficha de prueba y verificar fila en `velocal_businesses`.
- [ ] **Step 3: Commit** `feat(api): crear/editar ficha`.

### Task 4.2: Upload de imágenes

**Files:** Create `src/app/api/upload/route.ts`

- [ ] **Step 1: Implementar** POST multipart → sube a bucket `velocal` (path `${userId}/${filename}`) → devuelve URL pública. Usado para logo y galería.
- [ ] **Step 2: Commit** `feat(api): subida de logo/imagenes`.

### Task 4.3: Panel

**Files:** Create `src/app/(dashboard)/panel/page.tsx`

- [ ] **Step 1: Implementar** server component que carga `getBusinessByOwner(userId)`; formulario (client) con los campos del spec (nombre, categoría, ciudad, dirección, WhatsApp, instagram, horario por día, logo, fotos, descripción) que postea a `/api/business`. Muestra el link público (`${NEXT_PUBLIC_VELOCAL_URL}/${slug}`) con botón Copiar y enlace "Ver mi página". Previsualización opcional.
- [ ] **Step 2: Commit** `feat(panel): crear/editar ficha + ver link`.

---

## Phase 5 — Página pública (la Vitrina)

### Task 5.1: `/[slug]`

**Files:** Create `src/app/[slug]/page.tsx`

- [ ] **Step 1: Implementar** server component: `getBusinessBySlug(params.slug)`; si null → `notFound()`. Renderiza la Vitrina del boceto aprobado: portada+logo+nombre, estado `isOpenNow(hours)` (Abierto/Cerrado) + ciudad, categoría, botones (WhatsApp `https://wa.me/<num>` protagonista, Ver menú, Cómo llegar `maps_url`, Instagram), descripción, horario, galería, pie "Página por VeLocal". Mobile-first, mismos tonos de marca (verde).
- [ ] **Step 2:** `generateMetadata` con OG (nombre + logo) para previews de WhatsApp/Instagram.
- [ ] **Step 3:** Verificar en prod: abrir `/<slug>` de la ficha de prueba; abierto/cerrado correcto; botón WhatsApp abre chat.
- [ ] **Step 4: Commit** `feat: pagina publica del negocio (Vitrina)`.

### Task 5.2: Landing del producto

**Files:** Modify `src/app/page.tsx`

- [ ] **Step 1: Implementar** landing corto: qué es VeLocal + CTA "Registrar mi negocio" (→ sign-up → /panel). Sobrio, marca verde.
- [ ] **Step 2: Commit** `feat: landing de VeLocal`.

---

## Out of scope (v1) — fases siguientes, NO ahora

- **Indexación en VeChat** (`velocal_businesses` → `places` o que el feed lea VeLocal). Se diseña aparte para no arriesgar VeChat.
- **B (catálogo con precios)** y **C (carrito de pedidos)**.
- **Suscripción, patrocinado/destacado, verificado, estadísticas.**
- **Dominio propio** (v1 corre en la URL de Vercel).
- Clerk↔Supabase third-party auth (no hace falta: acceso server-side con service role).

---

## Self-review

- **Cobertura del spec:** registro (Phase 4) ✓ · página pública + link (Phase 5) ✓ · creación llave-en-mano por formulario (Phase 4.3) ✓ · datos en base compartida sin tocar VeChat (Phase 1, tabla propia) ✓ · gratis (sin cobro en el plan) ✓ · anatomía de la página (Phase 5.1) ✓ · stack repo aparte/mismo Supabase/Clerk nuevo (Phase 0–3) ✓. La "indexación en VeChat" del spec se mueve explícitamente a Out-of-scope por la restricción "no tocar VeChat ahora" — registrado como decisión, no como hueco.
- **Placeholders:** la lógica no obvia (slug, horario, capa de datos, migración, env) va con código/SQL reales y tests. Las tareas de UI/boilerplate (Clerk quickstart, formulario, panel) describen exactamente qué construir y dónde, apoyándose en patrones estándar y en el boceto aprobado.
- **Consistencia de tipos:** `Business`, `Hours`, `isOpenNow`, `toSlug/ensureUniqueSlug`, `upsertBusiness(onConflict: owner_clerk_id)` se usan consistentes entre fases.
