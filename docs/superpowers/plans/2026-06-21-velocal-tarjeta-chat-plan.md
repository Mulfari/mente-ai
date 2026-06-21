# Tarjeta de negocio en el chat (Bloque 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rediseñar la tarjeta de negocio de VeLocal en el chat (ícono por categoría, tags, WhatsApp como acción principal) y tejerla en la prosa quitando el banner "Negocios cerca de ti".

**Architecture:** Lógica pura nueva en `businessVisual.ts` (testeable con vitest). El card consume esa lógica + `waLink`. `searchLocalBusinesses` expone `tags`. MessageBubble pierde el encabezado. Estilos `.lb-*` en globals.css portados del VeChatBizCard.

**Tech Stack:** Next 16, React 19, TypeScript, Tailwind v4 (CSS en globals.css), **vitest** (nuevo, solo lógica pura).

---

## File Structure
- `vitest.config.ts` (NUEVO) — config mínima node env.
- `src/lib/businessVisual.ts` (NUEVO) — `categoryGlyph`, `formatDistanceKm`, tipo `GlyphKey`.
- `src/lib/businessVisual.test.ts` (NUEVO).
- `src/lib/phone.test.ts` (NUEVO) — caracteriza `waLink`.
- `src/lib/localBusinesses.ts` — añade `tags` al tipo + `.select`.
- `src/components/chat/BizIcon.tsx` (NUEVO) — íconos SVG inline (glyphs + WhatsApp/pin/flecha).
- `src/components/chat/LocalBusinessCard.tsx` — reescritura.
- `src/components/chat/MessageBubble.tsx` — quitar encabezado.
- `src/app/globals.css` — reestilizar `.lb-*`.

---

### Task 1: Montar vitest

**Files:** `package.json`, `vitest.config.ts` (crear), `src/lib/phone.test.ts` (crear)

- [ ] **Step 1:** Instalar: `npm i -D vitest`
- [ ] **Step 2:** Crear `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
```
- [ ] **Step 3:** Añadir script en `package.json`: `"test": "vitest run"`
- [ ] **Step 4:** Caracterizar `waLink` en `src/lib/phone.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { waLink } from "./phone";
describe("waLink", () => {
  it("0414… → 58414…", () => expect(waLink("04141234567")).toBe("https://wa.me/584141234567"));
  it("formato con símbolos", () => expect(waLink("+58 414-123 4567")).toBe("https://wa.me/584141234567"));
  it("sin 0 ni 58 antepone 58", () => expect(waLink("4141234567")).toBe("https://wa.me/584141234567"));
  it("null/vacío → null", () => { expect(waLink(null)).toBeNull(); expect(waLink("")).toBeNull(); expect(waLink("abc")).toBeNull(); });
});
```
- [ ] **Step 5:** Run `npm test` → PASS (verifica que el runner corre y waLink ya cumple).
- [ ] **Step 6:** Commit: `test: montar vitest + caracterizar waLink`

---

### Task 2: businessVisual.ts (lógica pura)

**Files:** `src/lib/businessVisual.test.ts` (crear), `src/lib/businessVisual.ts` (crear)

- [ ] **Step 1:** Test primero (`businessVisual.test.ts`):
```ts
import { describe, it, expect } from "vitest";
import { categoryGlyph, formatDistanceKm } from "./businessVisual";
describe("categoryGlyph", () => {
  it("café/panadería → coffee", () => expect(categoryGlyph("Café & panadería").icon).toBe("coffee"));
  it("tasca/vinos → wine", () => expect(categoryGlyph("Tasca & vinos").icon).toBe("wine"));
  it("hamburguesas → fork", () => expect(categoryGlyph("Hamburguesería").icon).toBe("fork"));
  it("acentos/mayúsculas insensible", () => expect(categoryGlyph("CAFÉ").icon).toBe("coffee"));
  it("desconocido/null → store (default)", () => { expect(categoryGlyph("xyz").icon).toBe("store"); expect(categoryGlyph(null).icon).toBe("store"); });
  it("trae color", () => expect(categoryGlyph("café").color).toMatch(/^#/));
});
describe("formatDistanceKm", () => {
  it("<10 → 1 decimal", () => expect(formatDistanceKm(0.4)).toBe("0.4 km"));
  it(">=10 → entero", () => expect(formatDistanceKm(12.6)).toBe("13 km"));
});
```
- [ ] **Step 2:** Run `npm test` → FAIL (módulo no existe).
- [ ] **Step 3:** Implementar `businessVisual.ts`:
```ts
export type GlyphKey = "coffee" | "wine" | "fork" | "wrench" | "scissors" | "stethoscope" | "bag" | "store";
type Glyph = { icon: GlyphKey; color: string };
const RULES: Array<{ re: RegExp; g: Glyph }> = [
  { re: /caf|coffee|panad|reposter|desayun|arepa/, g: { icon: "coffee", color: "#B45309" } },
  { re: /bar|tasca|vino|licor|cerve|pub|cocktel|coctel/, g: { icon: "wine", color: "#7C3AED" } },
  { re: /restaur|comida|burg|hamburg|pizza|parrilla|pollo|cocina|food|gastro/, g: { icon: "fork", color: "#DC2626" } },
  { re: /ferret|repuest|taller|mecan|caucho|servic|tecnic/, g: { icon: "wrench", color: "#0E8F6F" } },
  { re: /pelu|barber|estetic|spa|salon|uñas|unas|belleza/, g: { icon: "scissors", color: "#DB2777" } },
  { re: /farmac|salud|clinic|medic|dental|odont/, g: { icon: "stethoscope", color: "#2563EB" } },
  { re: /tienda|boutique|moda|ropa|market|abasto|bodeg|licorer/, g: { icon: "bag", color: "#0891B2" } },
];
const DEFAULT: Glyph = { icon: "store", color: "#10A37F" };
export function categoryGlyph(category: string | null | undefined): Glyph {
  const c = (category ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  for (const r of RULES) if (r.re.test(c)) return r.g;
  return DEFAULT;
}
export function formatDistanceKm(km: number): string {
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
```
- [ ] **Step 4:** Run `npm test` → PASS.
- [ ] **Step 5:** Commit: `feat(velocal): businessVisual (ícono por categoría + distancia)`

