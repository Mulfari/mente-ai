# VeLocal en VeChat — Fase 0 (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el chat de VeChat descubra negocios reales de VeLocal — al preguntar por un lugar/negocio local, responder con tarjetas accionables (WhatsApp, "Abierto ahora", "Ver perfil") más contexto genérico en prosa.

**Architecture:** 100% del lado Vercel (sin tocar el VPS). Se enchufa en el grounding que ya existe (`/api/web-context`), igual patrón que el dólar: detectar intención de "lugar/negocio" → consultar `velocal_businesses` (Supabase, service role) → devolver negocios estructurados + un hint → el cliente pinta tarjetas y el modelo redacta la prosa. **Progressive enhancement:** se construye contra el esquema ACTUAL (full-text sobre `name+description+category`, "cerca" = ciudad); cuando VeLocal agregue `tags`/`lat`/`lng`/`visible_in_vechat`, se encienden tags + distancia sin reescribir.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (`@/lib/supabase/server` con service role), el flujo de grounding existente (`webSearch.ts`, `/api/web-context`, `ChatInterface`, `MessageBubble`).

**Spec:** `docs/superpowers/specs/2026-06-19-velocal-en-vechat-design.md`

**Nota de testing:** el repo no tiene framework de tests. Las funciones puras se
verifican con un script node de aserciones (mismo patrón usado para
`clampStreamingTable`: replicar la función en un `.mjs` temporal en `C:/tmp` +
`assert`; al pasar, portar/confirmar la versión `.ts`). La integración se
verifica con `npm run build` + E2E en producción con los 2 negocios reales.

---

## File Structure

- **Create** `src/lib/localBusinesses.ts` — capa de recuperación: `searchLocalBusinesses()`, `isOpenNow()`, tipo `LocalBusiness`. Responsabilidad única: hablar con `velocal_businesses` y devolver un shape limpio.
- **Modify** `src/lib/webSearch.ts` — agregar intención `local_business` + extractor `localQuery()`.
- **Modify** `src/app/api/web-context/route.ts` — short-circuit de `local_business` antes de Tavily.
- **Modify** `src/components/ChatInterface.tsx` — pasar `_businesses` al mensaje + indicador "Buscando negocios…".
- **Create** `src/components/chat/LocalBusinessCard.tsx` — la tarjeta de negocio.
- **Modify** `src/components/chat/MessageBubble.tsx` — render de tarjetas (dos niveles).
- **Modify** `src/app/globals.css` — estilos `.lb-*` de la tarjeta.

---

## Task 1: `isOpenNow()` + esqueleto de `localBusinesses.ts`

**Files:**
- Create: `src/lib/localBusinesses.ts`
- Test: `C:/tmp/isopennow.mjs` (temporal)

- [ ] **Step 1: Escribir la función `isOpenNow` en `src/lib/localBusinesses.ts`**

```ts
// Horario VeLocal: { mon: [["08:00","22:00"]], ..., sun: [] }. Día sin rangos = cerrado.
type Hours = Record<string, [string, string][]>;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
};

/** ¿Abierto AHORA en hora de Venezuela (UTC-4, sin DST)? Respeta rangos que
 *  cruzan medianoche (p. ej. ["17:00","00:30"]). */
export function isOpenNow(hours: Hours | null | undefined, now: Date = new Date()): boolean {
  if (!hours) return false;
  const ve = new Date(now.getTime() - 4 * 3600 * 1000); // UTC-4
  const day = ve.getUTCDay();
  const mins = ve.getUTCHours() * 60 + ve.getUTCMinutes();
  // Rangos de HOY: normal [A,B); si cruza medianoche (B<A) hoy cubre [A, fin de día).
  const today = hours[DAYS[day]] ?? [];
  const openToday = today.some(([a, b]) => {
    const A = toMin(a), B = toMin(b);
    return B > A ? mins >= A && mins < B : mins >= A;
  });
  if (openToday) return true;
  // Cola de AYER que cruza medianoche (madrugada de hoy): [0,B).
  const yest = hours[DAYS[(day + 6) % 7]] ?? [];
  return yest.some(([a, b]) => {
    const A = toMin(a), B = toMin(b);
    return B < A && mins < B;
  });
}
```

- [ ] **Step 2: Test de aserciones (node)**

