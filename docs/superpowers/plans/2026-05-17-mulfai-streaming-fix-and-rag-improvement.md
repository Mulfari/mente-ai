# Mulfai — Fix Streaming + Improve RAG Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir el streaming SSE roto (backend envía `delta/content`, frontend espera `chunk/text`) + mejorar el pipeline RAG para que el prompt se enriquezca mejor con contexto local antes de cada consulta.

**Root Cause (streaming):** `route.ts` fue cambiado a formato nativo de Anthropic SSE (`content_block_start`, `content_block_delta`) reenviando eventos. El frontend (`ChatInterface.tsx`) espera el formato original `type: "chunk", text: "..."` en dos lugares (líneas ~752 y ~1088).

**Architecture:** Chat principal en `/api/chat` — flujo actual: `analyzeUserMessage` → `fetchKnowledge` → `buildSystemPrompt` → `runChat`. El enriquecimiento de prompt ya existe pero es básico. Se mejora la calidad del contexto y se asegura que el streaming funcione.

---

## Task 1: Fix streaming — normalize SSE event format

**Files:**
- Modify: `src/app/api/chat/route.ts:310-396`

- [ ] **Step 1: Read current streaming section**

Locate lines 310-396 in `route.ts` (the `ReadableStream` in the POST handler). Identify where `sendEvent({ type: "message_start" })` and `sendEvent({ type: "delta", ... })` are called.

- [ ] **Step 2: Change `content_block_delta` handler to emit `chunk/text` format**

In the `readStream` async function inside the stream (around line 372), find:
```typescript
if (json.type === "content_block_delta" && json.delta?.text) {
  const delta = json.delta.text;
  fullResponse += delta;
  const upserted = await supabase.from("messages").upsert({ ... });
  sendEvent({ type: "delta", id: latestMsgId, content: fullResponse });
}
```

Change to:
```typescript
if (json.type === "content_block_delta" && json.delta?.text) {
  const delta = json.delta.text;
  fullResponse += delta;
  await supabase.from("messages").upsert({
    id: latestMsgId,
    conversation_id: convId,
    role: "assistant",
    content: fullResponse,
  }, { onConflict: "id" });
  sendEvent({ type: "chunk", id: latestMsgId, text: delta });
}
```

**Key changes:**
- Remove the cumulative `content` from `sendEvent` — only send the incremental `text` delta
- Update DB with `fullResponse` (cumulative) but send only `delta` to frontend
- Change event type from `"delta"` to `"chunk"`
- Change field from `content` to `text`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/joses/Documents/mente-ai
git add src/app/api/chat/route.ts
git commit -m "fix(chat): emit SSE as type=chunk/text to match frontend expectation"
git push
```

- [ ] **Step 4: Verify** — Deploy to Vercel, send a test message in the chat. The three dots should resolve with actual text.

---

## Task 2: Clean up dead code in streaming handler

**Files:**
- Modify: `src/app/api/chat/route.ts:356-385`

- [ ] **Step 1: Identify dead code**

The `content_block_start` handler creates an assistant message in DB and sends `message_start`. The `done` handler also saves the final message. This is redundant since:
- `content_block_delta` already upserts on every chunk
- The final `done` event also saves

Remove the `content_block_start` block and the DB save in `done` (keep the `sendEvent({ type: "done" })` and `controller.close()`).

The clean `readStream` loop should be:
```typescript
while (true) {
  const { done: d, value } = await reader.read();
  if (d) {
    sendEvent({ type: "done" });
    controller.close();
    return;
  }
  if (value) {
    const raw = new TextDecoder().decode(value, { stream: true });
    accumulated += raw;
    const lines = raw.split("\n");
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === "content_block_delta" && json.delta?.text) {
            const delta = json.delta.text;
            fullResponse += delta;
            await supabase.from("messages").upsert({
              id: latestMsgId,
              conversation_id: convId,
              role: "assistant",
              content: fullResponse,
            }, { onConflict: "id" });
            sendEvent({ type: "chunk", id: latestMsgId, text: delta });
          }
        } catch {}
      }
    }
  }
}
```

Also remove the `message_start` emission — frontend doesn't handle it anyway.

- [ ] **Step 2: Commit**

```bash
cd C:/Users/joses/Documents/mente-ai
git add src/app/api/chat/route.ts
git commit -m "refactor(chat): simplify stream processing, remove dead code"
git push
```

---

## Task 3: Improve RAG — richer knowledge fetch

**Files:**
- Modify: `src/app/api/chat/route.ts:67-159`

- [ ] **Step 1: Enhance `fetchKnowledge` to include knowledge_rules**

Current `fetchKnowledge` only fetches from `knowledge` and `places` tables. Add fetching from `knowledge_rules` table (source of truth for pre-defined Q&A). These rules should be injected as part of the system prompt context.

Add after line 126 (after the `knowledge: any[]` declaration):

```typescript
// Fetch knowledge_rules (pre-defined Q&A rules from DB)
const rulesRes = await fetch(
  `${supabaseUrl}/rest/v1/knowledge_rules?select=*&active=eq.true&order=priority.desc&limit=50`,
  { headers }
);
if (rulesRes.ok) {
  const rules = await rulesRes.json();
  for (const rule of rules) {
    if (rule.trigger_type === "keyword" && rule.response) {
      knowledge.push({
        source: "rule",
        content: `[REGLA] ${rule.trigger_value}: ${rule.response}`,
      });
    }
  }
}
```

- [ ] **Step 2: Also fetch featured places first**

In the places fetch, add `featured=eq.true` as a priority filter. Featured places appear first in the data section.

In `fetchKnowledge` (around line 138), modify the `pParts` array:
```typescript
const pParts: string[] = ["active=eq.true"];
// Featured places first
const featuredUrl = `${supabaseUrl}/rest/v1/places?select=*,cities(name),categories(name)&active=eq.true&featured=eq.true&order=rating.desc&limit=10`;
const featuredRes = await fetch(featuredUrl, { headers });
if (featuredRes.ok) {
  const featured = await featuredRes.json();
  for (const p of featured) {
    knowledge.push({
      source: "place",
      content: `⭐ ${p.name}${p.cities?.name ? `, ${p.cities.name}` : ""}: ${p.address || "Direccion no disponible"}. ${p.specialty || p.description || ""} ${p.phone ? `📞 ${p.phone}` : ""} ${p.google_maps_url ? `📍 ${p.google_maps_url}` : ""}`,
    });
  }
}
// Then regular places (exclude already added featured)
const pParts: string[] = ["active=eq.true", "featured=eq.false"];
```

- [ ] **Step 3: Update `buildSystemPrompt` to format rules nicely**

The `buildSystemPrompt` function already appends knowledge. Update the data section label to make it clearer:

```typescript
dataSection = "\n\n## Contexto disponible:\n" + lines.slice(0, 30).join("\n");
```

And add a header section for rules:
```typescript
const ruleLines = knowledge
  .filter(k => k.source === "rule")
  .map(k => k.content)
  .join("\n");

