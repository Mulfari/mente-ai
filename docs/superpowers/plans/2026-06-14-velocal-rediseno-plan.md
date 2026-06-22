# VeLocal Rediseño — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar VeLocal de UI de scaffold a calidad premium: identidad propia, sistema de tokens, 8 temas curados por negocio, y rediseño de las 3 superficies (Vitrina IG-native, landing editorial, panel con preview en vivo) — más Clerk en producción con subdominio.

**Architecture:** Next 16 + Tailwind v4. Tokens y temas en CSS variables; los temas se aplican a la Vitrina inyectando variables en el contenedor raíz desde un módulo `themes.ts` (data pura) + columna `velocal_businesses.theme`. Componentes UI reutilizables en `src/components/`. La calidad visual se ejecuta guiada por la skill de diseño (anti-genérico).

**Tech Stack:** Next 16, Tailwind v4, `next/font/google` (Fraunces + Inter), `lucide-react` (iconos), Supabase, Clerk (production). Spec: `docs/superpowers/specs/2026-06-14-velocal-rediseno-design.md`.

---

## File Structure

```
velocal/src/
  app/
    layout.tsx              # fonts (Fraunces+Inter) + ClerkProvider
    globals.css             # tokens de marca VeLocal + @theme Tailwind
    page.tsx                # LANDING editorial (rediseño)
    [slug]/page.tsx         # VITRINA pública (rediseño dir. B, themed)
    (dashboard)/panel/
      page.tsx              # server: carga negocio
      PanelClient.tsx       # form por secciones + live preview + theme picker
  lib/
    themes.ts               # 8 temas curados (data pura) + getTheme()
    business.ts             # +campo theme
  components/
    ui/Button.tsx           # botón (variantes)
    ui/Field.tsx            # label+input/textarea/select consistentes
    ui/Sheet.tsx            # hoja inferior (historias destacadas)
    vitrina/Vitrina.tsx     # render puro de la Vitrina (usado por /[slug] y preview)
    vitrina/StoryRow.tsx    # historias destacadas
    vitrina/PhotoGrid.tsx   # grid + lightbox
    vitrina/PhonePreview.tsx# marco de teléfono que envuelve <Vitrina>
    panel/ThemePicker.tsx   # swatches de los 8 temas
  tests/themes.test.ts
supabase/migrations/0003_velocal_theme.sql
```

Clave de diseño: **`<Vitrina>` es un componente puro** que recibe `business + theme` y se usa tanto en la página pública como en la vista previa del panel (una sola fuente de verdad → el preview es idéntico al resultado).

---

## Phase 1 — Fundación de diseño (tokens, fuentes, temas)

### Task 1.1: Temas curados (data + test)

**Files:** Create `src/lib/themes.ts`, Test `tests/themes.test.ts`

- [ ] **Step 1: Test que falla**

```ts
import { describe, it, expect } from "vitest";
import { THEMES, getTheme, DEFAULT_THEME } from "../src/lib/themes";

describe("themes", () => {
  it("hay 8 temas con keys únicas y campos completos", () => {
    expect(THEMES).toHaveLength(8);
    const keys = new Set(THEMES.map((t) => t.key));
    expect(keys.size).toBe(8);
    for (const t of THEMES) {
      for (const f of ["name","bg","surface","ink","muted","line","accent","accentInk"]) {
        expect((t as Record<string,unknown>)[f]).toBeTruthy();
      }
    }
  });
  it("getTheme cae al default ante key inválida", () => {
    expect(getTheme("no-existe").key).toBe(DEFAULT_THEME);
    expect(getTheme(undefined).key).toBe(DEFAULT_THEME);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/themes.test.ts` → FAIL.

- [ ] **Step 3: Implementar**