Crear `C:/tmp/isopennow.mjs` con la MISMA función + casos (replicar el cuerpo, no importar la .ts):

```js
// ...pegar isOpenNow y toMin/DAYS aquí...
let ok = 0, fail = 0;
const at = (iso) => new Date(iso); // hora UTC; -4 = VE
const eq = (n, got, want) => { if (got === want) ok++; else { fail++; console.log("FAIL", n, got, "!=", want); } };
const H = { mon: [["08:00","22:00"]], fri: [["17:00","00:30"]], sat: [["12:00","00:30"]], sun: [] };
// lunes 14:00 VE = 18:00 UTC
eq("lun abierto", isOpenNow(H, at("2026-06-15T18:00:00Z")), true);
// lunes 23:00 VE = 03:00Z martes -> cerrado (cierra 22:00)
eq("lun cerrado noche", isOpenNow(H, at("2026-06-16T03:00:00Z")), false);
// sábado 00:15 VE (sale del viernes 17:00-00:30) = 04:15Z sab
eq("madrugada sab por viernes", isOpenNow(H, at("2026-06-20T04:15:00Z")), true);
// domingo cerrado
eq("dom cerrado", isOpenNow(H, at("2026-06-21T16:00:00Z")), false);
console.log(`${ok} ok, ${fail} fail`); process.exit(fail ? 1 : 0);
```

Run: `node C:/tmp/isopennow.mjs`
Expected: `4 ok, 0 fail`

- [ ] **Step 3: Commit**

```bash
git add src/lib/localBusinesses.ts
git commit -m "feat(velocal): isOpenNow (horario VeLocal en hora de Venezuela)"
```

---

## Task 2: `searchLocalBusinesses()` + tipo `LocalBusiness`

**Files:**
- Modify: `src/lib/localBusinesses.ts`

- [ ] **Step 1: Agregar el tipo y la función**

Usa `createServiceClient` (service role) como las demás rutas server-side. Verifica primero cómo se obtiene el cliente service-role en el repo (`src/lib/supabase/server.ts` — buscar la función que usa `SUPABASE_SERVICE_ROLE_KEY`). Asumiendo `createServiceClient()`:

```ts
import { createServiceClient } from "@/lib/supabase/server"; // AJUSTAR al nombre real

export type LocalBusiness = {
  slug: string; name: string; category: string | null; city: string | null;
  description: string | null; whatsapp: string | null; instagram: string | null;
  mapsUrl: string | null; logoUrl: string | null; hours: Hours | null;
  openNow: boolean; distanceKm?: number;
};

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const R = 6371, d = Math.PI / 180;
  const dLat = (bLat - aLat) * d, dLng = (bLng - aLng) * d;
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export async function searchLocalBusinesses(opts: {
  city?: string | null; term: string; lat?: number | null; lng?: number | null; limit?: number;
}): Promise<LocalBusiness[]> {
  const { city, term, lat, lng, limit = 5 } = opts;
  if (!term?.trim()) return [];
  const supabase = createServiceClient();

  // Esquema ACTUAL: name, category, city, description, whatsapp, instagram,
  // maps_url, logo_url, hours, active. (tags/lat/lng/visible_in_vechat se
  // agregan cuando VeLocal migre; ver Task 2b para encenderlos.)
  let q = supabase
    .from("velocal_businesses")
    .select("slug,name,category,city,description,whatsapp,instagram,maps_url,logo_url,hours")
    .eq("active", true)
    .limit(limit * 4); // traer de más; rankeamos en JS
  if (city) q = q.ilike("city", city);
  // Match de texto: textSearch en español sobre las columnas concatenadas no es
  // directo en supabase-js; usamos ilike OR sobre name/description/category.
  const t = term.trim();
  q = q.or(`name.ilike.%${t}%,description.ilike.%${t}%,category.ilike.%${t}%`);

  const { data, error } = await q;
  if (error || !data) return [];

  let rows = data.map((b: any): LocalBusiness => ({
    slug: b.slug, name: b.name, category: b.category, city: b.city,
    description: b.description, whatsapp: b.whatsapp, instagram: b.instagram,
    mapsUrl: b.maps_url, logoUrl: b.logo_url, hours: b.hours,
    openNow: isOpenNow(b.hours),
  }));

  // Ranking: abiertos primero; (distancia se enchufa en Task 2b).
  rows.sort((a, b) => Number(b.openNow) - Number(a.openNow));
  return rows.slice(0, limit);
}
```

