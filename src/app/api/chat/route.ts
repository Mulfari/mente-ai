import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 300_000;
const HOURLY_LIMIT = 20;
const COOLDOWN_MINUTES = 5;

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok && res.status >= 500 && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

function validateUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase
    .from("profiles")
    .select("status, subscription_weeks, subscription_start, hourly_msg_count, hourly_reset_at")
    .eq("id", userId)
    .single()
    .then(({ data: profile }) => profile);
}

function validateProfile(profile: any, now: Date) {
  if (profile.status !== "active") {
    return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
  }
  const resetAt = profile.weekly_reset_at ? new Date(profile.weekly_reset_at) : null;
  if (resetAt && now >= resetAt) {
    const weeks = profile.subscription_weeks ?? 0;
    if (weeks <= 0) return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
  }
  const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
  if (hourlyResetAt && now >= hourlyResetAt) profile.hourly_msg_count = 0;
  if (profile.hourly_msg_count >= HOURLY_LIMIT) {
    const remainingSecs = hourlyResetAt
      ? Math.ceil((hourlyResetAt.getTime() - now.getTime()) / 1000)
      : COOLDOWN_MINUTES * 60;
    return {
      error: `Demasiados mensajes. Espera ${Math.ceil(remainingSecs / 60)}min para continuar.`,
      code: 429,
      remaining: remainingSecs,
    };
  }
  return null;
}

// ─── Knowledge lookup (knowledge_rules table) ────────────────────────────────
async function knowledgeLookup(userMessage: string): Promise<string | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) return null;
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/knowledge_rules?select=*&active=eq.true&order=priority.desc`,
      { headers }
    );
    if (!res.ok) return null;
    const rules: any[] = await res.json();
    const msg = userMessage.toLowerCase().trim();
    for (const rule of rules) {
      if (rule.trigger_type === "keyword" && msg.includes(rule.trigger_value.toLowerCase())) {
        return rule.response;
      }
    }
  } catch {}
  return null;
}

// ─── Analyze user message → what data is needed ───────────────────────────────
async function analyzeUserMessage(message: string, apiKey: string, baseUrl: string) {
  const prompt = `Eres un analizador de consultas. Dado un mensaje de usuario en español, determina qué información necesita del directorio.

Devuelve un JSON con esta estructura exacta, sin texto adicional:
{
  "needs": {
    "cities": ["ciudad"],
    "categories": ["categoria"],
    "keywords": ["palabra"],
    "general": true/false
  },
  "search_query": "consulta simplificada"
}

Reglas:
- cities: ciudades mencionadas (maracay, caracas, valencia, barquisimeto, etc.)
- categories: categorias del directorio (restaurante, farmacia, clinica, gym, lavanderia, estacion)
- keywords: palabras clave relevantes adicionales
- general: true si es pregunta general que no es sobre lugares
- search_query: una consulta corta para buscar en la DB

