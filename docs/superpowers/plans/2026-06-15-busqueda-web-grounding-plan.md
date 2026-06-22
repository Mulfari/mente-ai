# Búsqueda web / grounding — Plan de implementación (Fase 1)

> **Para workers agénticos:** SUB-SKILL REQUERIDA: usar superpowers:subagent-driven-development o superpowers:executing-plans para ejecutar tarea por tarea. Los pasos usan checkboxes (`- [ ]`).

**Goal:** Que VeChat busque en internet y responda con fuentes citadas cuando la pregunta es de actualidad/factual, sin romper el chat actual ni añadir latencia a las conversaciones normales.

**Architecture:** Todo en la capa **Next/cliente** — CERO cambios en el VPS para la Fase 1. Un detector heurístico decide si la pregunta necesita web; si sí, el cliente muestra "Buscando en internet…", pide fuentes a un endpoint nuevo `/api/web-context` (Tavily, la key vive en el server), y **augmenta el campo `question`** que ya se le manda al VPS con las fuentes + instrucción de citar. El usuario sigue viendo su pregunta original (lo que se guarda en BD no cambia); solo el modelo ve la versión aumentada. Si la búsqueda falla o tarda, se cae con gracia a la respuesta sin grounding (el chat funciona igual que hoy).

**Tech Stack:** Next.js (App Router), TypeScript, Clerk (auth de la ruta), Tavily Search API, el VPS orchestrator existente (sin tocar). Verificación: `npm run build` + `eslint` + E2E en producción con Playwright (el repo no tiene runner de tests unitarios).

---

## Por qué esto NO rompe la app (principios de seguridad del plan)

1. **Ruta nueva activa solo en preguntas "de búsqueda".** En un chat normal (`shouldSearchWeb === false`) no se llama nada nuevo, no hay indicador y **no hay latencia extra**. El camino de streaming actual queda intacto.
2. **Degradación con gracia.** Si `/api/web-context` falla, da timeout o no hay `TAVILY_API_KEY`, devuelve `{ used: false }` y el cliente envía la pregunta **original** al VPS — exactamente el comportamiento de hoy.
3. **Cero cambios en el VPS** (Fase 1). El `question` aumentado se manda en el mismo payload; el VPS lo reenvía al modelo tal cual. La tarea de VPS (system prompt anti-alucinación) es **opcional, aparte y con rollback**.
4. **El usuario ve su pregunta original.** La fila de `messages` (role user) se guarda con `userMsg` (sin tocar, `ChatInterface.tsx:1633`); el título de la conversación usa `userMsg`. Solo el payload al modelo lleva el texto aumentado.
5. **Rollout oscuro→encendido.** Se despliega el código con el feature "apagado" (sin key) → se prueba que nada cambió → se agrega `TAVILY_API_KEY` → se enciende.

## Sobre la latencia (lo que preguntó el usuario)

- La latencia extra ocurre **solo cuando se busca** (una llamada a Tavily, ~1–2 s).
- Mitigaciones: (a) detector heurístico → los chats normales no pagan nada; (b) **caché en memoria** por query normalizada (el "dólar de hoy" lo preguntan muchos); (c) **timeout de 4 s** con fallback a sin-grounding; (d) el indicador **"Buscando en internet…"** maneja la percepción de la espera.

## Mapa de archivos

- **Crear** `src/lib/webSearch.ts` — funciones puras isomórficas: `shouldSearchWeb(q)` (detector) y `buildGroundedQuestion(q, sources)` (arma el prompt aumentado). Tipo `WebSource`.
- **Crear** `src/app/api/web-context/route.ts` — endpoint server: auth Clerk, re-chequea detector, llama Tavily, caché, devuelve `{ used, sources }`.
- **Modificar** `src/components/ChatInterface.tsx` — helper `groundQuestionIfNeeded()` + llamarlo en los dos caminos de envío (typed `sendMessage` y `submitSuggestion`); tipo `Message` gana `_status?: 'searching'`.
- **Modificar** `src/components/chat/MessageBubble.tsx` — píldora "Buscando en internet…" cuando `message._status === 'searching'` y aún no hay texto.
- **Modificar** `src/app/globals.css` — estilos de la píldora (si hace falta más allá de utilidades existentes).
- **Vercel env** — agregar `TAVILY_API_KEY`.
- **Seguridad (aparte)** `src/app/api/research/route.ts` — sacar el password a env / deprecar.
- **Opcional/VPS (aparte)** — regla anti-alucinación en el system prompt del orchestrator.

