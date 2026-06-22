# VeParts Hito 1 — Cimientos + Catálogo IA + Buscador (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una tienda de repuestos pueda darse de alta, subir un documento (Excel/foto/PDF) que la IA convierte en catálogo estructurado, revisarlo/publicarlo, y que ese catálogo quede **buscable** por parte + vehículo — todo probado sin depender todavía del bot de WhatsApp.

**Architecture:** Producto vertical nuevo siguiendo el patrón VeLocal: repo `Mulfari/veparts`, Next.js (App Router) + Tailwind en Vercel, Clerk (app nueva, solo tiendas), Supabase **compartido** (`swioimqjygpolttiequz`) con tablas propias `veparts_*` y RLS ON. La lógica pura (normalización de partes, parseo de vehículo, construcción de la query de búsqueda) se aísla en `src/lib/**` y se prueba con Vitest. La ingesta IA y el buscador se exponen por rutas API + páginas internas del panel; el canal WhatsApp queda para el Plan 2.

**Tech Stack:** Next.js (App Router, TypeScript), Tailwind, `@clerk/nextjs` v7, `@supabase/supabase-js`, `@anthropic-ai/sdk` (ingesta + parseo), `xlsx` (Excel), Vitest (tests).

**Spec:** `docs/superpowers/specs/2026-06-21-veparts-repuestos-b2b-design.md` (en repo mente-ai).

**Fuera de alcance de este plan:** bot de WhatsApp, difusión/cotización (`veparts_requests`/`veparts_quotes`), integración con VeChat, cobro/suscripción real, VeShop. Esto es Hito 1 sin el canal WhatsApp.

---

## File Structure (lo que se crea en el repo `veparts`)

```
veparts/
  .env.example
  package.json · tsconfig.json · next.config.ts · tailwind.config.ts · postcss.config.mjs
  vitest.config.ts
  supabase/migrations/0001_veparts_core.sql
  src/
    proxy.ts                      # clerkMiddleware, protege /panel
    middleware.ts                 # re-export de proxy (Next busca middleware.ts)
    app/
      layout.tsx                  # ClerkProvider (esES), <html>, Tailwind
      globals.css
      page.tsx                    # landing mínima → CTA a /panel
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
      panel/
        layout.tsx                # gate: resuelve la tienda del usuario
        page.tsx                  # dashboard (resumen + accesos)
        cargar/page.tsx           # subir documento
        catalogo/page.tsx         # listar/editar/publicar productos
        buscar/page.tsx           # buscador interno de prueba
      api/
        ingest/route.ts           # POST documento → IA → items en veparts_ingestions
        ingest/[id]/route.ts      # GET estado/items · POST confirmar→veparts_products
        catalog/route.ts          # GET lista · PATCH editar producto
        search/route.ts           # GET ?q= → resultados (motor del buscador)
    lib/
      supabase/server.ts          # cliente service-role (server only)
      supabase/client.ts          # cliente browser con token de Clerk
      store.ts                    # getOrCreateStore() (perfil de la tienda)
      ingest/extract.ts           # documento → items crudos (Claude visión / xlsx)
      ingest/normalize.ts         # PURA: canonicaliza nombre de parte + vehículo
      search/parseQuery.ts        # PURA: texto libre → {part, vehicle}
      search/buildQuery.ts        # PURA: {part, vehicle} → filtros Supabase
      search/rank.ts              # PURA: ordena resultados (match + distancia)
      types.ts                    # tipos compartidos (Product, RawItem, etc.)
  tests/
    normalize.test.ts
    parseQuery.test.ts
    buildQuery.test.ts
    rank.test.ts
```

**Por qué este corte:** las 4 piezas con lógica de verdad (`normalize`, `parseQuery`, `buildQuery`, `rank`) son funciones puras → se prueban con TDD sin DB ni red. La ingesta IA y las rutas API orquestan; se prueban a mano en la página interna. El UI sigue patrones de VeLocal.

---

## Fase 0 — Scaffold e infraestructura

### Task 1: Crear el repo y proyecto Next.js

**Files:**
- Create: todo el scaffold base del repo `veparts`

- [ ] **Step 1: Crear el proyecto**

```bash
# En Documents (o donde vivan los repos)
npx create-next-app@latest veparts --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint
cd veparts
git init && git add -A && git commit -m "chore: scaffold Next.js + Tailwind"
```

- [ ] **Step 2: Instalar dependencias del proyecto**