```ts
export type Theme = {
  key: string; name: string; dark: boolean;
  bg: string; surface: string; ink: string; muted: string; line: string;
  accent: string; accentInk: string;
};

export const THEMES: Theme[] = [
  { key:"crema",    name:"Crema",    dark:false, bg:"#FAF7F1", surface:"#FFFFFF", ink:"#1B1815", muted:"#8A8073", line:"#ECE4D7", accent:"#D24B2C", accentInk:"#FFFFFF" },
  { key:"durazno",  name:"Durazno",  dark:false, bg:"#FCF1EA", surface:"#FFFFFF", ink:"#27170F", muted:"#9A7E70", line:"#F2E0D4", accent:"#E5613B", accentInk:"#FFFFFF" },
  { key:"esmeralda",name:"Esmeralda",dark:false, bg:"#F4F6F2", surface:"#FFFFFF", ink:"#16201A", muted:"#7C887F", line:"#E2E8E0", accent:"#1F7A53", accentInk:"#FFFFFF" },
  { key:"menta",    name:"Menta",    dark:false, bg:"#F0F6F3", surface:"#FFFFFF", ink:"#13211E", muted:"#75857F", line:"#DDEAE4", accent:"#157A6E", accentInk:"#FFFFFF" },
  { key:"cobalto",  name:"Cobalto",  dark:false, bg:"#F3F5F8", surface:"#FFFFFF", ink:"#141A24", muted:"#79818F", line:"#E1E6EE", accent:"#2B5BD7", accentInk:"#FFFFFF" },
  { key:"vino",     name:"Vino",     dark:false, bg:"#F7F1F0", surface:"#FFFFFF", ink:"#23161A", muted:"#947B80", line:"#EDDDDE", accent:"#8E2B3F", accentInk:"#FFFFFF" },
  { key:"carbon",   name:"Carbón",   dark:true,  bg:"#16140F", surface:"#211E18", ink:"#F3EEE4", muted:"#A49A88", line:"#322D24", accent:"#E8A13C", accentInk:"#1B1408" },
  { key:"noche",    name:"Noche",    dark:true,  bg:"#10131B", surface:"#1A1F2B", ink:"#EDF0F6", muted:"#8C94A6", line:"#272D3B", accent:"#C9A24B", accentInk:"#1A1408" },
];

export const DEFAULT_THEME = "crema";
export function getTheme(key?: string | null): Theme {
  return THEMES.find((t) => t.key === key) ?? THEMES[0];
}
export function themeVars(t: Theme): Record<string, string> {
  return {
    "--bg": t.bg, "--surface": t.surface, "--ink": t.ink, "--muted": t.muted,
    "--line": t.line, "--accent": t.accent, "--accent-ink": t.accentInk,
  };
}
```

- [ ] **Step 4:** `npx vitest run tests/themes.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(design): temas curados de la Vitrina`.

### Task 1.2: Fuentes + tokens de marca

**Files:** Modify `src/app/layout.tsx`, `src/app/globals.css`

- [ ] **Step 1:** En `layout.tsx` cargar `Fraunces` (variable `--font-display`, weights 400/600) e `Inter` (variable `--font-sans`) con `next/font/google`; aplicarlas en `<html className>`. Mantener `ClerkProvider`.
- [ ] **Step 2:** En `globals.css` definir tokens de marca VeLocal en `:root` (`--ink #1B1815`, `--ivory #FAF7F1`, `--paper #F3EEE4`, `--muted #8A8073`, `--line #E7DFD2`, `--brand #D24B2C`, `--brand-press #B23C20`, radios, sombras) y mapear con `@theme inline` (`--color-brand`, `--font-display`, `--font-sans`). Quitar el verde/estilos viejos.
- [ ] **Step 3: Commit** `feat(design): fuentes Fraunces+Inter y tokens de marca`.

### Task 1.3: Columna `theme` + capa de datos

**Files:** Create `supabase/migrations/0003_velocal_theme.sql`, Modify `src/lib/business.ts`, `src/app/api/business/route.ts`

- [ ] **Step 1: Migración**

```sql
alter table public.velocal_businesses
  add column if not exists theme text not null default 'crema';
```