---

## Task 1: Librería pura `webSearch.ts`

**Files:**
- Create: `src/lib/webSearch.ts`

- [ ] **Step 1: Crear la librería con el detector y el constructor del prompt**

```ts
// src/lib/webSearch.ts
// Funciones PURAS e isomórficas (server + cliente), sin dependencias.
// shouldSearchWeb: heurística barata para decidir si una pregunta necesita
// información fresca de internet. buildGroundedQuestion: arma el texto que se
// le manda al modelo (campo `question`) inyectando las fuentes + instrucción.

export type WebSource = { title: string; url: string; snippet: string };

// Señales de "esto necesita web": actualidad, precios, resultados, fechas,
// trámites y disparadores temporales. Es deliberadamente conservadora: ante la
// duda NO busca (mejor no añadir latencia a un chat normal). Los falsos
// negativos se cubren en la Fase 2 (clasificador). Acentos opcionales.
const SEARCH_SIGNALS: RegExp[] = [
  /\b(hoy|ahora|actual(es|mente)?|reciente|último|ultima|de\s+este\s+(a[ñn]o|mes))\b/i,
  /\b(precio|cu[áa]nto\s+(cuesta|vale|est[áa])|tasa|d[óo]lar|euro|bcv|paralelo)\b/i,
  /\b(qui[ée]n\s+gan[óo]|resultado|marcador|mundial|eliminatorias|clasific)\b/i,
  /\b(noticia|pas[óo]|ocurri[óo]|sucedi[óo]|estren[óo])\b/i,
  /\b(cu[áa]ndo|qu[ée]\s+d[íi]a|fecha\s+de)\b/i,
  /\b(saime|seniat|cita|tr[áa]mite|requisitos)\b/i,
  /\b20(2[4-9]|3\d)\b/, // años 2024..2039
];

export function shouldSearchWeb(question: string): boolean {
  const q = (question || "").trim();
  if (q.length < 6) return false;
  return SEARCH_SIGNALS.some((re) => re.test(q));
}

// Recorta un snippet para acotar el tamaño del prompt aumentado.
function trimSnippet(s: string, max = 320): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Construye el `question` aumentado. El usuario NO ve esto; solo el modelo.
export function buildGroundedQuestion(question: string, sources: WebSource[]): string {
  if (!sources || sources.length === 0) return question;
  const today = new Date().toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
  const list = sources
    .map((s, i) => `${i + 1}. ${s.title} — ${trimSnippet(s.snippet)}\n   Fuente: ${s.url}`)
    .join("\n");
  return [
    `INSTRUCCIONES: Para datos actuales o factuales responde USANDO SOLO la información de internet de abajo. Cita las fuentes relevantes con enlaces markdown [título](url). Si la información no alcanza para responder, dilo claramente y NO inventes.`,
    ``,
    `INFORMACIÓN DE INTERNET (consultada el ${today}):`,
    list,
    ``,
    `PREGUNTA DEL USUARIO:`,
    question,
  ].join("\n");
}
```

- [ ] **Step 2: Verificar tipos y comportamiento**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

Comportamiento esperado (chequeo manual rápido — el repo no tiene runner unitario):
- `shouldSearchWeb("¿A cuánto está el dólar hoy?")` → `true`
- `shouldSearchWeb("¿Venezuela clasificó al mundial?")` → `true`
- `shouldSearchWeb("escríbeme un poema sobre el mar")` → `false`
- `shouldSearchWeb("hola")` → `false`
- `buildGroundedQuestion("X", [])` → devuelve `"X"` sin cambios.