> Nota: el `.or(...ilike%term%)` es el puente del esquema actual. Cuando VeLocal
> agregue una columna `search_vector` (tsvector) + `tags`, se reemplaza por
> `.textSearch('search_vector', term, { type: 'websearch', config: 'spanish' })`
> en Task 2b — sin tocar el resto.

- [ ] **Step 2: Test de aserciones (node, contra Supabase real con los 2 negocios)**

Crear `C:/tmp/searchbiz.mjs` que llame al endpoint o, más simple, valide la query con el MCP de Supabase manualmente:
`select slug,name from velocal_businesses where active and city ilike 'Maracay' and (name ilike '%desayuno%' or description ilike '%desayuno%' or category ilike '%desayuno%')` → revisar si pega Mantuano (probablemente NO con "desayuno" → confirma la necesidad de sinónimos en Task 3).
Probar con `'%café%'` → debe traer Mantuano.

- [ ] **Step 3: Commit**

```bash
git add src/lib/localBusinesses.ts
git commit -m "feat(velocal): searchLocalBusinesses (esquema actual + openNow ranking)"
```

---

## Task 3: Intención `local_business` + extractor en `webSearch.ts`

**Files:**
- Modify: `src/lib/webSearch.ts`

Primero LEER `webSearch.ts` para ver la forma de `searchIntent` y `shouldSearchWeb` (no romper). Agregar:

- [ ] **Step 1: `localQuery(question)` que detecta intención y extrae término**

```ts
// Señales de "buscar lugar/negocio". OJO: NO debe disparar con trámites.
const LOCAL_HINTS = /\b(d[oó]nde|cerca|cercan[oa]|recomienda|recomiéndame|un (sitio|lugar|local|negocio)|ll[eé]vame|para (comer|cenar|almorzar|desayunar|tomar))\b/i;
const CONSUMO = /\b(comer|cenar|almorzar|desayun\w*|caf[eé]|restaurante|tasca|bar|pizza|hamburgues\w*|arepa\w*|postre|dulce|delivery|comprar|farmacia|peluquer[ií]a|barber[ií]a|taller)\b/i;
const TRAMITE = /\b(saime|seniat|rif|pasaporte|c[eé]dula|tr[aá]mite|gob\.ve|registro)\b/i;
// sinónimos -> término de búsqueda (puente hasta que VeLocal tenga tags)
const SYN: Record<string, string> = {
  desayun: "café", brunch: "café", "comida rápida": "hamburgues", parrilla: "carne",
};

export function localQuery(question: string): { term: string } | null {
  const q = question.toLowerCase();
  if (TRAMITE.test(q)) return null;                 // trámite, no negocio
  if (!LOCAL_HINTS.test(q) && !CONSUMO.test(q)) return null;
  const m = q.match(CONSUMO);
  let term = m ? m[0] : "";
  for (const k in SYN) if (q.includes(k)) term = SYN[k];
  if (!term) return null;
  return { term };
}
```

- [ ] **Step 2: Test (node) de `localQuery`**

`C:/tmp/localq.mjs` con la función + casos:
```
eq("desayuno -> café", localQuery("¿dónde desayuno cerca?")?.term, "café");
eq("hamburguesas", localQuery("hamburguesas en Maracay")?.term, "hamburgues");
eq("trámite NO", localQuery("¿dónde saco el RIF?"), null);
eq("general NO", localQuery("¿a cuánto el dólar?"), null);
```
Run: `node C:/tmp/localq.mjs` → todo ok.

- [ ] **Step 3: Commit**

```bash
git add src/lib/webSearch.ts
git commit -m "feat(velocal): deteccion de intencion lugar/negocio + sinonimos"
```

---

## Task 4: Short-circuit en `/api/web-context`

**Files:**
- Modify: `src/app/api/web-context/route.ts`

LEER la ruta primero (ya tiene el short-circuit del dólar — replicar ese patrón). La ciudad del usuario: ver cómo el feed obtiene `visitorCity` (user_context/IP) y reusarlo; si la request ya trae city/lat/lng del cliente, mejor (Task 5 las manda).