- [ ] **Step 2:** Aplicar la migración a Supabase (`swioimqjygpolttiequz`).
- [ ] **Step 3:** En `business.ts` agregar `theme: string` al tipo `Business`; en `route.ts` aceptar `theme` (validar contra `THEMES`; si inválido → `'crema'`) y pasarlo a `upsertBusiness`.
- [ ] **Step 4: Commit** `feat(db): tema por negocio`.

### Task 1.4: Iconos

- [ ] **Step 1:** `npm i lucide-react`. Crear `src/components/ui/Icon.tsx` (re-export tipado opcional) o usar imports directos. Definir convención: 1.5px, tamaños 18/20/24.
- [ ] **Step 2: Commit** `chore: lucide-react para iconografía`.

---

## Phase 2 — Componentes UI base

### Task 2.1: Button, Field, Sheet

**Files:** Create `src/components/ui/Button.tsx`, `Field.tsx`, `Sheet.tsx`

- [ ] **Step 1:** `Button` con variantes `primary` (acento), `outline`, `ghost`; tamaños; estados (loading/disabled); usa tokens. `Field` envuelve label + input/textarea/select con estilos consistentes (el panel los usa). `Sheet` = hoja inferior accesible (overlay en flujo normal, sin `position:fixed` problemático) para historias destacadas.
- [ ] **Step 2: Commit** `feat(ui): Button, Field, Sheet base`.

---

## Phase 3 — Vitrina (dirección B, themed)

### Task 3.1: Componente `<Vitrina>` puro + piezas

**Files:** Create `src/components/vitrina/Vitrina.tsx`, `StoryRow.tsx`, `PhotoGrid.tsx`, `PhonePreview.tsx`

- [ ] **Step 1:** `<Vitrina business={...} theme={Theme} />` (client-safe, sin acceso a DB) que aplica `themeVars(theme)` como `style` en el contenedor raíz y pinta TODO con `var(--bg/--surface/--ink/--accent/...)`. Estructura (spec 5a): cover + avatar superpuesto · nombre (display) + `@handle` + estado (abierto/cerrado vía `isOpenNow`) + categoría/ciudad · `StoryRow` (Menú/Promos/Horario/Mapa → abren `Sheet`) · botón **Pedir por WhatsApp** (acento) · secundarios (Cómo llegar, Instagram) · `PhotoGrid` (3 col + lightbox) · descripción · pie "Página por VeLocal". Foto real; placeholders elegantes (icono lucide) si faltan.
- [ ] **Step 2:** `PhonePreview` envuelve `<Vitrina>` en un marco de teléfono (para landing y panel).
- [ ] **Step 3: Commit** `feat(vitrina): componente Vitrina themed + piezas`.

### Task 3.2: Página pública usa `<Vitrina>`

**Files:** Modify `src/app/[slug]/page.tsx`

- [ ] **Step 1:** El server component carga `getBusinessBySlug`; si null → `notFound()`. Resuelve `getTheme(business.theme)` y renderiza `<Vitrina business theme />`. `generateMetadata` igual (OG con logo). Quitar el JSX viejo.
- [ ] **Step 2:** Verificar build local (`npx tsc --noEmit`) + `npm run build`.
- [ ] **Step 3: Commit** `feat(vitrina): página pública rediseñada`.

---

## Phase 4 — Landing editorial

### Task 4.1: Rediseño de `page.tsx`

**Files:** Modify `src/app/page.tsx`, Create `src/components/landing/*` según haga falta (Hero, Steps, Examples, CTA)

- [ ] **Step 1:** Construir la landing del spec 5b: hero asimétrico (titular Fraunces + CTA "Registrar mi negocio" + `PhonePreview` con una Vitrina de ejemplo) · 3 props de valor · cómo funciona (3 pasos) · galería de 3-4 Vitrinas de ejemplo con temas distintos (usa `<Vitrina>` con datos de muestra) · CTA final + footer. Motion sutil con CSS/IntersectionObserver, respeta reduced-motion. CTA respeta sesión (`/panel` si logueado, `/sign-up` si no).
- [ ] **Step 2: Commit** `feat(landing): rediseño editorial`.