- [ ] **Step 3: Commit**

```bash
git add src/lib/webSearch.ts
git commit -m "feat: lib pura para detectar y construir preguntas con grounding web"
```

---

## Task 2: Endpoint `/api/web-context` (Tavily)

**Files:**
- Create: `src/app/api/web-context/route.ts`

- [ ] **Step 1: Crear la ruta**

```ts
// src/app/api/web-context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { shouldSearchWeb, type WebSource } from "@/lib/webSearch";

export const runtime = "nodejs";

const TAVILY_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 5;
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 15 * 60 * 1000;

// Caché best-effort en memoria del proceso (por instancia de función). No es
// global pero corta el costo de queries repetidas dentro de una instancia.
const cache = new Map<string, { at: number; sources: WebSource[] }>();
function cacheGet(key: string): WebSource[] | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.sources;
  if (hit) cache.delete(key);
  return null;
}
function cacheSet(key: string, sources: WebSource[]) {
  cache.set(key, { at: Date.now(), sources });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ used: false, sources: [] }, { status: 401 });

  let question = "";
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ used: false, sources: [] });
  }

  // Re-chequeo server-side del detector (defensa) y guardas.
  if (!question || !shouldSearchWeb(question)) {
    return NextResponse.json({ used: false, sources: [] });
  }
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // Feature "apagado": sin key, no se busca → el chat sigue normal.
    return NextResponse.json({ used: false, sources: [] });
  }

  const key = question.trim().toLowerCase().slice(0, 200);
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ used: cached.length > 0, sources: cached });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: question,
        max_results: MAX_RESULTS,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return NextResponse.json({ used: false, sources: [] });
    const data = await res.json();
    const sources: WebSource[] = (data.results || [])
      .slice(0, MAX_RESULTS)
      .map((r: any) => ({ title: r.title || r.url, url: r.url, snippet: r.content || "" }))
      .filter((s: WebSource) => s.url);
    cacheSet(key, sources);
    return NextResponse.json({ used: sources.length > 0, sources });
  } catch {
    // Timeout o error de red → sin grounding, el chat sigue.
    return NextResponse.json({ used: false, sources: [] });
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✓ Compiled successfully` y la ruta `ƒ /api/web-context` aparece en el listado.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/web-context/route.ts
git commit -m "feat: /api/web-context — busca en Tavily con cache, timeout y fallback"
```

---

## Task 3: Cablear el grounding en los envíos (ChatInterface)

**Files:**
- Modify: `src/components/ChatInterface.tsx`

- [ ] **Step 1: Importar la lib (junto a los otros imports `@/lib`)**

```ts
import { shouldSearchWeb, buildGroundedQuestion, type WebSource } from "@/lib/webSearch";
```

- [ ] **Step 2: Añadir `_status` al tipo `Message`**

En la definición de `type Message = { ... }` añadir:

```ts
  _status?: "searching";
```

- [ ] **Step 3: Añadir el helper `groundQuestionIfNeeded` dentro del componente**

Colocarlo junto a las otras funciones internas (p. ej. cerca de `sendMessage`). Recibe la pregunta original y el id del mensaje del asistente; si toca buscar, marca `_status:'searching'`, pide fuentes y devuelve la pregunta aumentada (o la original si no hubo fuentes / falló).

```ts
  async function groundQuestionIfNeeded(originalQuestion: string, assistantMsgId: string): Promise<string> {
    if (!shouldSearchWeb(originalQuestion)) return originalQuestion;
    // Marca visual "Buscando en internet…" en el mensaje del asistente.
    setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, _status: "searching" } : m));
    try {
      const res = await fetch("/api/web-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: originalQuestion }),
      });
      const data = res.ok ? await res.json() : { used: false, sources: [] };
      if (data.used && Array.isArray(data.sources) && data.sources.length > 0) {
        return buildGroundedQuestion(originalQuestion, data.sources as WebSource[]);
      }
      return originalQuestion;
    } catch {
      return originalQuestion; // degradación con gracia
    } finally {
      setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, _status: undefined } : m));
    }
  }