- [ ] **Step 1: Antes de Tavily, agregar el bloque local_business**

```ts
import { searchLocalBusinesses } from "@/lib/localBusinesses";
import { localQuery } from "@/lib/webSearch";
// ... dentro del POST, después de validar `question`, ANTES de Tavily:
const lq = localQuery(question);
if (lq) {
  const { city, lat, lng } = body; // el cliente los manda (Task 5)
  const businesses = await searchLocalBusinesses({ city, term: lq.term, lat, lng });
  if (businesses.length > 0) {
    const list = businesses.map(b =>
      `${b.name} (${b.category ?? ""}${b.openNow ? ", abierto ahora" : ""})`).join("; ");
    const answerHint =
      `Negocios locales reales en VeChat para "${lq.term}"${city ? " en " + city : ""}: ${list}. ` +
      `Recomiéndalos en una frase natural y cálida. NO repitas sus datos (WhatsApp, ` +
      `horario) — ya salen en tarjetas. Si falta algo, agrega contexto general breve.`;
    return NextResponse.json({ used: true, kind: "local_business", businesses, answerHint });
  }
  // 0 negocios -> NO cortar: sigue al flujo normal (Tavily/genérico).
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: compila sin errores.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/web-context/route.ts
git commit -m "feat(velocal): grounding de negocios locales en web-context (short-circuit)"
```

---

## Task 5: Cablear en `ChatInterface` (ubicación + businesses en el mensaje)

**Files:**
- Modify: `src/components/ChatInterface.tsx`

LEER cómo ChatInterface llama a `/api/web-context` y cómo guarda `_sources`/`_grounded` en el mensaje (replicar para `_businesses`). El tipo `Message` ya tiene `_sources`; agregar `_businesses?: LocalBusiness[]` y `_status` ya soporta "searching".

- [ ] **Step 1: Tipo + estado**

En el tipo `Message`: `_businesses?: import("@/lib/localBusinesses").LocalBusiness[];`

- [ ] **Step 2: Mandar city/lat/lng al web-context + guardar businesses**

Donde se hace `fetch('/api/web-context', { body: JSON.stringify({ question }) })`, agregar `city` (del perfil/user_context que ya tiene el cliente) y, si está disponible, `lat/lng` (geolocalización — Task 6). Al recibir `{ kind: 'local_business', businesses }`, guardarlos en el mensaje (`_businesses`) y marcar `_status` para el indicador.

- [ ] **Step 3: Indicador "Buscando negocios cerca…"**

Reusar el mecanismo de `_status` (hoy "searching" → "Buscando en internet"). Agregar variante: si la intención es local, `_status = "searching_local"` → MessageBubble muestra "Buscando negocios cerca…".

- [ ] **Step 4: Build + Commit**

```bash
npm run build
git add src/components/ChatInterface.tsx
git commit -m "feat(velocal): pasar ubicacion + guardar negocios en el mensaje"
```

---

## Task 6: Ubicación del usuario (geolocalización, opcional/progresiva)

**Files:**
- Modify: `src/components/ChatInterface.tsx` (o un hook `src/lib/useUserLocation.ts`)

> Nota: hoy los negocios NO tienen `lat/lng`, así que la distancia aún no aplica.
> Esta tarea deja LISTO el cableo: pide geoloc y la manda; cuando VeLocal tenga
> coordenadas, la distancia se activa sola (Task 2b). Si se prefiere, diferir a
> cuando VeLocal migre.

- [ ] **Step 1: Hook `useUserLocation`**: `navigator.geolocation.getCurrentPosition` con permiso, contextual (al hacer la 1ª pregunta local o un toggle), cachear en estado/localStorage. Fallback: sin permiso → undefined (se usa city).
- [ ] **Step 2:** pasar `lat/lng` al `/api/web-context` cuando existan.
- [ ] **Step 3: Build + Commit.**

---

## Task 7: `LocalBusinessCard` + estilos

**Files:**
- Create: `src/components/chat/LocalBusinessCard.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: El componente**

```tsx
import type { LocalBusiness } from "@/lib/localBusinesses";

