import { createClient } from "@/lib/supabase/server";
import {
  buildTopics,
  normalizeKey,
  sanitizePrompt,
  serializeTopics,
  type EventRow,
} from "@/lib/feed";

// ============================================================================
// Fase 2 del algoritmo del feed: canonicalización con IA + materialización.
//
// Lo ejecuta el cron (/api/cron/feed-digest). En cada corrida:
//   1. Toma las preguntas crudas recientes que aún no tienen tema asignado.
//   2. Un LLM barato las agrupa con los temas existentes o crea temas nuevos:
//      pregunta pública limpia + categoría + filtro de publicabilidad
//      ("a como esta el dolar" y "precio del dólar hoy" => un solo tema).
//   3. Remapea TODOS los eventos de la semana a sus temas canónicos y
//      reagrega con el ranking de fase 1 (personas, decaimiento, pico).
//   4. Materializa los temas agregados en feed_cache — /api/feed los sirve
//      al instante sin agregar nada por request.
//
// LLM agnóstico al proveedor:
//   - FEED_LLM_URL + FEED_LLM_KEY + FEED_LLM_MODEL => endpoint
//     OpenAI-compatible (/chat/completions): MiniMax, selectapi, etc.
//   - Si no están, cae a ANTHROPIC_API_KEY/ANTHROPIC_BASE_URL (formato
//     Messages, igual que /api/analyze) con ANTHROPIC_MODEL.
//   - Sin credenciales: el digest igual reagrega y materializa (los temas
//     nuevos quedan sin canonicalizar hasta que haya modelo).
// ============================================================================

const MAX_NEW_PER_RUN = 120; // preguntas nuevas a canonicalizar por corrida
const LLM_BATCH = 25;
const EXISTING_TOPICS_CONTEXT = 300; // temas existentes que ve el LLM

const VALID_CATEGORIES = new Set([
  "comida", "servicios", "ofertas", "tramites", "negocios", "salud", "general",
]);

type CanonResult = {
  /** número (1-based) de la pregunta cruda a la que responde */
  i: number;
  /** número (1-based) del tema existente al que pertenece, o null si es nuevo */
  match: number | null;
  canonical: string;
  category: string;
  ok: boolean;
};

function buildLlmPrompt(prompts: string[], existing: string[]): string {
  const existingList = existing.length
    ? existing.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : "(ninguno todavía)";
  const newList = prompts.map((p, i) => `${i + 1}. ${p}`).join("\n");
  return `Eres el curador del feed de tendencias de VeChat (asistente IA para público venezolano).

TEMAS EXISTENTES (numerados):
${existingList}

PREGUNTAS CRUDAS NUEVAS (numeradas):
${newList}

Para CADA pregunta cruda devuelve un objeto JSON:
- "i": número de la pregunta cruda
- "match": número del TEMA EXISTENTE si pregunta lo mismo (aunque esté escrito distinto), o null si es un tema nuevo
- "canonical": la pregunta reescrita como pregunta pública limpia y neutra en español venezolano (máx. 80 caracteres, bien redactada, sin nombres propios de personas, sin teléfonos/cédulas/direcciones exactas). Si match no es null, repite el texto del tema existente.
- "category": una de: comida, servicios, ofertas, tramites, negocios, salud, general
- "ok": false si NO es publicable en un feed público (datos personales, contenido ofensivo o sexual, peticiones íntimas, texto sin sentido); true si sí.

Responde SOLO con un array JSON válido, sin texto adicional:
[{"i":1,"match":null,"canonical":"...","category":"...","ok":true}, ...]`;
}

function extractJsonArray(text: string): CanonResult[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(text.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr as CanonResult[];
  } catch {
    return null;
  }
}

