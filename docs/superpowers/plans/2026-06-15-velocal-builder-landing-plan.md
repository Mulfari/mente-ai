# VeLocal — Builder personalizable + Landing — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Un subagente por tarea, revisión entre cada una. Steps con checkbox `- [ ]`.

**Goal:** Convertir el panel en un *builder* tipo Linktree-premium (presets + ajustes profundos: tema/acento, botones+enlaces propios, imágenes, estilo) con vista previa en vivo, y construir la landing de venta. Directo a producción.

**Architecture:** La Vitrina ya es un componente puro themed (`src/components/vitrina/Vitrina.tsx`). Ampliamos el modelo de datos (links configurables, acento, estilo de botón, cover) y hacemos que la Vitrina renderice desde esa config. El panel edita esa config con preview en vivo (reusa `<Vitrina>`). La landing usa el mismo sistema de diseño (Geist + Space Grotesk, tokens, terracota).

**Tech Stack:** Next 16, Tailwind v4, Phosphor, Supabase (tabla `velocal_businesses`), Clerk. NO toca VeChat.

**Contexto de diseño (OBLIGATORIO para cada subagente):** seguir el sistema ya en el repo — `src/app/globals.css` (tokens marca: neutro frío + `--brand` terracota), `src/lib/themes.ts` (8 temas curados), `src/components/vitrina/Vitrina.tsx` (lenguaje visual). Anti-genérico: sin Inter como default (usar Geist/Space Grotesk ya instalados), sin morado-IA, sin tres-tarjetas-iguales, sin em-dash, foto-primero, AA de contraste, dark/light correctos. Premium = libertad con red de seguridad.

---

## Modelo de datos (nuevas columnas en `velocal_businesses`)

```sql
alter table public.velocal_businesses
  add column if not exists accent text,                         -- override de acento (hex) o null = usa el del tema
  add column if not exists button_style text not null default 'pill',  -- 'pill' | 'rounded' | 'outline'
  add column if not exists cover_url text,                      -- portada (separada de la galería)
  add column if not exists links jsonb not null default '[]'::jsonb;    -- botones/enlaces ordenados
```

`links` = array ordenado de objetos:
```ts
type LinkKind = "whatsapp" | "menu" | "maps" | "instagram" | "phone" | "web" | "tiktok" | "custom";
type VLink = {
  id: string;        // uuid corto
  kind: LinkKind;    // define icono por defecto y comportamiento
  label: string;     // editable
  url: string;       // wa.me/…, https://…, etc.
  icon: string;      // nombre de icono Phosphor (override opcional)
  enabled: boolean;
  primary?: boolean; // el botón protagonista (default: el de kind whatsapp)
};
```
- `primary: true` → botón grande con acento. El resto → fila de acciones / historias destacadas.
- Iconos por kind: whatsapp→WhatsappLogo, menu→ForkKnife, maps→MapPin, instagram→InstagramLogo, phone→Phone, web→Globe, tiktok→TiktokLogo, custom→Link (override por `icon`).

---

## Task 1 — Datos + helpers (FUNDACIÓN, va primero)

**Files:** `supabase/migrations/0004_velocal_builder.sql`, `src/lib/business.ts`, `src/lib/links.ts` (nuevo), `src/app/api/business/route.ts`, `tests/links.test.ts`

- [ ] Migración con las 4 columnas (arriba). Aplicar a Supabase `swioimqjygpolttiequz`.
- [ ] `src/lib/links.ts`: tipos `LinkKind`/`VLink`, `DEFAULT_ICON: Record<LinkKind,string>`, y `defaultLinks(b)` que arma los links iniciales desde los campos legacy (whatsapp→primary, menu si hay imagen, maps, instagram). Test puro: `defaultLinks` produce el whatsapp como primary y respeta los que existan.
- [ ] `business.ts`: extender `Business` con `accent?: string|null`, `button_style: string`, `cover_url?: string|null`, `links: VLink[]`. En lecturas, si `links` viene vacío, hidratar con `defaultLinks` (retrocompat con los demos).
- [ ] `route.ts`: aceptar y validar `accent` (hex válido o null), `button_style` (∈ pill/rounded/outline), `cover_url`, `links` (sanea kind/label/url/enabled). Persistir.
- [ ] Backfill de los 2 demos: `links` desde sus campos. Tests verdes. Commit.

## Task 2 — Vitrina renderiza la config

