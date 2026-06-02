# MiniMax M3 — Cheat Sheet para VeChat

> Cheat sheet local. NO está en memoria del agente. Fuente: `https://platform.minimax.io/docs/` (descargado 2026-06-02).
> Endpoint Anthropic-compatible: `https://api.minimax.io/anthropic`. Para OpenAI-compatible: `https://api.minimax.io/v1`.
> Autenticación: header `Authorization: Bearer <API_KEY>` o `x-api-key: <API_KEY>`. Si ambos están, Authorization gana.

---

## 1. M3 — datos rápidos

| Atributo | Valor |
|---|---|
| Modelo ID | `MiniMax-M3` |
| Context window | 1M tokens |
| Multimodal | texto + imagen + video + tool use + thinking blocks |
| `max_tokens` recomendado | 131072 (128K) |
| `max_tokens` máximo | 524288 (512K) |
| RPM | 200 |
| TPM | 10,000,000 |
| Top P default | 0.95 |
| Temperature default | 1 |
| Stop reasons | `end_turn`, `max_tokens`, `tool_use` |
| Detalle imagen default | `default` (~1k-5k tokens) |

> ⚠️ M2.7/M2.5/M2.1/M2 **no soportan** imagen ni video, solo texto + tool use.

---

## 2. Pricing (Pay as You Go, Standard tier)

| Tramo input | Input | Output | Cache read |
|---|---|---|---|
| ≤ 512k input tokens | $0.30 / M | $1.20 / M | $0.06 / M |
| > 512k input tokens* | $1.20 / M | $4.80 / M | $0.24 / M |

*Por encima de 512k hay cupo limitado, contactar a ventas. Apertura pública "en los próximos días".

**Priority tier** (1.5x): usar `service_tier: "priority"` en la request. Da scheduling preferente en concurrencia alta.

Hay 50% off los primeros 7 días (transitorio).

---

## 3. Streaming (SSE)

Activar con `"stream": true` en la request. Formato: `text/event-stream`.

### Tipos de evento

| Evento | Cuándo | Payload clave |
|---|---|---|
| `message_start` | Inicio del mensaje | `message: { id, model, content: [], usage }` |
| `ping` | Heartbeat | (vacío) |
| `content_block_start` | Inicio de un bloque | `index`, `content_block: { type, ... }` |
| `content_block_delta` | Trozo de un bloque | `index`, `delta: { type, text/thinking/signature }` |
| `content_block_stop` | Fin de un bloque | `index` |
| `message_delta` | Update a nivel mensaje (stop_reason) | `delta: { stop_reason }`, `usage` |
| `message_stop` | Fin del mensaje | (vacío) |

### Tipos de delta dentro de un content_block

| `delta.type` | Significado |
|---|---|
| `text_delta` | Trozo de la respuesta de texto visible |
| `thinking_delta` | Trozo del bloque de thinking (cuando `thinking` está activo) |
| `signature_delta` | Firma del bloque de thinking (último delta antes del stop) |

### Orden típico de eventos (M3 con `thinking: adaptive`)

```
message_start
ping
content_block_start { type: thinking, thinking: "" }
content_block_delta { delta: { type: thinking_delta, thinking: "..." } }   ← x N
content_block_delta { delta: { type: signature_delta, signature: "..." } }
content_block_stop
content_block_start { type: text, text: "" }
content_block_delta { delta: { type: text_delta, text: "..." } }           ← x N
content_block_stop
message_delta { delta: { stop_reason: "end_turn" }, usage }
message_stop
```

**Importante:** los errores durante streaming llegan como un evento SSE `event: error` con el mismo body que una respuesta de error normal. El cliente debe parar de leer y limpiar estado.

---

## 4. Thinking / Interleaved Thinking

Control con el parámetro `thinking`:

```json
"thinking": { "type": "adaptive" }   // recomendado: el modelo decide si piensa
"thinking": { "type": "disabled" }   // salta thinking, responde directo
```