---

## Phase 5 — Panel con preview en vivo + theme picker

### Task 5.1: ThemePicker

**Files:** Create `src/components/panel/ThemePicker.tsx`

- [ ] **Step 1:** Grilla de swatches de `THEMES` (muestra bg+acento+nombre); seleccionado marcado; `onChange(key)`.
- [ ] **Step 2: Commit** `feat(panel): selector de temas`.

### Task 5.2: Panel rediseñado con vista previa en vivo

**Files:** Modify `src/app/(dashboard)/panel/page.tsx`, replace `BusinessForm.tsx` → `PanelClient.tsx`

- [ ] **Step 1:** `PanelClient` (client) mantiene el estado del formulario (incluye `theme`) y renderiza dos zonas: formulario por **secciones** (Identidad · Contacto · Horario · Fotos · Tema con `ThemePicker`) a la izquierda y `<PhonePreview><Vitrina business={estadoActual} theme={getTheme(theme)} /></PhonePreview>` a la derecha que se actualiza EN VIVO. En móvil: form + botón "Ver" que abre el preview en `Sheet`. Subidas con preview (reutiliza `/api/upload`). Guardar postea a `/api/business` (incluye `theme`); éxito → tarjeta con link + Copiar + WhatsApp. Header marca VeLocal + `UserButton`.
- [ ] **Step 2:** `page.tsx` server pasa `initial` (incluye `theme`) y `baseUrl` a `PanelClient`.
- [ ] **Step 3:** `npx tsc --noEmit` + `npm run build`.
- [ ] **Step 4: Commit** `feat(panel): rediseño con preview en vivo y temas`.

---

## Phase 6 — Deploy del rediseño a producción

- [ ] **Step 1:** `git push` → Vercel auto-deploya. Verificar en la URL de producción: landing, una Vitrina real (probar 2-3 temas), panel (logueado lo prueba el usuario).
- [ ] **Step 2:** Revisar responsive (móvil) y contraste de temas oscuros.

---

## Phase 7 — Clerk production + subdominio

(Infra; se hace por navegador con las sesiones del usuario.)

- [ ] **Step 1:** En Vercel, proyecto `velocal` → Domains → agregar `velocal.mulfai.com.ve` (o el subdominio que el usuario confirme). Vercel crea el registro en su DNS.
- [ ] **Step 2:** En Clerk, app "VeLocal" → **Deploy to production** (crea instancia production); agregar los 5 CNAME de Clerk (clerk, accounts, clkmail, clk._domainkey, clk2._domainkey) bajo el subdominio en Vercel DNS; esperar verificación.
- [ ] **Step 3:** Tomar `pk_live`/`sk_live`; en Vercel actualizar `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` (Production) y `NEXT_PUBLIC_VELOCAL_URL=https://velocal.mulfai.com.ve`; redeploy.
- [ ] **Step 4:** Verificar `/sign-up` en el subdominio sin el banner "Development mode".

---

## Self-review

- **Cobertura del spec:** dirección/principios (Phase 1–5) ✓ · identidad de marca (1.2) ✓ · tokens (1.2) ✓ · 8 temas curados (1.1) ✓ · Vitrina B themed (3) ✓ · landing (4) ✓ · panel con preview en vivo + theme picker (5) ✓ · columna `theme`/datos (1.3) ✓ · accesibilidad/responsive (3–6 verificación) ✓ · Clerk production (7) ✓.
- **Placeholders:** la fundación (temas, fuentes, migración, datos) lleva código real y test. Las superficies (Vitrina/landing/panel) describen estructura exacta + componentes + tokens; el JSX visual se construye guiado por la skill de diseño, reutilizando `<Vitrina>` como fuente única para que preview = público.
- **Consistencia de tipos:** `Theme`, `getTheme`, `themeVars`, `Business.theme`, `<Vitrina business theme>` se usan consistentes en Phases 1, 3, 5.
- **No toca VeChat:** solo `velocal_businesses` (+columna) y el repo velocal.