export default function LocalBusinessCard({ b }: { b: LocalBusiness }) {
  const wa = b.whatsapp ? `https://wa.me/${b.whatsapp.replace(/[^\d]/g, "")}` : null;
  return (
    <div className="lb-card">
      {b.logoUrl ? (
        <img className="lb-logo" src={b.logoUrl} alt="" />
      ) : (
        <div className="lb-logo lb-logo--ph">{b.name.charAt(0)}</div>
      )}
      <div className="lb-body">
        <div className="lb-top">
          <span className="lb-name">{b.name}</span>
          {b.openNow && <span className="lb-open">Abierto ahora</span>}
        </div>
        {b.category && <div className="lb-cat">{b.category}{b.distanceKm != null ? ` · ${b.distanceKm.toFixed(1)} km` : ""}</div>}
        <div className="lb-actions">
          <a className="lb-btn lb-btn--profile" href={`https://velocal.vercel.app/${b.slug}`} target="_blank" rel="noopener noreferrer">Ver perfil</a>
          {wa && <a className="lb-btn lb-btn--wa" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {b.mapsUrl && <a className="lb-btn" href={b.mapsUrl} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Estilos `.lb-*` en `globals.css`** (tokens de marca: surface, border, primary; abierto = verde; botón WhatsApp = verde). Patrón compacto, tarjeta con `--surface`, borde `--border`, radio 14px.

- [ ] **Step 3: Build + Commit.**

```bash
git add src/components/chat/LocalBusinessCard.tsx src/app/globals.css
git commit -m "feat(velocal): LocalBusinessCard (logo, abierto ahora, WhatsApp, perfil)"
```

---

## Task 8: Render de dos niveles en `MessageBubble` + indicador

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

LEER cómo MessageBubble renderiza el sello `_sources` (`cb-sources`) y el indicador de "Buscando en internet" (replicar).

- [ ] **Step 1:** Si `message._businesses?.length`, renderizar un bloque "Negocios cerca de ti" con `<LocalBusinessCard b={b} />` (máx 4) ENCIMA/junto a la prosa del modelo.
- [ ] **Step 2:** Indicador: cuando `_status === "searching_local"`, mostrar "Buscando negocios cerca…" (mismo estilo que el de internet).
- [ ] **Step 3: Build + Commit.**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat(velocal): tarjetas de negocios (dos niveles) + indicador en el chat"
```

---

## Task 9: E2E en producción + deploy

- [ ] **Step 1:** push a main (auto-deploy) y esperar.
- [ ] **Step 2:** Con un usuario de prueba en Maracay (ciudad en user_context):
  - "¿dónde tomo un café en Maracay?" → tarjeta **Mantuano** (Abierto ahora según hora) + botón WhatsApp + Ver perfil.
  - "una tasca en Maracay" → tarjeta **La Vid**.
  - "¿a cuánto el dólar?" → NO dispara negocios (regresión).
  - "hamburguesas en Maracay" → sin match real → cae a genérico (esperado hasta que haya un negocio de hamburguesas / tags).
- [ ] **Step 3:** Limpiar usuario de prueba.

---

## Task 2b (futuro, cuando VeLocal migre): encender tags + distancia

- [ ] En `searchLocalBusinesses`: filtrar `visible_in_vechat`, reemplazar el `.or(ilike)` por `.textSearch('search_vector', term, { type: 'websearch', config: 'spanish' })`, seleccionar `lat,lng,neighborhood`, y rankear por `haversineKm(userLat,userLng,b.lat,b.lng)` (cuando hay geo) antes de openNow. Sin tocar el resto.

---

## Self-review

- **Cobertura del spec:** recuperación (T2), intención (T3), grounding (T4), cableo+ubicación (T5,T6), tarjeta (T7), dos niveles+indicador (T8), E2E (T9), progressive enhancement (T2b). ✔
- **Sin placeholders de lógica:** `isOpenNow`, `searchLocalBusinesses`, `localQuery`, la tarjeta y el `answerHint` van con código real. Los pasos de integración (T4/T5/T8) requieren LEER el archivo destino primero (indicado) porque dependen de la forma exacta del código existente — son cambios de cableado siguiendo patrones ya presentes (dólar, `_sources`), no lógica nueva.
- **Consistencia de tipos:** `LocalBusiness` (T2) se usa igual en T5/T7/T8; `localQuery().term` alimenta `searchLocalBusinesses({ term })`; `_businesses` es `LocalBusiness[]`.
