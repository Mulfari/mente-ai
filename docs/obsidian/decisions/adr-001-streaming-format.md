# ADR-001: Formato de eventos SSE para streaming

**Fecha:** 2026-05-17
**Estado:** Resuelto ✅ (2026-05-17)

## Contexto

El chat de Mulfai usa streaming SSE (Server-Sent Events) entre el backend (`/api/chat`) y el frontend (`ChatInterface.tsx`). Hay dos formatos posibles para los eventos de streaming:

**Formato A — `chunk/text`** (original, implementado en commit `a31c022`):
```json
{ "type": "chunk", "text": "delta parcial" }
```

**Formato B — Nativo Anthropic SSE** (formato original de la API de Anthropic):
```json
{ "type": "content_block_delta", "delta": { "type": "text_delta", "text": "..." } }
```

## Decisión actual

El frontend espera **Formato A** (`chunk/text`):
- `ChatInterface.tsx` líneas ~752 y ~1088: `if (json.type === "chunk" && json.text)`

El backend actual re-emite eventos en **Formato B** (nativo de Anthropic).

## Problema

Cuando el usuario envía un mensaje:
1. El backend recibe streaming de Anthropic en formato B
2. Re-emite en formato B al frontend
3. El frontend no reconoce `type === "chunk"`, ignora los eventos
4. Los tres puntos quedan colgados para siempre
5. Al recargar, el mensaje completo aparece (ya que se guardó en DB incrementally)

## Solución adoptada

**Opción 1 (recomendada):** Transformar en backend de B → A ✅ Implementado 2026-05-17

Commit `03db1b5`: `fix(chat): emit SSE as type=chunk/text to match frontend`

- El backend recibe formato B de Anthropic en `/api/chat`
- Transforma cada `content_block_delta` a `{ type: "chunk", text: delta }`
- Frontend sigue funcionando sin cambios
- DB se actualiza con texto acumulativo en cada delta

## Consecuencias
- Mínimo cambio en código
- Backend es la capa de traducción
- Frontend permanece estable

## Notas
- Al hacer reload, el frontend parsea correctamente porque muestra el mensaje completo guardado en DB
- El research command y otros flujos usan el mismo stream handler