```bash
npm i @clerk/nextjs @clerk/localizations @supabase/supabase-js @anthropic-ai/sdk xlsx
npm i -D vitest @vitejs/plugin-react
```

- [ ] **Step 3: Crear `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
});
```

- [ ] **Step 4: Añadir script de test en `package.json`**

En `"scripts"` agregar: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Verificar y commit**

Run: `npm run test`
Expected: PASS con "No test files found" (sale 0 tests, exit 0). Si Vitest devuelve error de config, corregir antes de seguir.

```bash
git add -A && git commit -m "chore: vitest + deps (clerk, supabase, anthropic, xlsx)"
```

### Task 2: Variables de entorno y `.env.example`

**Files:**
- Create: `.env.example`

- [ ] **Step 1: Escribir `.env.example`**

```bash
# Clerk (app NUEVA de VeParts, no la de VeChat)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
# Supabase COMPARTIDO con VeChat (proyecto swioimqjygpolttiequz)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# IA (ingesta + parseo). Reusa la de VeChat.
ANTHROPIC_API_KEY=
ANTHROPIC_BASE_URL=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example && git commit -m "chore: env example"
```

> **Acción humana (fuera del agente):** crear la app de Clerk nueva, el proyecto en Vercel, y cargar estas variables (locales en `.env.local`, y en Vercel). El `SUPABASE_SERVICE_ROLE_KEY` y la URL salen del proyecto Supabase ya existente.

---

## Fase 1 — Esquema de base de datos

### Task 3: Migración `veparts_core` (stores, products, ingestions)

**Files:**
- Create: `supabase/migrations/0001_veparts_core.sql`

- [ ] **Step 1: Escribir la migración**

```sql
-- 0001_veparts_core.sql
create extension if not exists unaccent;

-- TIENDA / DISTRIBUIDOR
create table if not exists public.veparts_stores (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  name text not null default '',
  city text default '',
  lat double precision,
  lng double precision,
  hours text default '',
  whatsapp text default '',
  subscription_status text not null default 'trial', -- trial | active | inactive
  subscription_end timestamptz,
  created_at timestamptz not null default now()
);

-- CATALOGO
create table if not exists public.veparts_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.veparts_stores(id) on delete cascade,
  name text not null,                 -- descripción canónica de la parte
  part_brand text default '',         -- marca de la parte (ej. Bosch)
  part_number text default '',        -- OEM / cross-reference
  price numeric,                      -- en USD; null = "consultar"
  in_stock boolean not null default true,
  veh_make text default '',           -- marca del vehículo (ej. Toyota)
  veh_model text default '',          -- modelo (ej. Corolla)
  veh_year_from int,                  -- rango de años compatible
  veh_year_to int,
  source text not null default 'manual', -- manual | ingest
  published boolean not null default false,
  search_tsv tsvector,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- tsv: nombre + marca + número + vehículo, con unaccent
create or replace function public.veparts_products_tsv(p public.veparts_products)
returns tsvector language sql immutable as $$
  select to_tsvector('simple', unaccent(
    coalesce(p.name,'') || ' ' || coalesce(p.part_brand,'') || ' ' ||
    coalesce(p.part_number,'') || ' ' || coalesce(p.veh_make,'') || ' ' ||
    coalesce(p.veh_model,'')
  ));
$$;

create or replace function public.veparts_products_tsv_trg()
returns trigger language plpgsql as $$
begin
  new.search_tsv := public.veparts_products_tsv(new);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_veparts_products_tsv on public.veparts_products;
create trigger trg_veparts_products_tsv
  before insert or update on public.veparts_products
  for each row execute function public.veparts_products_tsv_trg();

create index if not exists idx_veparts_products_tsv on public.veparts_products using gin(search_tsv);
create index if not exists idx_veparts_products_store on public.veparts_products(store_id);
create index if not exists idx_veparts_products_pub on public.veparts_products(published) where published;

-- INGESTAS (un documento subido)
create table if not exists public.veparts_ingestions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.veparts_stores(id) on delete cascade,
  filename text default '',
  status text not null default 'processing', -- processing | ready | error
  items jsonb not null default '[]',  -- items extraídos (RawItem[]) pendientes de confirmar
  error text,
  created_at timestamptz not null default now()
);

-- RLS ON en todas (como el resto del esquema de VeChat). Sin policies:
-- solo las rutas API con service role key acceden. (Policies por-tienda
-- con token de Clerk se añaden en una fase posterior si el browser lee directo.)
alter table public.veparts_stores enable row level security;
alter table public.veparts_products enable row level security;
alter table public.veparts_ingestions enable row level security;
```

