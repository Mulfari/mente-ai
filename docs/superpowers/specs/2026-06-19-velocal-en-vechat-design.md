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
- **"cerca":** hoy ciudad (la tabla aún no tiene `lat/lng`); cuando VeLocal
  agregue coordenadas, pasa a **distancia real** (cercanos primero). VeChat se
  construye listo para ambos (ver Progressive enhancement).
- **Recomendación a VeLocal (no bloquea v1):** agregar `tags text[]` /
  `keywords` para mejorar recall ("hamburguesa", "desayuno", "brunch", "café"
  → encuentran al negocio aunque la categoría diga "Café & cocina"). Mientras
  tanto, VeChat puede expandir sinónimos del término en el paso de intención.

## Componentes

### 1. Capa de recuperación — `src/lib/localBusinesses.ts`

Función pura/servidor, reusable hoy (grounding) y mañana (tool):

```
searchLocalBusinesses({ city, term, lat?, lng?, limit = 5 }): Promise<LocalBusiness[]>
```

- Lee `velocal_businesses` con el **service role** (tabla con RLS ON sin
  policies; igual que el resto del feed server-side). Filtra `active = true`
  (y `visible_in_vechat` si existe) + ciudad (normalizada; reusar `normalizeCity`).
- **Match (texto):** `websearch_to_tsquery('spanish', term)` sobre un
  `to_tsvector('spanish', name + description + category (+ tags si existe))`,
  con `ts_rank`. Fallback a `ILIKE`/trigram (`pg_trgm`) si la query es corta o
  sin match FTS.
- **Ranking (orden):** si llegan `lat/lng` del usuario **Y** el negocio tiene
  coordenadas → **distancia primero** (haversine; "los cercanos primero" — justo
  lo que pide "cenar rápido"), con la relevancia de texto como desempate. Sin
  geo → relevancia de texto. En ambos: **abiertos antes que cerrados** (`openNow`)
  + leve bonus por perfil completo.
- Devuelve: `{ slug, name, category, city, neighborhood, description, whatsapp,
  instagram, mapsUrl, logoUrl, hours, openNow, distanceKm? }`.
- **`openNow`** se calcula del `hours` jsonb contra la hora de Venezuela
  (`isOpenNow(hours)`; respeta `temporarily_closed` si existe).
- **Progressive enhancement (clave):** la función usa `tags`, `lat/lng`,
  `visible_in_vechat` **solo si ya existen** en la tabla (las agrega VeLocal). Hoy,
  sin ellas, corre con full-text sobre `name+description+category` y "cerca" =
  ciudad; cuando VeLocal migra, se encienden tags + distancia **sin reescribir
  VeChat**. Esto desacopla las dos entregas.
- Índice: GIN sobre el tsvector + `(city, active)`.

### 1b. Ubicación del usuario (cliente)

Para "los cercanos primero" VeChat necesita la ubicación del usuario:
- **Geolocalización del navegador** (`navigator.geolocation`, con permiso) →
  `lat/lng` precisos. Se pide **contextual** (la 1ª vez que hace una pregunta
  local, o un toggle "usar mi ubicación"), no de golpe al entrar. Se cachea.
- **Fallback:** `user_context.city` (si la puso) o ciudad por IP. Sin ubicación
  ni ciudad → no se dispara VeLocal (cae a genérico).
- Se pasa `lat/lng` (o la ciudad) al grounding para `searchLocalBusinesses`.

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
1. `searchLocalBusinesses({ city, term, lat, lng })`.
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

## Ranking y "cerca"

- **Con geo** (usuario + negocio tienen `lat/lng`): **distancia primero** — en
  ciudad grande "cenar rápido" trae lo de al lado —, relevancia de texto como
  desempate, `openNow` (abiertos primero), leve bonus por perfil completo.
- **Sin geo**: relevancia de texto + `openNow`, acotado a la ciudad del usuario.
- Si el usuario pide explícitamente otra zona/algo no cercano, manda el término
  (la cercanía es el default, no una jaula).
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

## Riesgos — lo que MÁS impacta la calidad

La correctitud depende **más de la riqueza de la data de VeLocal que del código
de VeChat**. El código es directo; lo difícil es que haya con qué responder.

1. **Recall del match (riesgo #1).** Con `category` de texto libre + descripción
   corta, muchas preguntas específicas no encuentran match ("hamburguesas" no
   está en ningún campo de un café que igual las vende; "desayuno" ≠ "brunch").
   Resultado: VeChat se ve "ignorante" justo donde promete saber. **Mitigación:
   tags/keywords en VeLocal (lo que más mueve la aguja) + expansión de sinónimos
   en VeChat.** Sin esto, el feature decepciona aunque haya negocios.
2. **Ciudad imprecisa.** Si la ciudad del usuario (IP/user_context) está mal o
   vacía → no dispara o muestra otra ciudad. Mejor no disparar que equivocarse.
3. **Datos desactualizados.** Horarios viejos → "Abierto ahora" miente y rompe
   confianza. Depende de la higiene de VeLocal.
4. **Falsos positivos de intención.** "¿dónde saco el RIF?" (trámite) NO debe
   disparar negocios; "¿dónde desayuno?" sí. La heurística necesita afinarse (y
   el mini-LLM extractor ayuda a desambiguar).

## Mejoras necesarias para funcionar bien

### VeLocal (la oferta — lo que más mueve la aguja)
- **Categoría estructurada + tags buscables (lo #1).** Una taxonomía fija
  (Comida → Hamburguesas / Café / Pizza / Arepas…, Servicios, Salud, Belleza…)
  **+ `tags text[]` libres** por negocio. Es lo que decide si "hamburguesas",
  "desayuno", "café" encuentran al negocio. Sin esto el match falla seguido.
- **Perfiles completos.** Onboarding que asegure `category, description (qué
  ofrece), hours, whatsapp`. Un perfil pelado es inútil para descubrimiento.
- **Ciudad normalizada** (+ zona/barrio; y a futuro `lat/lng` para "cerca" de
  verdad, no solo ciudad).
- **Frescura de horarios** + estado "cerrado temporalmente" (sostiene el
  "Abierto ahora").
- **Visibilidad/calidad.** Flag "aparecer en VeChat" + un mínimo de calidad
  (moderación ligera) para no surfacear spam/perfiles incompletos.

### VeChat (la costura)
- **Ciudad del usuario confiable.** Derivar/preguntar bien la ciudad (IP es
  impreciso). Sin ciudad correcta el descubrimiento local falla.
- **Desambiguar intención** (negocio vs trámite vs general) — aquí entra el
  mini-LLM extractor.
- **Expansión de sinónimos/términos** mientras VeLocal no tenga tags ricos.
- **Coordinación tarjeta↔prosa:** el `answerHint` instruye al modelo a **no
  repetir** los datos de las tarjetas (enmarcarlas, no recitarlas). Avatar de
  respaldo (inicial) si el negocio no tiene logo.
- **Analítica** de "mostrados/clics" (mide valor, alimenta ranking, prueba ROI
  al negocio que captes).
- **2da superficie:** que "Cerca de ti" del feed también se nutra de VeLocal, no
  solo el chat.

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