- Default: `adaptive`.
- Cuando el modelo piensa, devuelve un `content_block` tipo `thinking` con `thinking: "..."` y `signature: "..."`.
- **Multi-turn:** el bloque de thinking completo (incluyendo `signature`) debe volver al historial tal cual. Si lo pierdes, el modelo pierde el hilo de razonamiento.
- En el historial, el bloque de thinking va como parte del mensaje `assistant`, dentro de `content` con `type: "thinking"`.

---

## 5. Vision / Multimodal input (M3 only)

### Image

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "¿Qué muestra esta imagen?" },
    {
      "type": "image",
      "source": {
        "type": "url",
        "url": "https://..."
      }
    }
  ]
}
```

O con base64:

```json
{
  "type": "image",
  "source": {
    "type": "base64",
    "media_type": "image/png",
    "data": "<BASE64>"
  }
}
```

**Formatos:** JPEG, PNG, GIF, WEBP. **Tamaño máx:** 10 MB (URL o base64), request body 64 MB.

### Video

```json
{
  "type": "video",
  "source": {
    "type": "url",
    "url": "https://...mp4"
  }
}
```

**Formatos:** MP4, AVI, MOV, MKV. **Tamaño máx:** 50 MB (URL o base64). Para videos > 50MB, subir vía Files API y referenciar como `mm_file://{file_id}` (hasta 512 MB).

**Parámetros extra en `source` para video:**
- `fps`: 0.2 a 5, default 1. Más alto = más sensible a cambios de escena, más caro.
- `max_long_side_pixel`: limitar el lado más largo del frame.

### Parámetro `detail` (imagen)

| `detail` | Tokens aprox |
|---|---|
| `low` | hasta ~600 |
| `default` | ~1k-3k (hasta ~5k) |
| `high` | varios miles (hasta ~15k+) |

Default: `default`. Para conocer el exacto: `POST /anthropic/v1/messages/count_tokens` o leer `usage.input_tokens` en la respuesta.

---

## 6. Tool Use (resumen)

El modelo devuelve un `content_block` con `type: "tool_use"`:

```json
{
  "type": "tool_use",
  "id": "call_function_xxx",
  "name": "get_weather",
  "input": { "location": "San Francisco, US" }
}
```

El cliente responde con un `content_block` `tool_result`:

```json
{
  "type": "tool_result",
  "tool_use_id": "call_function_xxx",
  "content": "Resultado de la tool como string o array de blocks"
}
```

`stop_reason` será `tool_use` cuando el modelo pide ejecutar una tool. Después de ejecutar, sigue la conversación con el `tool_result` y `stop_reason` vuelve a `end_turn` o `max_tokens`.

**Multi-turn con tools:** append el bloque `tool_use` del assistant Y el `tool_result` del user al historial.

---

## 7. Prompt Caching

Marcar con `cache_control: { type: "ephemeral" }` en:
- Bloques del system prompt (array format)
- Bloques individuales de mensajes
- Definiciones de tools

```json
"tools": [
  {
    "name": "get_weather",
    "description": "...",
    "input_schema": {...},
    "cache_control": { "type": "ephemeral" }
  }
]
```

- Lifetime: 5 minutos.
- Tracking en `usage`:
  - `cache_creation_input_tokens` — tokens nuevos cacheados
  - `cache_read_input_tokens` — tokens leídos del cache
  - `input_tokens` — tokens no cacheados

Mismo modelo: $0.06/M tokens de cache read (Standard ≤ 512k). **20x más barato que input regular.**

---

## 8. Manejo de errores

### HTTP status codes

| Code | Type | Acción |
|---|---|---|
| 400 | `invalid_request_error` | Revisar params (tipo, schema, etc). No reintentar igual. |
| 401 | `authentication_error` | API key mala. |
| 403 | `permission_error` | No acceso al modelo. |
| 404 | `not_found_error` | Modelo no existe. |
| 413 | `request_too_large` | Body > 64 MB o imagen > 10 MB / video > 50 MB. |
| 429 | `rate_limit_error` | RPM/TPM excedido. **Retry con backoff.** |
| 500 | `api_error` | Reintentar. |
| 529 | `overloaded_error` | Upstream saturado. **Retry con backoff.** |

