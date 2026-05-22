# Streaming Real — Especificación de Diseño

**Fecha:** 2026-05-22
**Estado:** Aprobado
**Proyecto:** Mente AI — VeChat

---

## Objetivo

Reemplazar el typing simulado del frontend por streaming real letra por letra, donde cada chunk llega directamente desde la API de Claude al browser. Además, guardar chunks en Supabase para que el otro dispositivo (escritorio/móvil) reciba la respuesta en tiempo real.

---

## Arquitectura

```
Browser (ChatInterface)
    │
    │ 1. POST /api/auth/vps-token → recibe token temporal (validez: 30s)
    │ 2. GET /api/stream?token=xxx&conversation_id=xxx&...  (SSE directo al VPS)
    ▼
VPS Orchestrator (177.7.46.156:3000)
    │
    │ 3. Valida token con Supabase
    │ 4. Llama a Claude API con stream: true
    │ 5. Transforma chunks SSE → retransmite al browser
    │ 6. También guarda cada chunk en Supabase (messages table)
    ▼
Browser (mismo dispositivo + otro dispositivo via Supabase realtime)
```

---

## Flujo Detallado

### 1. El browser pide un token temporal

El frontend llama a `POST /api/auth/vps-token` en Vercel. Esta ruta:
- Valida la sesión del usuario (ya lo hace Supabase)
- Genera un JWT simple con `{ userId, exp: now+30s }`
- Lo firma con `VPS_SHARED_SECRET` (variable de entorno compartida entre Vercel y VPS)
- Devuelve el token al browser

### 2. El browser conecta al VPS por streaming

El browser abre un `EventSource` o `fetch` con streaming a:
```
GET http://177.7.46.156:3000/api/stream
  ?token=<jwt>
  &conversation_id=<uuid>
  &mode=normal|deep
  &message_id=<uuid>
  &user_id=<uuid>
```

La petición lleva el `userId` y la conversación en query params (más simple que en body para GET).

El VPS valida el JWT con la clave compartida. Si es inválido o expirado → 401.

### 3. El VPS hace streaming real a Claude

El VPS arma el prompt enriquecido (igual que ahora) y llama a `api.selectapi.vip` con `stream: true`. Recibe chunks de Claude y los retransmite al browser como SSE:

```
data: {"type":"chunk","text":"H","is_deep":false}
data: {"type":"chunk","text":"o","is_deep":false}
...
data: {"type":"done","is_deep":false}
```

Cada chunk también se persiste incrementalmente en Supabase (upsert sobre `message_id` con `content` acumulado).

### 4. El otro dispositivo recibe en tiempo real

El browser que NO envió el mensaje ya tiene un subscription realtime en Supabase escuchando `INSERT` en `messages` para la conversación activa. Cada vez que el VPS hace upsert de un chunk, ese evento llega al otro dispositivo. El frontend muestra los chunks recibidos (sin re-simular typing).

---

## Cambios por Archivo

### VPS — `/root/vechat-orchestrator/src/index.ts`
- Nueva ruta: `GET /api/stream` — acepta query params, valida JWT, responde con SSE
- Remover o adaptar la ruta actual `POST /api/orchestrate` — se mantiene para backward compatibility (resumen, feedback)
- Usar la misma clave compartida (`VPS_SHARED_SECRET`) para validar JWTs

### VPS — `/root/vechat-orchestrator/src/orchestrator.ts`
- Nueva función: `streamWithContextDelta()` — hace streaming a Claude y retransmite chunks
- Reutilizar la lógica actual de `buildEnrichedPrompt()` y `findSimilarQA/knowledge/feedback`
- Persistir cada chunk en Supabase via la pool de DB (upsert en `messages`)

### VPS — `/root/vechat-orchestrator/.env`
- Agregar: `VPS_SHARED_SECRET=<random-string>` (misma en Vercel y VPS)
- VPS ya tiene `DATABASE_URL` (PostgreSQL local) — usar la misma conexión para guardar chunks en la tabla `messages` de Supabase (remote connection)

### Frontend — `/src/app/api/chat/route.ts`
- Mantener validación de usuario y límites
- Nueva sub-ruta: `POST /api/auth/vps-token` — genera y devuelve JWT temporal
- El flujo actual de `POST /api/chat` sigue funcionando para mensajes de texto (compatibilidad), pero el frontend migrará progresivamente a usar streaming directo

### Frontend — `/src/components/ChatInterface.tsx`
- Nuevo `useVPSStream()` hook o integración inline
- Al enviar mensaje: (1) obtener token, (2) conectar SSE al VPS, (3) mostrar chunks en tiempo real
- El typing simulado (`smoothReveal`) se elimina — se muestra el texto tal cual llega
- Mantener el subscription realtime de Supabase para recibir mensajes del otro dispositivo
- El stream guarda en DB por el VPS, así que el otro dispositivo recibe todo via realtime

### Frontend — `Supabase messages table`
- La tabla `messages` ya existe. El VPS hace upsert con `id=message_id` (provisto por el frontend) para que el subscription realtime funcione correctamente.
- El campo `content` se actualiza incrementalmente con `content = content + new_chunk` (concatenación)

---

## Formato de Eventos SSE

### Del VPS al browser:

```
event: chunk
data: {"type":"chunk","text":"H","is_deep":false}

event: chunk
data: {"type":"chunk","text":"ola","is_deep":false}

event: done
data: {"type":"done","is_deep":true,"context_delta":{"add_notes":"..."}}

event: error
data: {"type":"error","message":"..."}
```

### Campos por evento:

| Tipo | Campos |
|---|---|
| `chunk` | `type`, `text`, `is_deep` |
| `done` | `type`, `is_deep`, `context_delta` |
| `error` | `type`, `message` |

---

## Validación de Seguridad

1. El JWT tiene expiry de 30 segundos (足够 para establecer la conexión)
2. El VPS verifica `exp` y `userId` del JWT
3. El VPS también verifica que el `user_id` en query params coincida con el del JWT
4. El mensaje se asocia al `user_id` del JWT, no de query params
5. La conexión HTTPS entre browser y VPS: el VPS escucha en `http://177.7.46.156:3000` — el browser puede recibir warnings de "no seguro" (sin SSL). Opcionalmente se puede agregar un proxy Nginx con SSL en el VPS más adelante.

---

## Fallback

Si el streaming falla o el token expira, el frontend puede volver al método actual (POST a `/api/chat` en Vercel que devuelve respuesta completa). El mensaje de error del stream indica al frontend que haga retry con el método clásico.

---

## Compatibilidad con cross-device

El flujo cross-device funciona así:
1. Dispositivo A envía mensaje → se inserta en `messages` → llega a Dispositivo B
2. VPS hace streaming a Dispositivo A y guarda chunks en `messages` (upsert)
3. Cada chunk insertado llega a Dispositivo B via Supabase realtime `INSERT`
4. Dispositivo B muestra los chunks tal cual llegan (sin typing simulado)

---

## Tareas de Implementación

1. VPS: agregar JWT + streaming endpoint (`/api/stream`)
2. VPS: modificar orchestrator para streaming + DB persistence
3. Frontend: nueva ruta `/api/auth/vps-token`
4. Frontend: migrar `ChatInterface.tsx` a usar streaming directo
5. Probar y verificar en ambos dispositivos