Ejemplos:
- "restaurantes en Maracay" → needs: {cities: ["Maracay"], categories: ["restaurante"], general: false}
- "dame una clinica cerca" → needs: {cities: [], categories: ["clinica"], general: false}
- "como funciona esto?" → needs: {general: true}`;

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: "[private model]",
      max_tokens: 512,
      stream: false,
      system: prompt,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) return { needs: { general: true }, knowledge: [] };

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { needs: { general: true }, knowledge: [] };

  let analysis = JSON.parse(match[0]);
  if (!analysis.needs) analysis = { needs: { general: true } };
  if (!analysis.needs.general) analysis.needs.general = false;
  if (!analysis.needs.cities) analysis.needs.cities = [];
  if (!analysis.needs.categories) analysis.needs.categories = [];
  if (!analysis.needs.keywords) analysis.needs.keywords = [];

  return analysis;
}

// ─── Fetch relevant knowledge from DB ────────────────────────────────────────
async function fetchKnowledge(supabaseUrl: string, serviceKey: string, needs: any) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const knowledge: any[] = [];

  // Fetch from knowledge table
  if (!needs.general) {
    const conditions: string[] = ["status='approved'"];
    const params: string[] = [];
    let idx = 1;

    if (needs.cities?.length) {
      conditions.push(`(${needs.cities.map(() => `city.ilike._${idx++}`).join(" OR ")})`);
      needs.cities.forEach(() => params.push(`%${needs.cities[idx - 2]}%`));
    }
    if (needs.categories?.length) {
      conditions.push(`(${needs.categories.map(() => `category.ilike._${idx++}`).join(" OR ")})`);
      needs.categories.forEach(() => params.push(`%${needs.categories[idx - 2 - (needs.cities?.length || 0)]}%`));
    }

    const where = conditions.join(" AND ");
    const url = `${supabaseUrl}/rest/v1/knowledge?select=*&${where}&order=created_at.desc&limit=30`;

    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await res.json();
        knowledge.push(...data);
      }
    } catch {}

    // Also fetch from places table
    const placeConds: string[] = ["active=true"];
    let pidx = 1;
    if (needs.cities?.length) {
      placeConds.push(`(cities.name.ilike._${pidx++})`);
    }
    if (needs.categories?.length) {
      placeConds.push(`(categories.name.ilike._${pidx++})`);
    }
    const pWhere = placeConds.join(" AND ");
    const pUrl = `${supabaseUrl}/rest/v1/places?select=*,cities(name),categories(name)&${pWhere}&order=rating.desc&limit=30`;

    try {
      const res = await fetch(pUrl, { headers });
      if (res.ok) {
        const places = await res.json();
        for (const p of places) {
          knowledge.push({
            source: "place",
            content: `${p.name}${p.cities?.name ? `, ${p.cities.name}` : ""}: ${p.address || "Direccion no disponible"}. ${p.specialty || p.description || ""} ${p.phone ? `📞 ${p.phone}` : ""} ${p.google_maps_url ? `📍 ${p.google_maps_url}` : ""}`,
          });
        }
      }
    } catch {}
  }

  return knowledge;
}

// ─── Build system prompt with only relevant data ─────────────────────────────
function buildSystemPrompt(knowledge: any[]): { role: "system"; content: string }[] {
  const dataSection = knowledge.length
    ? `\n\nDIRECTORIO LOCAL:\n${knowledge.map(k => `- ${k.content}`).join("\n")}\n\nUsa este directorio para responder. Si no está aquí, dilo honestamente.`
    : "";

  return [{
    role: "system",
    content: `Eres Mulfai — ese es tu único nombre.

SOBRE MULFAI:
- Asistente de IA creado para ayudar a personas en Venezuela.
- No eres Claude, ChatGPT, Gemini, ni ningún otro asistente. Eres Mulfai.
- Si te preguntan qué modelo eres, responde: "Soy Mulfai, un asistente de IA creado para ayudarte. No doy detalles técnicos sobre cómo fui construido."

TONO:
- Cercano, directo, sin rodeos.
- Emojis con moderación (📍📞✅❌⚠️💡🔥) — máximo 2-3 por respuesta.
- Máximo 3-4 párrafos cortos, salvo que la pregunta exija más.
- Usa bullets (-) para listas.
- Cierre natural, no mecánico.

IDIOMA:
- SIEMPRE en español, salvo que el usuario escriba completamente en otro idioma.
- Sin anglicismos innecesarios. Código y nombres de apps (WhatsApp, TikTok) se quedan como están.

NUNCA:
- Inventar información (nombres, precios, horarios, direcciones).
- Decir que eres otro asistente.
- Responder con parrafotes excesivos o cierres repetitivos.