```

- [ ] **Step 4: Usarlo en el camino TYPED (`sendMessage`)**

En `sendMessage`, justo ANTES de construir `const payload = { ... }` (alrededor de `ChatInterface.tsx:1714`), reemplazar el uso directo de `userMsg` como `question`:

```ts
      const groundedQuestion = await groundQuestionIfNeeded(userMsg, msgId);

      const payload = {
        token: vpsToken,
        message_id: msgId,
        conversation_id: convId,
        mode: "deep",
        question: groundedQuestion,
        attachments: contentParts,
        user_context: userContextPayload,
        conversation_history: historyText,
      };
```

(El `msgId` ya existe en ese scope — es el id del mensaje del asistente creado antes del token.)

- [ ] **Step 5: Usarlo en el camino de sugerencias (`submitSuggestion`)**

En `submitSuggestion`, antes de construir su `payload` (alrededor de `ChatInterface.tsx:1271`), augmentar `s` con el id del mensaje del asistente de ese camino (localizar la variable del id del asistente en `submitSuggestion`, p. ej. `msgId`):

```ts
      const groundedQuestion = await groundQuestionIfNeeded(s, msgId);
      // ...
      const payload = {
        // ...
        question: groundedQuestion,
        // ...
      };
```

Si en `submitSuggestion` el id del mensaje del asistente tiene otro nombre, usar ese. NO cambiar lo que se guarda como mensaje del usuario.

- [ ] **Step 6: Verificar build + lint**

Run: `npm run build`
Expected: `✓ Compiled successfully`.
Run: `npx eslint src/components/ChatInterface.tsx`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/ChatInterface.tsx
git commit -m "feat: augmentar la pregunta con fuentes web antes de mandarla al modelo"
```

---

## Task 4: Indicador "Buscando en internet…" en el bubble