async function callLlm(prompt: string): Promise<string | null> {
  const oaiUrl = process.env.FEED_LLM_URL;
  const oaiKey = process.env.FEED_LLM_KEY;
  if (oaiUrl && oaiKey) {
    // Endpoint OpenAI-compatible (MiniMax, selectapi, etc.)
    const res = await fetch(`${oaiUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${oaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.FEED_LLM_MODEL || "",
        max_tokens: 3000,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
  const model = process.env.FEED_LLM_MODEL || process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model,
      max_tokens: 3000,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.content?.[0]?.text ?? null;
}

export type DigestStats = {
  eventsScanned: number;
  newPrompts: number;
  llmProcessed: number;
  topicsCreated: number;
  aliasesCreated: number;
  cachedTopics: number;
  llmAvailable: boolean;
};

export async function runFeedDigest(): Promise<DigestStats> {
  const supabase = createClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();

  const stats: DigestStats = {
    eventsScanned: 0,
    newPrompts: 0,
    llmProcessed: 0,
    topicsCreated: 0,
    aliasesCreated: 0,
    cachedTopics: 0,
    llmAvailable: Boolean(
      (process.env.FEED_LLM_URL && process.env.FEED_LLM_KEY) || process.env.ANTHROPIC_API_KEY
    ),
  };

  // 1) Eventos de la semana
  const { data: rawEvents, error: evErr } = await supabase
    .from("query_events")
    .select("prompt, category_id, city, created_at, user_id")
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (evErr) throw new Error(`query_events: ${evErr.message}`);
  const events: EventRow[] = rawEvents ?? [];
  stats.eventsScanned = events.length;

  // 2) Alias y temas existentes
  const { data: aliasRows, error: alErr } = await supabase
    .from("feed_topic_aliases")
    .select("key, topic_key");
  if (alErr) throw new Error(`feed_topic_aliases: ${alErr.message} (¿migración aplicada?)`);
  const aliasMap = new Map<string, string>((aliasRows ?? []).map((a) => [a.key, a.topic_key]));

  const { data: topicRows, error: tpErr } = await supabase
    .from("feed_topics")
    .select("canonical_key, canonical, category_id")
    .order("created_at", { ascending: false })
    .limit(EXISTING_TOPICS_CONTEXT);
  if (tpErr) throw new Error(`feed_topics: ${tpErr.message}`);
  const topicsTable = new Map<string, { canonical: string; category: string }>(
    (topicRows ?? []).map((t) => [t.canonical_key, { canonical: t.canonical, category: t.category_id }])
  );

  // 3) Preguntas crudas sin tema asignado (únicas, publicables)
  const pending = new Map<string, { prompt: string; category: string | null }>();
  for (const e of events) {
    if (pending.size >= MAX_NEW_PER_RUN) break;
    const clean = sanitizePrompt(e.prompt);
    if (!clean) continue;
    const key = normalizeKey(clean);
    if (aliasMap.has(key) || pending.has(key)) continue;
    pending.set(key, { prompt: clean, category: e.category_id });
  }
  stats.newPrompts = pending.size;

  // 4) Canonicalización con el LLM, en lotes
  if (pending.size > 0 && stats.llmAvailable) {
    const pendingArr = [...pending.entries()];
    const existingArr = [...topicsTable.entries()]; // [key, {canonical, category}]

    for (let off = 0; off < pendingArr.length; off += LLM_BATCH) {
      const batch = pendingArr.slice(off, off + LLM_BATCH);
      const llmText = await callLlm(
        buildLlmPrompt(batch.map(([, v]) => v.prompt), existingArr.map(([, v]) => v.canonical))
      );
      const results = llmText ? extractJsonArray(llmText) : null;
      if (!results) continue; // lote fallido: queda pendiente para la próxima corrida

      const newTopics: { canonical_key: string; canonical: string; category_id: string }[] = [];
      const newAliases: { key: string; topic_key: string }[] = [];

      for (const r of results) {
        const idx = (r.i ?? 0) - 1;
        if (idx < 0 || idx >= batch.length) continue;
        const [rawKey] = batch[idx];
        if (r.ok === false) continue; // no publicable: sin alias, no vuelve a procesarse vía pending cap
        let topicKey: string;
        if (r.match && r.match >= 1 && r.match <= existingArr.length) {
          topicKey = existingArr[r.match - 1][0];
        } else {
          const canonical = sanitizePrompt(String(r.canonical ?? "")) ?? batch[idx][1].prompt;
          topicKey = normalizeKey(canonical);
          if (!topicsTable.has(topicKey)) {
            const category = VALID_CATEGORIES.has(r.category) ? r.category : "general";
            topicsTable.set(topicKey, { canonical, category });
            existingArr.push([topicKey, { canonical, category }]);
            newTopics.push({ canonical_key: topicKey, canonical, category_id: category });
            // auto-alias del propio texto canónico
            if (!aliasMap.has(topicKey)) {
              aliasMap.set(topicKey, topicKey);
              newAliases.push({ key: topicKey, topic_key: topicKey });
            }
          }
        }
        if (!aliasMap.has(rawKey)) {
          aliasMap.set(rawKey, topicKey);
          newAliases.push({ key: rawKey, topic_key: topicKey });
        }
        stats.llmProcessed++;
      }

      if (newTopics.length > 0) {
        const { error } = await supabase
          .from("feed_topics")
          .upsert(newTopics, { onConflict: "canonical_key", ignoreDuplicates: true });
        if (!error) stats.topicsCreated += newTopics.length;
      }
      if (newAliases.length > 0) {
        const { error } = await supabase
          .from("feed_topic_aliases")
          .upsert(newAliases, { onConflict: "key", ignoreDuplicates: true });
        if (!error) stats.aliasesCreated += newAliases.length;
      }
    }
  }

  // 5) Remapear eventos a temas canónicos y reagregar con el ranking fase 1.
  //    Eventos sin alias (LLM caído o pendientes) conservan su texto crudo.
  const remapped: EventRow[] = events.map((e) => {
    const clean = sanitizePrompt(e.prompt);
    if (!clean) return e;
    const topicKey = aliasMap.get(normalizeKey(clean));
    if (!topicKey) return e;
    const topic = topicsTable.get(topicKey);
    if (!topic) return e;
    return { ...e, prompt: topic.canonical, category_id: topic.category };
  });
  const aggregated = buildTopics(remapped, now);
  const serialized = serializeTopics(
    [...aggregated.values()].sort((a, b) => b.score - a.score).slice(0, 200)
  );
  stats.cachedTopics = serialized.length;

  // 6) Materializar
  const { error: cacheErr } = await supabase.from("feed_cache").upsert(
    { id: "topics", payload: { topics: serialized }, updated_at: new Date().toISOString() },
    { onConflict: "id" }
  );
  if (cacheErr) throw new Error(`feed_cache: ${cacheErr.message}`);

  return stats;
}