### Códigos de error internos (en `error.message` o en code interno)

| Code | Significado |
|---|---|
| 1001 | timeout |
| 1002 | rate limit |
| 1004 | auth / cookie / token |
| 1008 | insufficient balance |
| 1024 | internal error |
| 1026/1027 | input/output flagged sensitive |
| 1039 | token limit |
| 2056 | usage limit — esperar ventana de 5h |

Estrategia: reintentar 1001/1024/1026/1027/1039/500/529 con backoff exponencial. NO reintentar 400/401/403/404/413 (son del cliente).

---

## 9. Multi-turn: cómo armar el historial

Para que el modelo mantenga el hilo de razonamiento a lo largo de turnos, el `messages` que envías debe incluir **todos** los bloques previos tal cual llegaron:

```json
"messages": [
  { "role": "user", "content": "Pregunta 1" },
  {
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "text", "text": "Respuesta 1" }
    ]
  },
  { "role": "user", "content": "Pregunta 2" },
  {
    "role": "assistant",
    "content": [
      { "type": "thinking", "thinking": "...", "signature": "..." },
      { "type": "tool_use", "id": "...", "name": "...", "input": {...} }
    ]
  },
  { "role": "user", "content": [
    { "type": "tool_result", "tool_use_id": "...", "content": "..." }
  ]}
]
```

Si tu orchestrator actualmente strippea los thinking blocks al armar el historial, **lo está haciendo mal**. Hay que preservarlos.

---

## 10. Snippet mínimo de uso (Anthropic-compatible)

```ts
const resp = await fetch("https://api.minimax.io/anthropic/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.MINIMAX_API_KEY}`,
    "anthropic-version": "2023-06-01"
  },
  body: JSON.stringify({
    model: "MiniMax-M3",
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: [
      { type: "text", text: "Eres VeChat, asistente para venezolanos." }
    ],
    messages: [
      { role: "user", content: userMessage }
    ]
  })
});

if (!resp.ok) {
  // manejar 4xx/5xx según tabla arriba
  throw new Error(`M3 error ${resp.status}`);
}

const data = await resp.json();
// data.content = [{ type: "thinking", ... }, { type: "text", text: "..." }]
// data.stop_reason, data.usage
```

Para streaming, mismo body con `"stream": true` y leer el `ReadableStream` parseando `event: <type>\ndata: <json>\n\n`.

---

## 11. Modelo OpenAI-compatible (alternativa)

Si por algún motivo necesitas la API OpenAI (no recomendado para M3, el path Anthropic tiene más features):

- Base: `https://api.minimax.io/v1`
- `chat.completions.create()` con `model: "MiniMax-M3"`, `messages: [...]`, `stream: true`
- Thinking se separa con `extra_body: { reasoning_split: true }` → llega en `reasoning_details` aparte de `content`.
- Sin `reasoning_split`, el thinking viene envuelto en tags `<think>...</think>` dentro de `content`.

---

## 12. Cosas que NO están en este cheat sheet (para Fase futura)

- **Image generation (T2I)** — el modelo M3 no genera imágenes, eso es `image-01` (otro endpoint).
- **Video generation (T2V, I2V)** — `MiniMax-Hailuo-2.3` y `Hailuo-2.3-Fast`, otros endpoints.
- **Speech (TTS, voice cloning)** — `speech-2.8-*`, otros endpoints.
- **Music generation** — `Music-2.6`, otro endpoint.
- **Files API** — para subir videos > 50MB y referenciar como `mm_file://...`.
- **Token Plan / subscriptions** — pricing diferente, ver `guides/pricing-token-plan.md`.

Cuando lleguemos a image generation en Fase 4 del plan, descargar la doc correspondiente.
