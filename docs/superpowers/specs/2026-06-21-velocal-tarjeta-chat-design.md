# Bloque 2 · Cómo se muestra un negocio en el chat (rediseño de la tarjeta)

**Fecha:** 2026-06-21
**Estado:** diseño aprobado (Jose: "procede con lo que vamos hablando")
**Contexto:** parte del rumbo "foso local" — el momento en que VeChat muestra un
negocio real de VeLocal es el diferencial vs ChatGPT (que solo da "Cómo llegar").
La acción protagonista debe ser **WhatsApp** (el canal en VE).

## Problema (las 4 quejas de Jose, ya validadas)
La tarjeta actual ([LocalBusinessCard.tsx](../../../src/components/chat/LocalBusinessCard.tsx)):
1. **Logo gris** cuando no hay `logo_url` (placeholder con inicial).
2. **Diseño pobre / se siente vacío con 1** negocio.
3. El bloque **se separa del texto** y parece anuncio (encabezado "📍 Negocios
   cerca de ti" en [MessageBubble.tsx:330](../../../src/components/chat/MessageBubble.tsx)).
4. **Parece publicidad**, no parte de la conversación.

## Diseño (portar el VeChatBizCard que Jose generó)
### Tarjeta nueva
- **Logo = ícono por categoría** sobre mosaico de color (café→taza, bar/tasca→
  copa, comida→tenedor, tienda→storefront, etc.). Prioridad: `logo_url` (si existe)
  → ícono de categoría → inicial. **Mata el logo gris.**
- **Nombre** + pill **"Abierto ahora"** (verde con punto) / **"Cerrado"**.
- **Meta:** categoría · barrio · distancia (cada parte solo si existe).
- **Tags** como chips sutiles (máx 3).
- **Acciones:** **WhatsApp = botón principal** (verde, ancho) + **Ver perfil** +
  **Cómo llegar** (secundarios, lado a lado). Si no hay WhatsApp, no se muestra.
- Tarjeta más rica/suave → **una sola ya no se siente vacía**.

### Integración (tejida, no anuncio)
- **Quitar el encabezado "Negocios cerca de ti"** de MessageBubble. Las tarjetas
  siguen a la prosa del modelo directamente. (El modelo ya las enmarca vía el
  answerHint, sin repetir datos.)

### Mapa (diferido)
- El mapa/lista/detalle estilo ChatGPT es parte de este bloque pero **se difiere
  hasta tener densidad** (con 2 negocios un mapa queda vacío). Anotado, no se
  construye ahora.

## Arquitectura / componentes
- **NUEVO `src/lib/businessVisual.ts`** (puro, testeable): `categoryGlyph(category)`
  → `{ icon: GlyphKey; color: string }` (mapea palabras clave de categoría a un
  set fijo de íconos+colores; default genérico); `formatDistanceKm(km)` → string
  ("0.4 km" / "12 km", misma regla que hoy).
- **`src/lib/localBusinesses.ts`**: añadir `tags: string[]` al tipo `LocalBusiness`
  y a la consulta (`.select(... ,tags)`), mapeando `tags` (text[] de
  `velocal_businesses`) a `string[]` (vacío si null).
- **`src/components/chat/LocalBusinessCard.tsx`**: reescribir al layout VeChatBizCard
  usando `businessVisual` + `waLink`. Íconos **SVG inline** (sin librería nueva):
  set pequeño (taza, copa, tenedor, storefront, whatsapp, pin, flecha). Componente
  sin estado → seguro en cliente.
- **`src/components/chat/MessageBubble.tsx`**: quitar el `<span className="lb-cards-head">…
  Negocios cerca de ti</span>`; conservar el contenedor `.lb-cards` con los cards.
- **`src/app/globals.css`**: reestilizar `.lb-*` al look VeChatBizCard (tarjeta
  radio 18 + sombra sutil, mosaico de ícono, chips de tag, botón WA principal).
  Tokens de marca (claro + oscuro vía variables existentes).

## Datos
`searchLocalBusinesses` → ahora incluye `tags` → MessageBubble pasa el negocio al
card → el card pinta tags + ícono por categoría. `tags` ya alimenta `search_tsv`
(no cambia el recall, solo se expone para la UI).

## Tests (el proyecto NO tiene runner — se monta vitest)
- Añadir **vitest** (`devDependency`) + script `"test": "vitest run"`.
- `src/lib/businessVisual.test.ts`: `categoryGlyph` (café/tasca/comida/desconocido
  → ícono+color correctos, case/acentos-insensible), `formatDistanceKm`
  (0.4→"0.4 km", 12.6→"13 km", <10 con 1 decimal).
- `src/lib/phone.test.ts`: `waLink` ("04141234567"→wa.me/58414…, "+58 414…",
  null/vacío→null).
- Verificación: `vitest run` verde + `next build` + E2E en vivo en prod
  (preguntar por un negocio real y revisar la tarjeta nueva).

## Fuera de alcance
- Mapa/lista/detalle (diferido a densidad).
- Ratings/precios (no existen en los datos).
- Tests del componente React (solo lógica pura; evita jsdom/testing-library).
