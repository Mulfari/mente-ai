# VeLocal en VeChat — capa de datos local en el chat (diseño)

**Fecha:** 2026-06-19
**Estado:** diseño aprobado en dirección; pendiente plan de implementación.

## Objetivo

Cuando un usuario de VeChat pregunta por un **lugar/negocio local** ("¿dónde
desayuno en Maracay?", "una tasca para ir el viernes", "dónde como hamburguesas
cerca"), VeChat debe responder con **negocios reales de VeLocal** como
protagonistas — tarjetas accionables (WhatsApp, perfil, abierto ahora) — y
completar con el panorama general en prosa para no quedar pelado. Es la "capa de
datos local" estructurada: la cuña de "lo de aquí" hecha producto, y el flywheel
que le da valor a VeLocal (el negocio gana descubrimiento → incentivo a estar).

## Decisiones de arquitectura (el porqué)

- **Todo del lado Vercel, sin tocar el VPS.** El grounding ya vive en Vercel
  (`/api/web-context` arma contexto dólar/web y se lo pasa al orquestador dentro
  del prompt; el VPS solo streamea con MiniMax-M3). Como `velocal_businesses`
  está en el MISMO Supabase, buscar negocios es un cambio 100% Vercel. Cero
  riesgo de backend, funciona con el modelo actual.
- **NO tool-calling todavía.** El modelo es MiniMax-M3 (razonador, mete `<think>`),
  su soporte fiable de herramientas no está confirmado. Tool-calling es el
  destino (Fase futura), pero hoy sería apostar el producto a algo incierto.
- **NO vectores.** Los datos son pocos y categorizados; full-text en español
  (+ trigram) sobre `name+description+category` alcanza y es más rápido/barato.
- **El activo durable es la capa de recuperación** (`searchLocalBusinesses`) y el
  **contrato de respuesta de dos niveles**. No cambian cuando se suba a
  tool-calling → cero rework.
- **Auto-gatillado:** solo muestra VeLocal cuando hay match real (ciudad +
  texto); si no, el flujo normal (web/genérico). Por eso puede ir vivo con poca
  data sin verse incompleto.

## Estado de la data (revisado 2026-06-19)

2 negocios activos, ambos Maracay (Mantuano · Café & cocina; La Vid · Tasca &
vinos). Bien poblados: `category, city, description, hours` (estructurado por
día), `whatsapp, instagram, maps_url, logo_url, images, slug, active`. `address`
viene NULL (lo cubre `maps_url`). Implicaciones:

- **Match por full-text**, no por igualdad de `category` (es texto libre).
- **"cerca" = misma ciudad** (no hay lat/lng).
- **Recomendación a VeLocal (no bloquea v1):** agregar `tags text[]` /
  `keywords` para mejorar recall ("hamburguesa", "desayuno", "brunch", "café"
  → encuentran al negocio aunque la categoría diga "Café & cocina"). Mientras
  tanto, VeChat puede expandir sinónimos del término en el paso de intención.

## Componentes

### 1. Capa de recuperación — `src/lib/localBusinesses.ts`

Función pura/servidor, reusable hoy (grounding) y mañana (tool):

```
searchLocalBusinesses({ city, term, limit = 5 }): Promise<LocalBusiness[]>
```

- Lee `velocal_businesses` con el **service role** (tabla con RLS ON sin
  policies; igual que el resto del feed server-side).
- Filtra `active = true` y `city ilike city` (normalizada; reusar
  `normalizeCity` del feed).
- **Ranking por relevancia de texto**: `websearch_to_tsquery('spanish', term)`
  sobre un `to_tsvector('spanish', name||' '||coalesce(description,'')||' '||
  coalesce(category,''))`, con `ts_rank`. Fallback a `ILIKE`/trigram
  (`pg_trgm`) si la query es muy corta o sin match FTS.
- Devuelve un shape limpio: `{ slug, name, category, city, description,
  whatsapp, instagram, mapsUrl, logoUrl, hours, openNow }`.
- **`openNow`** se calcula del `hours` jsonb contra la hora de Venezuela
  (helper `isOpenNow(hours)` — reusar la lógica de medianoche VE que ya existe).
- Índice (migración VeLocal o VeChat): GIN sobre el tsvector + `(city, active)`.
  Con 2 filas no importa; dejarlo listo para escala.

### 2. Detección de intención — extender `searchIntent` (webSearch.ts)

Nueva intención `"local_business"`: heurística barata sobre la pregunta.
- Dispara con señales de "buscar lugar/negocio": `dónde`, `cerca`, `recomiend*`,
  `un sitio/lugar/local`, verbos/sustantivos de consumo (`comer`, `desayunar`,
  `tomar algo`, `delivery`, `tasca`, `café`, `restaurante`, `comprar`...).
- Extrae **término** (lo que busca) y **ciudad** (del `user_context`/IP; misma
  fuente que el feed). Si no hay ciudad conocida, no se dispara VeLocal (cae a
  genérico) — mejor eso que mostrar negocios de otra ciudad.
- v1 heurística + (sinónimos básicos). Si el recall con preguntas indirectas
  flojea, se agrega un **mini-paso LLM** que devuelve `{term, category}` (misma
  función de recuperación; nada más cambia el extractor).

### 3. Grounding — `/api/web-context` (o ruta hermana)

Antes de Tavily, **short-circuit del intent `local_business`** (igual patrón que
el dólar):
1. `searchLocalBusinesses({ city, term })`.
2. Si hay ≥1 resultado: devolver `{ used: true, kind: "local_business",
   businesses: [...], answerHint }` — `businesses` estructurado para tarjetas, y
   `answerHint` (texto breve para el modelo: "Negocios locales en VeChat para
   <term> en <city>: Mantuano (café/brunch), …. Recomiéndalos y, si falta, da
   contexto general."). El modelo redacta la prosa; el cliente pinta las
   tarjetas con `businesses`.
3. Si 0 resultados: **no corta** → sigue el flujo normal (Tavily/genérico). Nunca
   queda vacío.

`ChatInterface` guarda `businesses` en el mensaje (como hoy guarda `_sources`).

### 4. UX — dos niveles en `MessageBubble`

- **Indicador**: mientras corre, *"Buscando negocios cerca…"* (mismo estilo que
  "Buscando en internet"; aparece un instante porque es consulta a BD).
- **Tarjeta de negocio** (componente nuevo `LocalBusinessCard`): logo, nombre,
  categoría, chip **"Abierto ahora"** (verde) / "Cerrado" según `openNow`, botón
  **WhatsApp** (deep-link `wa.me`), **"Ver perfil"** → `velocal.vercel.app/{slug}`,
  y "Cómo llegar" (mapsUrl) si está. Diseño con los tokens de marca.
- **Layout**: las tarjetas (máx 3-4) salen como bloque destacado dentro/encima
  de la respuesta; lo genérico va en la **prosa** del modelo. Un encabezado sutil
  tipo "Negocios cerca de ti" deja claro que son de VeChat (no "ads").
- **Tracking**: clic en tarjeta/WhatsApp → evento (para medir y, a futuro,
  ranking). Reusar `track-query`/un evento nuevo.

## Ranking y "cerca" (v1)

- Orden: relevancia de texto (`ts_rank`) → desempate por `openNow` (abiertos
  primero) → completitud de perfil (logo+fotos+horario) como leve bonus.
- "cerca" = misma ciudad. Distancia/barrio = futuro (requiere geo en VeLocal).
- Sin sesgo por pago (no hay promoción pagada aún; cuando la haya, se etiqueta).

## Futuro (no v1) — tool-calling

Cuando el modelo soporte herramientas sólidas: el orquestador del VPS expone
`buscarNegocios(...)` como tool que llama a la **misma** `searchLocalBusinesses`.
El contrato de tarjetas/dos-niveles no cambia. Verificar antes si MiniMax-M3 (o
el modelo que toque) hace tool-use fiable.

## No-objetivos (YAGNI)

- Reservas/pedidos dentro de VeChat (solo descubrimiento + WhatsApp).
- Reseñas/ratings (no existen en VeLocal aún).
- Geo por distancia real (v1 es ciudad).
- Promoción pagada/ranking por pago.
- Vectores.

## Plan por fases

**Fase 0 — listo para tráfico (esto es lo que construimos ahora):**
1. `localBusinesses.ts`: `searchLocalBusinesses` + `isOpenNow` (+ índice GIN).
2. Intención `local_business` + extractor heurístico en `webSearch.ts`.
3. Short-circuit en `/api/web-context` (devuelve `businesses` + `answerHint`).
4. `ChatInterface`: pasa `businesses` al mensaje; indicador "Buscando negocios…".
5. `LocalBusinessCard` + render de dos niveles en `MessageBubble`.
6. Build + E2E con los 2 negocios reales (Maracay): "dónde desayuno en Maracay"
   → tarjeta Mantuano con Abierto ahora + WhatsApp; "tasca en Maracay" → La Vid;
   query sin match → cae a genérico.

**Fase 1 — afinado con supply real (cuando llegue tráfico):**
- (VeLocal) agregar `tags`/`keywords` a los negocios → mejor recall.
- Ajustar ranking con datos de clics reales.
- Encender ciudad por ciudad según densidad.

**Fase 2 — tool-calling** (cuando el modelo lo soporte).

## Testing

- Unit: `isOpenNow(hours)` (abierto/cerrado/cruza medianoche/día sin horario),
  `searchLocalBusinesses` (match, ciudad equivocada, 0 resultados, término corto).
- E2E manual en prod (Maracay): los 3 casos de arriba.
- Regresión: una pregunta NO-local ("a cuánto el dólar") no dispara VeLocal.

## Dependencias / costuras

- `velocal_businesses` (Supabase, service role) — solo lectura desde VeChat.
- `user_context.city` / IP para la ciudad del usuario (ya existe).
- Sin cambios en el VPS para Fase 0.