- [ ] **Step 2: Aplicar la migración**

Aplicar contra el proyecto Supabase compartido (vía el MCP de Supabase `apply_migration` con name `veparts_core`, o el SQL editor del dashboard).
Expected: 3 tablas `veparts_*` creadas; `select * from veparts_products limit 1;` devuelve 0 filas sin error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0001_veparts_core.sql
git commit -m "feat(db): veparts core schema (stores, products, ingestions)"
```

---

## Fase 2 — Auth de la tienda y perfil

### Task 4: ClerkProvider + middleware + páginas de auth

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/proxy.ts`, `src/middleware.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`

- [ ] **Step 1: `src/proxy.ts` (clerkMiddleware que protege `/panel`)**

```ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher(["/panel(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/(api|trpc)(.*)"],
};
```

- [ ] **Step 2: `src/middleware.ts`**

```ts
export { default, config } from "./proxy";
```

- [ ] **Step 3: `src/app/layout.tsx` con ClerkProvider en español**

```tsx
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { esES } from "@clerk/localizations";
import "./globals.css";

export const metadata: Metadata = { title: "VeParts", description: "Repuestos, conectados." };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider localization={esES}>
      <html lang="es"><body>{children}</body></html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 4: Páginas de auth (Clerk embebido)**

`src/app/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";
export default function Page() {
  return <div className="min-h-screen grid place-items-center p-6"><SignIn /></div>;
}
```
`src/app/sign-up/[[...sign-up]]/page.tsx`:
```tsx
import { SignUp } from "@clerk/nextjs";
export default function Page() {
  return <div className="min-h-screen grid place-items-center p-6"><SignUp /></div>;
}
```

- [ ] **Step 5: Verificar y commit**

Run: `npm run build`
Expected: build OK (sin errores de tipos). Si falta env de Clerk en build, usar claves de prueba en `.env.local`.

```bash
git add -A && git commit -m "feat(auth): clerk provider, middleware, sign-in/up"
```

### Task 5: `getOrCreateStore()` y gate del panel

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/store.ts`, `src/app/panel/layout.tsx`, `src/app/panel/page.tsx`, `src/lib/types.ts`

- [ ] **Step 1: `src/lib/supabase/server.ts` (service role)**

```ts
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 2: `src/lib/types.ts`**

```ts
export type RawItem = {
  name: string;
  part_brand?: string;
  part_number?: string;
  price?: number | null;
  in_stock?: boolean;
  veh_make?: string;
  veh_model?: string;
  veh_year_from?: number | null;
  veh_year_to?: number | null;
};

export type Store = {
  id: string;
  clerk_user_id: string;
  name: string;
  city: string;
  lat: number | null;
  lng: number | null;
};
```

- [ ] **Step 3: `src/lib/store.ts`**

```ts
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";

export async function getOrCreateStore(): Promise<Store | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const db = supabaseAdmin();
  const { data: existing } = await db
    .from("veparts_stores").select("*").eq("clerk_user_id", userId).maybeSingle();
  if (existing) return existing as Store;
  const { data: created } = await db
    .from("veparts_stores").insert({ clerk_user_id: userId }).select("*").single();
  return (created as Store) ?? null;
}
```

- [ ] **Step 4: `src/app/panel/layout.tsx` (resuelve la tienda)**

```tsx
import { redirect } from "next/navigation";
import { getOrCreateStore } from "@/lib/store";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const store = await getOrCreateStore();
  if (!store) redirect("/sign-in");
  return <div className="min-h-screen p-6 max-w-4xl mx-auto">{children}</div>;
}
```

- [ ] **Step 5: `src/app/panel/page.tsx` (dashboard mínimo)**

```tsx
import Link from "next/link";
import { getOrCreateStore } from "@/lib/store";