**Files:** `src/components/vitrina/Vitrina.tsx`

- [ ] Render desde `links`: el `primary` como botón grande; los demás `enabled` como fila de acciones/destacadas, en su orden, con su icono Phosphor y label.
- [ ] Aplicar `accent` override (si existe) sobre `--accent`; `button_style` (pill=rounded-2xl, rounded=rounded-xl, outline=borde+transparente con texto acento); `cover_url` como portada (fallback a galería[0]).
- [ ] Mantener calidad/spacing actual; AA en claro y oscuro. `npm run build` + `tsc` verdes. Commit.

## Task 3 — Panel = Builder con preview en vivo

**Files:** `src/app/(dashboard)/panel/page.tsx`, reemplaza `BusinessForm.tsx` por `PanelClient.tsx` + componentes en `src/components/panel/` (`Section.tsx`, `ThemePicker.tsx`, `AccentPicker.tsx`, `LinksEditor.tsx`, `ImageUploader.tsx`, `ButtonStylePicker.tsx`, `LivePreview.tsx`)

- [ ] `PanelClient` (client) con estado completo del negocio (incluye accent/button_style/cover_url/links). Dos zonas en desktop: editor (izq) + `LivePreview` (der) que renderiza `<Vitrina>` con el estado actual y se actualiza EN VIVO. Móvil: editor + botón "Vista previa" en hoja.
- [ ] Editor por secciones: **Identidad** (nombre, categoría, ciudad, logo) · **Imágenes** (logo, cover, galería con subir/quitar/reordenar, usa `/api/upload`) · **Botones y enlaces** (`LinksEditor`: lista reordenable, toggle, renombrar, marcar primary, AGREGAR enlace propio con kind+label+url+icono) · **Tema y color** (`ThemePicker` 8 temas + `AccentPicker` con acento libre) · **Estilo** (`ButtonStylePicker`: pill/rounded/outline) · **Contacto/Horario** (whatsapp, instagram, dirección, mapa; editor de horario por día).
- [ ] Guardar → POST `/api/business` con todo. Éxito → tarjeta con link público + Copiar + Enviar por WhatsApp. Header marca VeLocal + UserButton.
- [ ] `page.tsx` server pasa `initial` (con links hidratados) + `baseUrl`. `tsc` + `build` verdes. Commit.

## Task 4 — Landing de venta (paralela a 2/3)

**Files:** `src/app/page.tsx`, `src/components/landing/` (Hero, Steps, Examples, CTA, Footer)

- [ ] Landing editorial premium dirigida al dueño de negocio (ver lenguaje de diseño arriba): hero asimétrico (titular Space Grotesk + CTA "Registrar mi negocio" + un `PhonePreview` con una Vitrina real de ejemplo, foto-primero) · 3 props de valor (tu link para la bio, apareces en VeChat, gratis) · cómo funciona (3 pasos) · galería de 3-4 Vitrinas de ejemplo con temas distintos (reusa `<Vitrina>` con datos de muestra) · CTA final + footer.
- [ ] Reglas pre-flight de la skill de diseño: hero cabe en viewport, nav 1 línea, ≤1 eyebrow/3 secciones, sin em-dash, imágenes reales (picsum seed), dark/light, reduced-motion. CTA respeta sesión (`/panel` si logueado). `build` verde. Commit.

## Deploy

- [ ] Push (autor = cuenta Vercel, ya configurado) → auto-deploy. Verificar en producción: landing, panel logueado (crear/editar con preview), Vitrina pública reflejando la personalización, 2-3 temas + acento + estilo de botón + enlace propio.

## Out of scope (v1)
- Tipografías personalizables por negocio, fondos con imagen, formas avanzadas (después).
- Indexación en VeChat, catálogo/carrito, suscripción, Clerk production/dominio (specs aparte).

## Self-review
- Cobertura: editor completo (color/tema+acento Task3, botones/enlaces Task1+3, imágenes Task3, estilo Task2+3) ✓; presets+ajustes profundos (temas curados base + overrides) ✓; landing Task4 ✓; preview en vivo Task3 ✓; no toca VeChat ✓.
- Consistencia de tipos: `VLink`/`LinkKind`/`defaultLinks`, `Business.{accent,button_style,cover_url,links}` definidos en Task1 y usados en Task2/3.
- Orden: Task1 → (Task2, Task3, Task4). Task2/3 dependen de Task1; Task4 independiente.