---

### Task 3: Exponer `tags` en los datos

**Files:** `src/lib/localBusinesses.ts`

- [ ] **Step 1:** En el tipo `LocalBusiness` añadir `tags: string[];` (después de `hours`).
- [ ] **Step 2:** En `searchLocalBusinesses`, añadir `tags` al `.select("…,temporarily_closed,tags")`.
- [ ] **Step 3:** En el `.map`, añadir `tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],`.
- [ ] **Step 4:** Run `npx tsc --noEmit` (o `npm run build`) → sin errores de tipo.
- [ ] **Step 5:** Commit: `feat(velocal): exponer tags del negocio para la UI`

---

### Task 4: BizIcon (SVG inline)

**Files:** `src/components/chat/BizIcon.tsx` (crear)

- [ ] **Step 1:** Crear componente con un path por glyph + íconos de acción (whatsapp, pin, arrow). Stroke `currentColor`. (Código completo en la implementación; un `<svg>` con `<path d={MAP[name]}>`.) Tipos: `name: GlyphKey | "whatsapp" | "pin" | "arrow"`.
- [ ] **Step 2:** `npm run build` → compila.
- [ ] **Step 3:** Commit: `feat(velocal): BizIcon (set de íconos inline)`

---

### Task 5: Reescribir LocalBusinessCard

**Files:** `src/components/chat/LocalBusinessCard.tsx`

- [ ] **Step 1:** Reescribir: logo = `logoUrl` ? img : ícono de categoría (mosaico color de `categoryGlyph`) : inicial. Nombre + pill Abierto/Cerrado. Meta (categoría · barrio · `formatDistanceKm`). Tags (máx 3) como chips. Acciones: WhatsApp (principal) + Ver perfil + Cómo llegar.
- [ ] **Step 2:** `npm run build` → compila.
- [ ] **Step 3:** Commit: `feat(velocal): tarjeta nueva (ícono, tags, WhatsApp principal)`

---

### Task 6: Quitar el banner en MessageBubble

**Files:** `src/components/chat/MessageBubble.tsx:329-335`

- [ ] **Step 1:** Eliminar el `<span className="lb-cards-head">…Negocios cerca de ti</span>` (líneas ~330-335); conservar `<div className="lb-cards">` + el `.map` de cards.
- [ ] **Step 2:** `npm run build` → compila.
- [ ] **Step 3:** Commit: `feat(velocal): quitar banner 'Negocios cerca de ti' (tejido en la prosa)`

---

### Task 7: Reestilizar .lb-* (globals.css)

**Files:** `src/app/globals.css`

- [ ] **Step 1:** Portar estilos VeChatBizCard: `.lb-card` (radio 18, padding 14, sombra sutil, gap), `.lb-logo` (mosaico 50px color de categoría vía var inline), pill `.lb-open`/`.lb-closed`, `.lb-tags`/`.lb-tag` (chips), `.lb-actions` columna, `.lb-btn--wa` (verde principal ancho) + `.lb-btn--profile`/`.lb-btn--map` (fila secundaria). Tokens de marca (claro + oscuro).
- [ ] **Step 2:** `npm run build` → compila.
- [ ] **Step 3:** Commit: `style(velocal): tarjeta VeChatBizCard (claro+oscuro)`

---

### Task 8: Verificación + merge + deploy

- [ ] **Step 1:** `npm test` → todo verde.
- [ ] **Step 2:** `npm run build` → ok.
- [ ] **Step 3:** Merge a main + push (auto-deploy Vercel).
- [ ] **Step 4:** E2E en vivo (navegador de Jose): preguntar por un negocio real (ej. "dónde desayuno en Maracay") → revisar tarjeta nueva (ícono, WhatsApp principal, sin banner). Corregir lo que salga.

---

## Self-Review
- **Cobertura del spec:** logo-ícono (T2,T5) ✓ · tags (T3,T5) ✓ · WhatsApp principal (T5) ✓ · quitar banner (T6) ✓ · estilos (T7) ✓ · vitest (T1,T2) ✓ · mapa diferido (no task) ✓.
- **Placeholders:** la lógica testeable lleva código completo; T4/T5/T7 (UI/CSS) describen estructura — se completan en ejecución (mismo autor, misma sesión).
- **Consistencia de tipos:** `GlyphKey`, `categoryGlyph`, `formatDistanceKm`, `LocalBusiness.tags`, `waLink` usados igual en todas las tasks.