export default async function PanelHome() {
  const store = await getOrCreateStore();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Panel · {store?.name || "Tu tienda"}</h1>
      <div className="flex gap-3">
        <Link className="underline" href="/panel/cargar">Cargar catálogo</Link>
        <Link className="underline" href="/panel/catalogo">Ver catálogo</Link>
        <Link className="underline" href="/panel/buscar">Buscador (prueba)</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verificar y commit**

Run: `npm run build`
Expected: build OK.

```bash
git add -A && git commit -m "feat(panel): store profile + gated panel shell"
```

---

## Fase 3 — Ingesta IA del catálogo

> Núcleo testeable: `normalize.ts` (puras). La extracción IA (`extract.ts`) se orquesta y se valida contra el tipo `RawItem`; se prueba a mano en `/panel/cargar`.

### Task 6: `normalize.ts` (TDD) — canonicaliza parte + vehículo

**Files:**
- Create: `src/lib/ingest/normalize.ts`
- Test: `tests/normalize.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, it, expect } from "vitest";
import { normalizeItem } from "@/lib/ingest/normalize";

describe("normalizeItem", () => {
  it("recorta y normaliza espacios/capitalización del nombre", () => {
    const r = normalizeItem({ name: "  pastillas  de   FRENO " });
    expect(r.name).toBe("Pastillas de freno");
  });
  it("infiere in_stock=true por defecto", () => {
    expect(normalizeItem({ name: "filtro" }).in_stock).toBe(true);
  });
  it("parsea precio con coma o símbolo a número", () => {
    expect(normalizeItem({ name: "x", price: "12,50" as unknown as number }).price).toBe(12.5);
    expect(normalizeItem({ name: "x", price: "$8" as unknown as number }).price).toBe(8);
  });
  it("año único llena from y to iguales", () => {
    const r = normalizeItem({ name: "x", veh_year_from: 2015 });
    expect(r.veh_year_to).toBe(2015);
  });
  it("descarta items sin nombre devolviendo null", () => {
    expect(normalizeItem({ name: "   " })).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- tests/normalize.test.ts`
Expected: FAIL ("normalizeItem is not a function").

- [ ] **Step 3: Implementar el mínimo**

```ts
import type { RawItem } from "@/lib/types";

function cap(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : t;
}

function toPrice(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const n = parseFloat(String(v).replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function normalizeItem(raw: RawItem): RawItem | null {
  const name = cap(String(raw.name ?? ""));
  if (!name) return null;
  const yf = raw.veh_year_from ?? null;
  const yt = raw.veh_year_to ?? yf;
  return {
    name,
    part_brand: (raw.part_brand ?? "").trim(),
    part_number: (raw.part_number ?? "").trim(),
    price: toPrice(raw.price),
    in_stock: raw.in_stock ?? true,
    veh_make: cap(raw.veh_make ?? ""),
    veh_model: cap(raw.veh_model ?? ""),
    veh_year_from: yf,
    veh_year_to: yt,
  };
}

export function normalizeItems(items: RawItem[]): RawItem[] {
  return items.map(normalizeItem).filter((x): x is RawItem => x !== null);
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- tests/normalize.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ingest/normalize.ts tests/normalize.test.ts
git commit -m "feat(ingest): normalizeItem/normalizeItems (TDD)"
```

### Task 7: `extract.ts` — documento → `RawItem[]`

**Files:**
- Create: `src/lib/ingest/extract.ts`

- [ ] **Step 1: Implementar extracción (Excel directo + IA visión para imagen/PDF)**

```ts
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import type { RawItem } from "@/lib/types";

const EXTRACT_PROMPT = `Eres un asistente que extrae un catálogo de repuestos.
Devuelve SOLO un array JSON de objetos con estas claves (string salvo precio number y años number):
name, part_brand, part_number, price, veh_make, veh_model, veh_year_from, veh_year_to.
'name' es la descripción de la pieza. Si un dato no aparece, usa "". No inventes datos.`;

export async function extractFromExcel(buf: ArrayBuffer): Promise<RawItem[]> {
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
  return rows.map((r) => ({
    name: String(r["nombre"] ?? r["descripcion"] ?? r["name"] ?? r["producto"] ?? ""),
    part_brand: String(r["marca"] ?? r["brand"] ?? ""),
    part_number: String(r["numero"] ?? r["codigo"] ?? r["part_number"] ?? ""),
    price: (r["precio"] ?? r["price"] ?? null) as number | null,
    veh_make: String(r["vehiculo"] ?? r["veh_make"] ?? ""),
    veh_model: String(r["modelo"] ?? r["veh_model"] ?? ""),
  }));
}

export async function extractFromImage(base64: string, mime: string): Promise<RawItem[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    baseURL: process.env.ANTHROPIC_BASE_URL || undefined,
  });
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mime as "image/jpeg", data: base64 } },
        { type: "text", text: EXTRACT_PROMPT },
      ],
    }],
  });
  const text = msg.content.filter((c) => c.type === "text").map((c) => (c as { text: string }).text).join("");
  const start = text.indexOf("["), end = text.lastIndexOf("]");
  if (start < 0 || end < 0) return [];
  try { return JSON.parse(text.slice(start, end + 1)) as RawItem[]; } catch { return []; }
}
```

- [ ] **Step 2: Verificar compila y commit**

Run: `npm run build`
Expected: build OK.

```bash
git add src/lib/ingest/extract.ts
git commit -m "feat(ingest): extract from excel + image (anthropic vision)"
```

### Task 8: Rutas de ingesta (`/api/ingest`)

**Files:**
- Create: `src/app/api/ingest/route.ts`, `src/app/api/ingest/[id]/route.ts`

- [ ] **Step 1: `POST /api/ingest` — sube doc, extrae, guarda items pendientes**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import { extractFromExcel, extractFromImage } from "@/lib/ingest/extract";
import { normalizeItems } from "@/lib/ingest/normalize";

export async function POST(req: NextRequest) {
  const store = await getOrCreateStore();
  if (!store) return NextResponse.json({ error: "no auth" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "no file" }, { status: 400 });

  const buf = await file.arrayBuffer();
  let raw;
  if (/\.(xlsx?|csv)$/i.test(file.name)) {
    raw = await extractFromExcel(buf);
  } else {
    const base64 = Buffer.from(buf).toString("base64");
    raw = await extractFromImage(base64, file.type || "image/jpeg");
  }
  const items = normalizeItems(raw);

  const db = supabaseAdmin();
  const { data, error } = await db.from("veparts_ingestions")
    .insert({ store_id: store.id, filename: file.name, status: "ready", items })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, count: items.length, items });
}
```

- [ ] **Step 2: `GET /api/ingest/[id]` y `POST /api/ingest/[id]` (confirmar → productos)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RawItem } from "@/lib/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getOrCreateStore();
  if (!store) return NextResponse.json({ error: "no auth" }, { status: 401 });
  const db = supabaseAdmin();
  const { data } = await db.from("veparts_ingestions")
    .select("*").eq("id", id).eq("store_id", store.id).maybeSingle();
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const store = await getOrCreateStore();
  if (!store) return NextResponse.json({ error: "no auth" }, { status: 401 });
  const db = supabaseAdmin();
  const { data: ing } = await db.from("veparts_ingestions")
    .select("items").eq("id", id).eq("store_id", store.id).maybeSingle();
  if (!ing) return NextResponse.json({ error: "not found" }, { status: 404 });
  const items = (await req.json().catch(() => null))?.items as RawItem[] | undefined ?? ing.items;
  const rows = (items as RawItem[]).map((it) => ({ ...it, store_id: store.id, source: "ingest", published: true }));
  const { error } = await db.from("veparts_products").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inserted: rows.length });
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run build`
Expected: build OK.

