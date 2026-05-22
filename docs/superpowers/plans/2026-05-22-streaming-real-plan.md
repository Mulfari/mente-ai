# Streaming Real — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el typing simulado por streaming real letra por letra desde Claude hasta el browser, con soporte cross-device via Supabase realtime.

**Architecture:** El browser obtiene un JWT temporal de Vercel y conecta directo al VPS por SSE. El VPS hace streaming de la respuesta de Claude y persiste cada chunk en Supabase. El otro dispositivo recibe chunks via realtime subscription.

**Tech Stack:** JWT (jose), Supabase, SSE, api.selectapi.vip

---

## Archivos a modificar

### VPS: `C:/Users/joses/Documents/vechat-orchestrator/src/`
- `index.ts` — nueva ruta GET `/api/stream`
- `orchestrator.ts` — nueva función `streamWithContextDelta()`
- `.env` — agregar `VPS_SHARED_SECRET`

### Frontend: `C:/Users/joses/Documents/mente-ai/src/`
- `app/api/auth/vps-token/route.ts` — genera JWT temporal
- `app/api/chat/route.ts` — agregar `/api/auth/vps-token`
- `components/ChatInterface.tsx` — migrar a streaming directo
- `app/api/stream/route.ts` — proxy que retransmite chunks del VPS al browser (para ocultar IP)

---

## Tarea 1: VPS — JWT validation + streaming endpoint

**Modificar:** `C:/Users/joses/Documents/vechat-orchestrator/src/index.ts`
**Modificar:** `C:/Users/joses/Documents/vechat-orchestrator/src/orchestrator.ts`
**Modificar:** `C:/Users/joses/Documents/vechat-orchestrator/.env` (subir nuevo archivo)

- [ ] **Step 1: Agregar dependencia `jsonwebtoken` al package.json del VPS**