const placeLines = knowledge
  .filter(k => k.source === "place")
  .map(k => k.content)
  .join("\n");

return [{
  role: "system",
  content: `Eres Mulfai, un asistente de IA útil y conversacional. Respondes en español.
Tu identidad principal es ser útil, no dar información técnica sobre modelos o arquitectura.

SIEMPRE:
- Ser directo y útil.
- Decir cuando no tienes info: "No tengo ese dato todavía."
- Usar el directorio local para lugares cuando el usuario pregunte por restaurantes, farmacias, clínicas, etc.
- Responder en español.${ruleLines ? "\n\n## Reglas de conocimiento:\n" + ruleLines : ""}${placeLines ? "\n\n## Lugares locales:\n" + placeLines : ""}
`
}];
```

- [ ] **Step 4: Commit**

```bash
cd C:/Users/joses/Documents/mente-ai
git add src/app/api/chat/route.ts
git commit -m "feat(chat): enrich RAG with knowledge_rules and featured places"
git push
```

- [ ] **Step 5: Verify** — Test with a message like "recomiéndame un restaurante en Maracay" and check if the response includes places from the DB.

---

## Task 4: Verify end-to-end

- [ ] **Step 1: Test streaming**

Send a message in the Mulfai chat. Confirm:
1. Three dots animation resolves (not stuck)
2. Response streams character by character
3. Final response is saved in DB

- [ ] **Step 2: Test RAG enrichment**

Send messages that should trigger directory lookups:
- "dame una clínica en Maracay"
- "recomiéndame un restaurante"
- "qué puedes hacer?"

Check Vercel function logs for `knowledge.length > 0` cases.

- [ ] **Step 3: Test deep mode**

Send a message with `mode: "deep"`. Confirm extended thinking still works.

---

## Files Summary

| File | Task | Change |
|------|------|--------|
| `src/app/api/chat/route.ts` | 1, 2, 3 | Fix SSE format + clean dead code + improve RAG |

## Self-Review Checklist

- [ ] Streaming fix: backend sends `type: "chunk", text` — frontend parses `json.type === "chunk" && json.text`
- [ ] No dead code: `message_start` removed, DB saves happen only in delta handler
- [ ] RAG: knowledge_rules table included in knowledge array
- [ ] RAG: featured places shown first with ⭐ prefix
- [ ] buildSystemPrompt: rules and places separated in prompt
- [ ] All changes committed and pushed
- [ ] E2E tested on Vercel deployment