```bash
git add src/app/api/ingest
git commit -m "feat(api): ingest upload + confirm to catalog"
```

### Task 9: Página `/panel/cargar` (subir + revisar + publicar)

**Files:**
- Create: `src/app/panel/cargar/page.tsx`

- [ ] **Step 1: Implementar la página (client component)**

```tsx
"use client";
import { useState } from "react";
import type { RawItem } from "@/lib/types";

export default function Cargar() {
  const [items, setItems] = useState<RawItem[]>([]);
  const [ingestId, setIngestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    const res = await fetch("/api/ingest", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (json.id) { setIngestId(json.id); setItems(json.items); }
    else alert(json.error || "Error");
  }

  async function publish() {
    if (!ingestId) return;
    setBusy(true);
    const res = await fetch(`/api/ingest/${ingestId}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const json = await res.json();
    setBusy(false);
    alert(json.inserted != null ? `Publicados ${json.inserted}` : (json.error || "Error"));
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Cargar catálogo</h1>
      <form onSubmit={upload} className="flex gap-2 items-center">
        <input type="file" name="file" accept=".xlsx,.xls,.csv,image/*,.pdf" required />
        <button disabled={busy} className="border px-3 py-1 rounded">{busy ? "..." : "Subir"}</button>
      </form>
      {items.length > 0 && (
        <>
          <p className="text-sm text-gray-600">{items.length} items — revisá y publicá.</p>
          <ul className="divide-y text-sm">
            {items.map((it, i) => (
              <li key={i} className="py-1">{it.name} · {it.veh_make} {it.veh_model} · {it.price ?? "consultar"}</li>
            ))}
          </ul>
          <button disabled={busy} onClick={publish} className="bg-black text-white px-4 py-2 rounded">Publicar</button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Probar end-to-end a mano**

Run: `npm run dev` y en `/panel/cargar` subir un Excel de prueba con columnas `nombre, marca, precio, vehiculo, modelo`.
Expected: aparece la lista de items; "Publicar" inserta en `veparts_products` (verificar con `select count(*) from veparts_products;`).

- [ ] **Step 3: Commit**

```bash
git add src/app/panel/cargar/page.tsx
git commit -m "feat(panel): upload + review + publish catalog"
```

---

## Fase 4 — Catálogo (ver/editar)

### Task 10: API y página de catálogo

**Files:**
- Create: `src/app/api/catalog/route.ts`, `src/app/panel/catalogo/page.tsx`

- [ ] **Step 1: `GET`/`PATCH` `/api/catalog`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function GET() {
  const store = await getOrCreateStore();
  if (!store) return NextResponse.json({ error: "no auth" }, { status: 401 });
  const db = supabaseAdmin();
  const { data } = await db.from("veparts_products")
    .select("*").eq("store_id", store.id).order("updated_at", { ascending: false }).limit(500);
  return NextResponse.json({ products: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const store = await getOrCreateStore();
  if (!store) return NextResponse.json({ error: "no auth" }, { status: 401 });
  const body = await req.json();
  const { id, ...fields } = body as { id: string } & Record<string, unknown>;
  const db = supabaseAdmin();
  const { error } = await db.from("veparts_products")
    .update(fields).eq("id", id).eq("store_id", store.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Página `/panel/catalogo` (lista server-side, edición inline mínima de precio/stock)**

```tsx
import { getOrCreateStore } from "@/lib/store";
import { supabaseAdmin } from "@/lib/supabase/server";

export default async function Catalogo() {
  const store = await getOrCreateStore();
  const db = supabaseAdmin();
  const { data } = await db.from("veparts_products")
    .select("*").eq("store_id", store!.id).order("name").limit(500);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Catálogo ({data?.length ?? 0})</h1>
      <table className="w-full text-sm">
        <thead><tr className="text-left border-b"><th>Parte</th><th>Vehículo</th><th>Precio</th><th>Stock</th></tr></thead>
        <tbody>
          {(data ?? []).map((p) => (
            <tr key={p.id} className="border-b">
              <td>{p.name} {p.part_brand && `(${p.part_brand})`}</td>
              <td>{p.veh_make} {p.veh_model} {p.veh_year_from ?? ""}</td>
              <td>{p.price ?? "consultar"}</td>
              <td>{p.in_stock ? "sí" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run build`
Expected: build OK; `/panel/catalogo` lista lo publicado.

```bash
git add src/app/api/catalog src/app/panel/catalogo
git commit -m "feat(panel): catalog list + patch endpoint"
```

---

## Fase 5 — Buscador (motor + página interna)

> Tres funciones puras TDD: `parseQuery`, `buildQuery`, `rank`. La ruta `/api/search` las une y consulta Supabase. La página `/panel/buscar` prueba todo sin WhatsApp.

### Task 11: `parseQuery.ts` (TDD) — texto libre → {part, vehicle}

**Files:**
- Create: `src/lib/search/parseQuery.ts`
- Test: `tests/parseQuery.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { parseQuery } from "@/lib/search/parseQuery";

describe("parseQuery", () => {
  it("extrae año de 4 dígitos", () => {
    expect(parseQuery("pastillas de freno corolla 2015").year).toBe(2015);
  });
  it("deja el texto de parte sin el año", () => {
    expect(parseQuery("filtro de aceite 2018").part).toBe("filtro de aceite");
  });
  it("detecta marca conocida del vehículo", () => {
    expect(parseQuery("correa toyota corolla").make).toBe("toyota");
  });
  it("sin año devuelve year null", () => {
    expect(parseQuery("bujias ngk").year).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- tests/parseQuery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
const MAKES = ["toyota","chevrolet","ford","hyundai","kia","nissan","honda","jeep","fiat","renault","volkswagen","mitsubishi","mazda","dodge","chery"];

export type ParsedQuery = { part: string; make: string | null; year: number | null };

export function parseQuery(text: string): ParsedQuery {
  const lower = text.toLowerCase().trim();
  const yearMatch = lower.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? parseInt(yearMatch[0], 10) : null;
  const make = MAKES.find((m) => lower.includes(m)) ?? null;
  let part = lower;
  if (yearMatch) part = part.replace(yearMatch[0], "");
  part = part.replace(/\s+/g, " ").trim();
  return { part, make, year };
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- tests/parseQuery.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/parseQuery.ts tests/parseQuery.test.ts
git commit -m "feat(search): parseQuery (TDD)"
```

### Task 12: `buildQuery.ts` (TDD) — {parsed} → texto tsquery + filtros

**Files:**
- Create: `src/lib/search/buildQuery.ts`
- Test: `tests/buildQuery.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { buildTsQuery, yearFilter } from "@/lib/search/buildQuery";

describe("buildTsQuery", () => {
  it("une palabras de la parte y la marca con &", () => {
    expect(buildTsQuery({ part: "pastillas de freno", make: "toyota", year: 2015 }))
      .toBe("pastillas & de & freno & toyota");
  });
  it("ignora make null", () => {
    expect(buildTsQuery({ part: "bujias ngk", make: null, year: null })).toBe("bujias & ngk");
  });
});

describe("yearFilter", () => {
  it("año dentro de rango [from,to]", () => {
    expect(yearFilter(2015)).toEqual({ from: 2015, to: 2015 });
  });
  it("año null no filtra", () => {
    expect(yearFilter(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- tests/buildQuery.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
import type { ParsedQuery } from "@/lib/search/parseQuery";

export function buildTsQuery(q: ParsedQuery): string {
  const words = `${q.part} ${q.make ?? ""}`
    .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .split(/\s+/).filter(Boolean);
  return words.join(" & ");
}

export function yearFilter(year: number | null): { from: number; to: number } | null {
  return year == null ? null : { from: year, to: year };
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- tests/buildQuery.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/buildQuery.ts tests/buildQuery.test.ts
git commit -m "feat(search): buildTsQuery + yearFilter (TDD)"
```

### Task 13: `rank.ts` (TDD) — ordena por match + distancia

**Files:**
- Create: `src/lib/search/rank.ts`
- Test: `tests/rank.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { rankResults } from "@/lib/search/rank";

const base = { id: "x", name: "p", in_stock: true, price: 10, store: { id: "s", name: "T", lat: null, lng: null } };

describe("rankResults", () => {
  it("prioriza in_stock sobre sin stock", () => {
    const out = rankResults([
      { ...base, id: "a", in_stock: false },
      { ...base, id: "b", in_stock: true },
    ], null);
    expect(out[0].id).toBe("b");
  });
  it("con ubicación, ordena por cercanía entre los que tienen stock", () => {
    const out = rankResults([
      { ...base, id: "lejos", store: { id: "s1", name: "L", lat: 10.5, lng: -67.5 } },
      { ...base, id: "cerca", store: { id: "s2", name: "C", lat: 10.25, lng: -67.6 } },
    ], { lat: 10.25, lng: -67.6 });
    expect(out[0].id).toBe("cerca");
  });
});
```

- [ ] **Step 2: Correr y ver fallar**

Run: `npm run test -- tests/rank.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
export type SearchResult = {
  id: string; name: string; in_stock: boolean; price: number | null;
  store: { id: string; name: string; lat: number | null; lng: number | null };
};

function dist(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dx = a.lat - b.lat, dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy); // euclídea simple, suficiente para ordenar local
}

export function rankResults(results: SearchResult[], loc: { lat: number; lng: number } | null): SearchResult[] {
  return [...results].sort((a, b) => {
    if (a.in_stock !== b.in_stock) return a.in_stock ? -1 : 1;
    if (loc && a.store.lat != null && b.store.lat != null) {
      return dist({ lat: a.store.lat, lng: a.store.lng! }, loc) -
             dist({ lat: b.store.lat, lng: b.store.lng! }, loc);
    }
    return 0;
  });
}
```

- [ ] **Step 4: Correr y ver pasar**

Run: `npm run test -- tests/rank.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/rank.ts tests/rank.test.ts
git commit -m "feat(search): rankResults by stock + distance (TDD)"
```

### Task 14: `GET /api/search` + página `/panel/buscar`

**Files:**
- Create: `src/app/api/search/route.ts`, `src/app/panel/buscar/page.tsx`

- [ ] **Step 1: Ruta de búsqueda (une parse + buildQuery + Supabase + rank)**

```ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { parseQuery } from "@/lib/search/parseQuery";
import { buildTsQuery, yearFilter } from "@/lib/search/buildQuery";
import { rankResults, type SearchResult } from "@/lib/search/rank";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lng = parseFloat(req.nextUrl.searchParams.get("lng") ?? "");
  if (!q.trim()) return NextResponse.json({ results: [] });

  const parsed = parseQuery(q);
  const ts = buildTsQuery(parsed);
  const yf = yearFilter(parsed.year);

  const db = supabaseAdmin();
  let query = db.from("veparts_products")
    .select("id,name,in_stock,price,veh_year_from,veh_year_to,store:veparts_stores(id,name,lat,lng)")
    .eq("published", true)
    .textSearch("search_tsv", ts, { type: "plain", config: "simple" })
    .limit(50);
  if (yf) {
    query = query.or(`and(veh_year_from.lte.${yf.to},veh_year_to.gte.${yf.from}),veh_year_from.is.null`);
  }
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const loc = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const ranked = rankResults((data ?? []) as unknown as SearchResult[], loc);
  return NextResponse.json({ parsed, results: ranked });
}
```

- [ ] **Step 2: Página interna de prueba `/panel/buscar`**

```tsx
"use client";
import { useState } from "react";

export default function Buscar() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ id: string; name: string; price: number | null; in_stock: boolean; store: { name: string } }[]>([]);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const j = await r.json();
    setRes(j.results ?? []);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buscador (prueba)</h1>
      <form onSubmit={go} className="flex gap-2">
        <input className="border px-2 py-1 flex-1" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="pastillas de freno corolla 2015" />
        <button className="border px-3 py-1 rounded">Buscar</button>
      </form>
      <ul className="divide-y text-sm">
        {res.map((r) => (
          <li key={r.id} className="py-2">
            <b>{r.name}</b> — {r.store.name} · {r.price ?? "consultar"} · {r.in_stock ? "disponible" : "sin stock"}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Probar end-to-end a mano**

Run: `npm run dev`, cargar un catálogo de prueba (Task 9) y en `/panel/buscar` escribir "pastillas de freno corolla 2015".
Expected: aparecen los productos que matchean, los con stock primero.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/search src/app/panel/buscar
git commit -m "feat(search): /api/search + internal search page"
```

### Task 15: Suite completa verde + deploy

- [ ] **Step 1: Correr toda la suite**

Run: `npm run test`
Expected: PASS — normalize (5), parseQuery (4), buildQuery (4), rank (2) = 15 tests.

- [ ] **Step 2: Build de producción**

Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Deploy a Vercel + commit final**

Conectar el repo a Vercel, cargar env vars, deploy a producción (patrón directo-a-producción de Mulfex).

```bash
git add -A && git commit -m "chore: hito 1 complete (cimientos + catalogo + buscador)"
```

---

## Self-Review (cobertura del spec)

- **Stack patrón VeLocal** → Tasks 1–5 ✓
- **Clerk app nueva solo tiendas / talleres sin cuenta** → Task 4 (auth tiendas); talleres = Plan 2 (WhatsApp) ✓ (explícito fuera de alcance)
- **Supabase compartido, tablas `veparts_*`, RLS ON** → Task 3 ✓
- **Ingesta IA (Excel/foto/PDF) + revisar antes de publicar** → Tasks 6–9 ✓
- **Catálogo: parte, marca, nº parte, precio, stock, vehículo, tsv** → Task 3 (schema) + 10 (UI) ✓
- **Matching: full-text unaccent + filtro por vehículo** → Tasks 11–14 ✓
- **Búsqueda instantánea con contacto** → Task 14 (resultados con tienda); el "contacto" real (WhatsApp/click-to-chat) se completa en Plan 2 con el canal ✓
- **Difusión/cotización** → Plan 2 (fuera de alcance, explícito) ✓
- **Integración VeChat / VeShop** → Hito 3 / fase futura (fuera de alcance) ✓
- **Monetización** → `subscription_status` existe en el schema (Task 3); el flujo de cobro real es fase posterior ✓

**Notas de consistencia:** `RawItem` (Task 5) se usa igual en normalize (6), extract (7), ingest (8), cargar (9). `ParsedQuery` (Task 11) se consume en buildQuery (12) y search route (14). `SearchResult` (Task 13) se usa en rank (13) y search route (14).