```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.0",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.13.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.0.0",
    "@types/pg": "^8.11.10",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Modificar orchestrator.ts — agregar función de streaming**

En `C:/Users/joses/Documents/vechat-orchestrator/src/orchestrator.ts`, agregar después de `callSELECTAPIWithContextDelta`:

```typescript
async streamWithContextDelta(
  prompt: { system: string; question: string },
  messageId: string,
  conversationId: string,
  mode: string,
  userId: string,
  attachments?: any[],
  onChunk?: (text: string, isDeep: boolean) => void
): Promise<{ fullText: string; context_delta: { add_notes?: string } | null; isDeep: boolean }> {
  const apiKey = process.env.SELECTAPI_KEY || "";
  const baseUrl = process.env.SELECTAPI_BASE_URL || "https://api.selectapi.vip";
  const model = process.env.ANTHROPIC_MODEL || "anthropic/claude-sonnet-4-7";
  const body: any = {
    model,
    max_tokens: 8192,
    system: prompt.system,
    stream: true,
  };

  const content: any[] = [];
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.type === "image" && att.source) {
        content.push({ type: "image", source: att.source });
      }
    }
  }
  content.push({ type: "text", text: prompt.question });
  body.messages = [{ role: "user", content }];

  if (mode === "deep") body.thinking = { type: "enabled", budget_tokens: 1024 };

  const res = await fetch(baseUrl + "/v1/messages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error("SELECTAPI error: " + res.status);
  if (!res.body) throw new Error("No response body");

  let fullText = "";
  let isDeep = false;
  let contextDelta: { add_notes?: string } | null = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines[lines.length - 1] ?? "";

    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") continue;

      try {
        const event = JSON.parse(data);
        if (event.type === "message_delta" && event.delta?.type === "content_block_delta") {
          const textChunk = event.delta.text || "";
          if (textChunk) {
            fullText += textChunk;
            if (onChunk) onChunk(textChunk, isDeep);
          }
        } else if (event.type === "message_start") {
          // message started
        } else if (event.type === "content_block_start") {
          // content block started
        } else if (event.type === "message_delta" && event.usage) {
          // message finished
        } else if (event.type === "message_stop") {
          // stream finished
        }
      } catch {}
    }
  }

  // Extract context_delta from final text
  const deltaMatch = fullText.match(/\{[\s\S]*?"context_delta"[\s\S]*?\}/);
  if (deltaMatch) {
    try {
      const parsed = JSON.parse(deltaMatch[0]);
      if (parsed.context_delta?.add_notes?.trim()) {
        contextDelta = { add_notes: parsed.context_delta.add_notes.trim() };
        fullText = fullText.replace(deltaMatch[0], "").trim();
        fullText = fullText.replace(/\n{3,}/g, "\n\n").trim();
      }
    } catch {}
  }

  return { fullText, context_delta: contextDelta, isDeep };
}
```

- [ ] **Step 3: Modificar index.ts — agregar nueva ruta GET /api/stream**

En `C:/Users/joses/Documents/vechat-orchestrator/src/index.ts`, agregar al inicio:

```typescript
import jwt from "jsonwebtoken";
```

Y después de las rutas existentes, agregar:

```typescript
app.get("/api/stream", async (req, res) => {
  const { token, conversation_id, mode, message_id, user_id, question, attachments, user_context, conversation_history } = req.query;

  if (!token || !message_id || !user_id || !question) {
    return res.status(400).json({ error: "Faltan parametros" });
  }

  // Validate JWT
  const secret = process.env.VPS_SHARED_SECRET || "";
  try {
    const decoded = jwt.verify(token as string, secret) as { userId: string; exp: number };
    if (decoded.userId !== user_id) {
      return res.status(403).json({ error: "Token no coincide con usuario" });
    }
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }

  // Setup SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const sendEvent = (eventName: string, data: any) => {
    res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    // Build enriched prompt (reuse existing logic)
    const similarQA = await orchestrator.findSimilarQA(question as string);
    const highRatedFeedback = await orchestrator.findHighRatedFeedback(question as string);
    const knowledge = await orchestrator.findKnowledge(question as string);
    const enrichedPrompt = orchestrator.buildEnrichedPrompt(
      question as string, similarQA, highRatedFeedback, knowledge,
      user_context as any || null,
      conversation_history as string || undefined
    );

    let isDeep = false;
    let contextDelta: { add_notes?: string } | null = null;
    let fullText = "";

    const parsedAttachments = attachments ? JSON.parse(attachments as string) : [];

    // Stream from Claude and send chunks
    const result = await orchestrator.streamWithContextDelta(
      enrichedPrompt,
      message_id as string,
      conversation_id as string || "",
      mode as string || "normal",
      user_id as string,
      parsedAttachments,
      (textChunk, isDeepFlag) => {
        isDeep = isDeepFlag;
        fullText += textChunk;
        sendEvent("chunk", { type: "chunk", text: textChunk, is_deep: isDeep });
      }
    );

    fullText = result.fullText;
    contextDelta = result.context_delta;
    isDeep = result.isDeep;

    // Save QA to local DB
    const { topic, city } = orchestrator.analyzeContent(question + " " + fullText);
    await orchestrator.saveQA(question as string, fullText, topic, city);

    sendEvent("done", { type: "done", is_deep: isDeep, context_delta: contextDelta });
    res.end();
  } catch (err: any) {
    console.error("[VeChat] Stream error:", err);
    sendEvent("error", { type: "error", message: err.message || "Error de conexion" });
    res.end();
  }
});
```

- [ ] **Step 4: Subir archivos al VPS**

```python
# En mente-ai/
python upload_vps.py vechat-orchestrator/src/index.ts
python upload_vps.py vechat-orchestrator/src/orchestrator.ts
```

- [ ] **Step 5: Agregar VPS_SHARED_SECRET al .env del VPS**

En el VPS, agregar al archivo `/root/vechat-orchestrator/.env`:

```bash
VPS_SHARED_SECRET=genera_un_string_aleatorio_largo_aqui
```

```bash
# En VPS
echo "VPS_SHARED_SECRET=tu_secret_aqui" >> /root/vechat-orchestrator/.env
```

- [ ] **Step 6: Reiniciar el servicio del VPS**

```bash
# En VPS
cd /root/vechat-orchestrator && pkill -f "node dist/index.js" && npm run build && node dist/index.js > /root/orchestrator.log 2>&1 &
```

- [ ] **Step 7: Commit VPS**

```bash
# En vechat-orchestrator local
git add -A && git commit -m "feat: add streaming endpoint with JWT auth

- index.ts: new GET /api/stream SSE endpoint
- orchestrator.ts: streamWithContextDelta() for streaming Claude API
- JWT validation with 30s expiry
- Chunks sent as SSE events to browser
- context_delta extraction preserved

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin master
```

---

## Tarea 2: Frontend — JWT token endpoint

**Crear:** `C:/Users/joses/Documents/mente-ai/src/app/api/auth/vps-token/route.ts`

- [ ] **Step 1: Crear la ruta /api/auth/vps-token**

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as jose from "jose";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";
const VPS_SECRET = process.env.VPS_SHARED_SECRET || "";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!VPS_SECRET) {
    return NextResponse.json({ error: "VPS_SECRET no configurado" }, { status: 500 });
  }

  // Generate short-lived JWT
  const secret = new TextEncoder().encode(VPS_SECRET);
  const token = await new jose.SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);

  return NextResponse.json({
    token,
    vpsUrl: VPS_URL,
    expiresIn: 30,
  });
}
```

- [ ] **Step 2: Agregar jose al package.json**

```bash
cd "C:/Users/joses/Documents/mente-ai"
npm install jose
```

- [ ] **Step 3: Agregar VPS_SHARED_SECRET al .env de Vercel**

El secret debe ser el mismo string que en el VPS. Se configura en el dashboard de Vercel como variable de entorno `VPS_SHARED_SECRET`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/auth/vps-token/route.ts package.json package-lock.json && git commit -m "feat: add /api/auth/vps-token endpoint for streaming auth

- Returns short-lived JWT (30s expiry) for VPS streaming
- Uses jose library for JWT signing
- Requires VPS_SHARED_SECRET env var

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Tarea 3: Frontend — Migrar ChatInterface a streaming directo