**Files:**
- Modify: `src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: Renderizar la píldora cuando `_status === 'searching'`**

En `MessageBubble.tsx`, localizar el render del mensaje del asistente cuando aún NO hay contenido (el estado de "pensando"/`_loading`). Antes de ese bloque, añadir el indicador (se muestra mientras dure la búsqueda; luego `_status` se limpia y sigue el stream normal):

```tsx
{message._status === "searching" && !message.content && (
  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-1"
    style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle className="opacity-25" cx="12" cy="12" r="10" />
      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10" />
    </svg>
    <span className="text-[13px] font-medium">Buscando en internet…</span>
  </div>
)}
```

Si el tipo de `message` en `MessageBubble` no incluye `_status`, extender el tipo local de props para aceptarlo (igual que `_loading`/`_isDeep`).

- [ ] **Step 2: Verificar build**

Run: `npm run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/components/chat/MessageBubble.tsx
git commit -m "feat: pildora 'Buscando en internet...' mientras se consultan fuentes"
```

---

## Task 5: Variable de entorno `TAVILY_API_KEY`

**Prerrequisito del usuario:** crear cuenta en https://tavily.com (plan gratis) y copiar la API key (`tvly-...`). *(No la puedo crear yo — implica registro de cuenta.)*

- [ ] **Step 1: Agregar la env a Vercel (production)**

Vía API REST de Vercel (token en `%APPDATA%\com.vercel.cli\Data\auth.json`), `POST /v10/projects/prj_gXJBsz6NPDGrddIzqROkwHBIOZkx/env?upsert=true&teamId=team_nVvbXfO3rgjsliQYAsLgMvnK` con `{ key: "TAVILY_API_KEY", value: "<key>", type: "encrypted", target: ["production","preview","development"] }`.

- [ ] **Step 2: Redeploy para tomar la env** (push vacío o redeploy del último commit). Verificar que `/api/web-context` con una pregunta de búsqueda ya devuelve `used:true`.

---

## Task 6 (paralela, SEGURIDAD): sacar el password del repo público

**Files:**
- Modify: `src/app/api/research/route.ts`

- [ ] **Step 1 (USUARIO, URGENTE):** rotar el password root de `177.7.46.156` (está expuesto en el repo público).
- [ ] **Step 2:** mover `VPS_HOST/USER/PASS` de `research/route.ts:5-7` a variables de entorno (`RESEARCH_VPS_*`); si el comando `"investiga X en Y"` ya no se usa, **eliminar la ruta** entera y su disparo en `ChatInterface` (`researchMatch`). Decidir con el usuario: deprecar vs. env.
- [ ] **Step 3:** commit.

```bash
git add src/app/api/research/route.ts src/components/ChatInterface.tsx
git commit -m "fix(seguridad): sacar credenciales del research del codigo / deprecar"
```

> Nota: aunque se rote y se mueva a env, la credencial vieja vivió en el historial de git público. Tratarla como comprometida (ya rotada). Limpieza de historial (filter-repo/BFG) = opcional, fuera de Fase 1.

---

## Task 7 (OPCIONAL, requiere luz verde + acceso VPS): system prompt anti-alucinación

Esto es el ÚNICO cambio en el VPS y es **independiente** del grounding. Bajo riesgo pero toca producción del orchestrator, así que va con backup y rollback.

- [ ] **Step 1:** SSH a `203.161.47.133:22022`, localizar el handler de `/api/stream` y la función que arma el system prompt. **Backup**: `cp <archivo> <archivo>.bak-2026-06-15`.
- [ ] **Step 2:** Añadir al system prompt:
  > "Si no tienes información confiable o actualizada, dilo y no inventes. Para temas actuales (deportes, precios, noticias, fechas) usa solo las fuentes provistas; si no hay, admite que no tienes el dato al día. No afirmes resultados, cifras ni fechas sin respaldo."
- [ ] **Step 3:** Reiniciar el servicio; probar una pregunta de actualidad sin grounding (debe admitir incertidumbre en vez de inventar).
- [ ] **Step 4 (rollback si algo falla):** restaurar el `.bak` y reiniciar.

---

## Verificación final (E2E en producción, como hace el repo)

- [ ] **Step 1:** `npm run build` y `npx eslint` limpios; push a `main`; esperar deploy READY (Vercel MCP).
- [ ] **Step 2:** Con el patrón de QA logueado (usuario Clerk de prueba + sign-in ticket; ver memoria `vechat-workflow-y-accesos`), en producción:
  - Preguntar algo **de actualidad** (p. ej. "¿Venezuela clasificó al mundial 2026?"). Esperado: aparece la píldora **"Buscando en internet…"**, luego una respuesta **con enlaces/citas**, y la página no se rompe.
  - Preguntar algo **normal** (p. ej. "escríbeme un saludo"). Esperado: **sin** píldora, sin latencia extra, idéntico a hoy.
  - Con `TAVILY_API_KEY` ausente o el endpoint caído: el chat responde igual que hoy (degradación con gracia).
- [ ] **Step 3:** Limpiar el usuario de prueba (Clerk + SQL) como en sesiones previas.

## Fuera de alcance (Fase 2, otro plan)

- Detector con clasificador LLM barato (MiniMax) para los casos ambiguos.
- Modo agéntico (tool `web_search` con function-calling) o ruteo a Perplexity Sonar.
- `include_domains` de fuentes locales VE configurables desde `app_config`.
- Tope diario de búsquedas por usuario (control de costo fino).
- Limpieza del historial de git de la credencial.

## Self-review (cobertura del spec)

- Grounding con Tavily → Tasks 1,2,3,5. ✓
- "Buscando en internet…" + manejo de latencia → Task 4 + sección latencia. ✓
- Cuándo buscar (detector) → Task 1 (`shouldSearchWeb`). ✓
- Citas con enlaces → `buildGroundedQuestion` + bubble ya renderiza links. ✓
- System prompt anti-alucinación → Task 7 (opcional/VPS). ✓
- Seguridad (password) → Task 6. ✓
- No romper la app → sección de principios + degradación con gracia + cero cambios VPS en Fase 1. ✓