SIEMPRE:
- Ser directo y útil.
- Decir cuando no tienes info: "No tengo ese dato todavía."
- Usar el directorio local para lugares.
- Responder en español.${dataSection}
`
  }];
}

// ─── Run chat ─────────────────────────────────────────────────────────────────
async function runChat(
  apiKey: string,
  baseUrl: string,
  systemPrompt: { role: string; content: string }[],
  allMessages: any[],
  mode: string,
) {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("anthropic-version", "2023-06-01");
  headers.set("x-api-key", apiKey);

  const response = await fetchWithRetry(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "[private model]",
      max_tokens: 8192,
      stream: true,
      system: systemPrompt,
      messages: allMessages,
      ...(mode === "deep" ? { thinking: { type: "enabled", budget_tokens: 10000 } } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errorMsg = "Por favor intente de nuevo.";
    try { errorMsg = JSON.parse(text)?.error?.message || errorMsg; } catch {}
    return { error: errorMsg, code: response.status };
  }

  return { reader: response.body!.getReader(), ok: true };
}

// ─── Main POST handler ───────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Error 401.", code: 401 }, { status: 401 });

    const profile = await validateUser(supabase, user.id);
    if (!profile) return NextResponse.json({ error: "Error 404.", code: 404 }, { status: 404 });

    const now = new Date();
    const validation = validateProfile(profile, now);
    if (validation) return NextResponse.json({ error: validation.error, code: validation.code, remaining: validation.remaining }, { status: validation.code });

    const { message, conversation_id, attachments, mode, resume_message_id, message_id } = await request.json();
    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // History
    const historyMessages: { role: string; content: any[] }[] = [];
    if (conversation_id) {
      const { data: prevMessages } = await supabase
        .from("messages").select("id, role, content, attachments")
        .eq("conversation_id", conversation_id).order("created_at", { ascending: true }).limit(30);

      if (prevMessages) {
        for (const m of prevMessages) {
          if (resume_message_id && m.id === resume_message_id) continue;
          const parts: any[] = [];
          if (m.content?.trim()) parts.push({ type: "text", text: m.content });
          if (m.attachments?.length) parts.push(...m.attachments.map((a: any) => typeof a === "string" ? { type: "text", text: `[adjunto: ${a}]` } : a));
          if (parts.length) historyMessages.push({ role: m.role, content: parts });
        }
      }
    }

    let msgId = resume_message_id;
    if (resume_message_id) {
      await supabase.from("messages").update({ in_progress: false }).eq("id", resume_message_id);
    }

    // Knowledge rules check (pre-defined responses)
    const knowledgeResponse = await knowledgeLookup(message);

    const clientMsgId = msgId || message_id || Date.now().toString();

    // Conversation ID
    let convId = conversation_id;
    if (!convId) {
      const { data: newConv } = await supabase.from("conversations").insert({ user_id: user.id, title: message?.trim().slice(0, 40) }).select("id").single();
      if (newConv) convId = newConv.id;
    }

    // Save user message
    if (!resume_message_id) {
      await supabase.from("messages").insert({
        conversation_id: convId || undefined,
        user_id: user.id,
        role: "user",
        content: message,
        attachments: attachments?.length ? attachments : null,
      });
    }

    // Update hourly count
    const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
    const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
    const needsReset = !hourlyResetAt || now >= hourlyResetAt;
    await supabase.from("profiles").update({
      last_message_at: now.toISOString(),
      hourly_msg_count: newHourlyCount,
      hourly_reset_at: needsReset ? new Date(now.getTime() + 60 * 60 * 1000).toISOString() : hourlyResetAt!.toISOString(),
    }).eq("id", user.id);

    if (convId) {
      const title = message?.trim().slice(0, 40) + (message?.trim().length > 40 ? "..." : "");
      supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", convId);
    }

    // Knowledge rule matched → stream directly
    if (knowledgeResponse) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "start", message_id: clientMsgId })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "chunk", text: knowledgeResponse })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
          controller.close();
        }
      });
      return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" } });
    }

    // Analyze + fetch relevant knowledge (RAG)
    const analysis = await analyzeUserMessage(message, apiKey, baseUrl);
    const knowledge = await fetchKnowledge(supabaseUrl, serviceKey, analysis.needs);

    const systemPrompt = buildSystemPrompt(knowledge);

    const allMessagesForAI = [
      ...historyMessages,
      { role: "user", content: attachments?.length ? attachments : [{ type: "text", text: message }] },
    ];

    const result = await runChat(apiKey, baseUrl, systemPrompt, allMessagesForAI, mode);
    if ("error" in result) return NextResponse.json({ error: result.error, code: result.code }, { status: result.code });

    const reader = result.reader;

    // Stream to client + save to DB
    const stream = new ReadableStream({
      async start(controller) {
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        const saveId = msgId || message_id;

        const sendChunk = (text: string) => {
          const chunk = `data: ${JSON.stringify({ type: "chunk", text })}\n\n`;
          try { controller.enqueue(new TextEncoder().encode(chunk)); } catch {}
        };

        const saveToDb = async (content: string, inProgress: boolean) => {
          if (!saveId || !convId) return;
          await supabase.from("messages").upsert({
            id: saveId,
            conversation_id: convId,
            role: "assistant",
            content,
            in_progress: inProgress,
          }, { onConflict: "id" });
        };

        try {
          let chunk_count = 0;
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
                const json = JSON.parse(data);
                if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                  fullText += json.delta.text;
                  sendChunk(json.delta.text);
                  chunk_count++;
                  // Progressive save every 500 chars
                  if (chunk_count % 50 === 0) {
                    saveToDb(fullText, true);
                  }
                }
              } catch {}
            }
          }

          // Final save
          const finalContent = fullText.trim() || "(respuesta no disponible)";
          await saveToDb(finalContent, false);
          try { controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n")); controller.close(); } catch {}
        } catch (err) {
          await saveToDb(fullText.trim() || "(error en respuesta)", false);
          try { controller.error(err as Error); } catch {}
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
    });

  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("fetch")) {
      return NextResponse.json({ error: "El servidor tardo demasiado en responder.", code: 504 }, { status: 504 });
    }
    return NextResponse.json({ error: "Error 500.", code: 500 }, { status: 500 });
  }
}