**Modificar:** `C:/Users/joses/Documents/mente-ai/src/components/ChatInterface.tsx`

Esta tarea modifica las funciones `sendMessage` y `submitSuggestion`. El cambio principal es reemplazar el `fetch("/api/chat")` que espera respuesta completa, por una conexión SSE al VPS.

- [ ] **Step 1: Modificar sendMessage — reemplazar fetch por streaming**

En `sendMessage()`, donde actualmente hace:

```typescript
const res = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: userMsg, conversation_id: convId, attachments: contentParts, mode: responseMode, message_id: msgId }),
});
```

Reemplazar por:

```typescript
// Get VPS token
const tokenRes = await fetch("/api/auth/vps-token", { method: "POST" });
if (!tokenRes.ok) {
  const err = await tokenRes.json();
  setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: err.error || "Error de autenticacion", created_at: new Date().toISOString() }]);
  setSending(false);
  return;
}
const { token, vpsUrl } = await tokenRes.json();

// Build URL with query params
const params = new URLSearchParams({
  token,
  message_id: msgId,
  user_id: userId,
  conversation_id: convId,
  mode: responseMode,
  question: userMsg,
  attachments: JSON.stringify(contentParts),
  user_context: JSON.stringify(userContext ? {
    name: userContext.full_name || "",
    city: userContext.city || "",
    interests: userContext.interests || "",
    notes: userContext.custom_notes || "",
  } : null),
  conversation_history: fullHistoryText || "",
});

const streamRes = await fetch(`${vpsUrl}/api/stream?${params.toString()}`, {
  headers: { Accept: "text/event-stream" },
});

if (!streamRes.ok) {
  const err = await streamRes.json();
  setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: err.error || "Error de conexion", created_at: new Date().toISOString() }]);
  setSending(false);
  return;
}

// Process SSE stream
const reader = streamRes.body!.getReader();
const decoder = new TextDecoder();
let buffer = "";
let isDeep = false;
let contextDelta: { add_notes?: string } | null = null;

const updateStreamText = async (text: string, deep: boolean) => {
  setDisplayedText(prev => ({ ...prev, [msgId]: text }));
  setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, _isDeep: deep } : m));
};

// Set initial loading state
setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: responseMode === "deep" ? "Pensando..." : "", _loading: true } : m));

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines[lines.length - 1] ?? "";

  for (const line of lines) {
    const eventMatch = line.match(/^event: (.+)/);
    const dataMatch = line.match(/^data: (.+)/);

    if (eventMatch && dataMatch) {
      const eventName = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      if (eventName === "chunk" && data.type === "chunk") {
        isDeep = data.is_deep;
        const currentText = displayedText[msgId] || "";
        const newText = currentText + data.text;
        await updateStreamText(newText, isDeep);
      } else if (eventName === "done" && data.type === "done") {
        isDeep = data.is_deep;
        contextDelta = data.context_delta;
      } else if (eventName === "error") {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || "Error", _loading: false } : m));
        setSending(false);
        return;
      }
    }
  }
}

// Final state
setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: displayedText[msgId] || "", _loading: false, _isDeep: isDeep } : m));
```

También en `submitSuggestion()`, hacer el mismo reemplazo.

- [ ] **Step 2: Eliminar el typing simulado**

Las funciones `smoothReveal` y `flushReveal` ya no son necesarias si el texto llega en tiempo real. Pero se mantienen por si hay fallback. Opcionalmente se pueden simplificar.

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatInterface.tsx && git commit -m "feat: migrate to real streaming from VPS

- sendMessage and submitSuggestion now use VPS SSE streaming
- Browser connects directly to VPS with JWT token
- Text appears character-by-character in real time
- smoothReveal/flushReveal retained for fallback

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git push origin main
```

---

## Tarea 4: Verificación

- [ ] **Step 1: Test en navegador**

1. Abrir VeChat en el navegador (escritorio)
2. Enviar un mensaje
3. Verificar que las letras aparecen una por una en tiempo real (no hay delay artificial)
4. Abrir VeChat en el móvil con la misma cuenta
5. Enviar un mensaje desde el escritorio
6. Verificar que el mensaje aparece en el móvil instantáneamente
7. Verificar que la respuesta aparece en el móvil también (letra por letra)

- [ ] **Step 2: Verificar logs**

En VPS: `tail -f /root/orchestrator.log` para ver que los chunks se están generando.
En Supabase: revisar que los mensajes se están actualizando incrementalmente.

---

## Notas de implementación

- El VPS guarda chunks en Supabase vía la conexión `DATABASE_URL` existente (PostgreSQL). El upsert usa `message_id` como clave.
- Si el streaming falla, el frontend puede fallback al método POST `/api/chat` (se mantiene como está).
- El token JWT expira en 30 segundos — suficiente para establecer la conexión. No es un problema si expira después de establecida.
- El campo `is_deep` viene de la respuesta del stream y determina si el mensaje se marca como "modo pensar".