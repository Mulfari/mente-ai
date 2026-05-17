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
  throw new Error("fetchWithRetry exhausted");
}

function validateUser(supabase: any, userId: string) {
  return supabase
    .from("profiles")
    .select("status, subscription_weeks, subscription_start, hourly_msg_count, hourly_reset_at, weekly_reset_at")
    .eq("id", userId)
    .single()
    .then(({ data: profile }: { data: any }) => profile);
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
      model: "claude-opus-4-6-1m",
      max_tokens: 512,
      stream: false,
      system: prompt,
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok) return { needs: { general: true } };

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { needs: { general: true } };

  let analysis = JSON.parse(match[0]);
  if (!analysis.needs) analysis = { needs: { general: true } };
  if (!analysis.needs.general) analysis.needs.general = false;
  if (!analysis.needs.cities) analysis.needs.cities = [];
  if (!analysis.needs.categories) analysis.needs.categories = [];
  if (!analysis.needs.keywords) analysis.needs.keywords = [];
  return analysis;
}

async function fetchKnowledge(supabaseUrl: string, serviceKey: string, needs: any) {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const knowledge: any[] = [];

  if (!needs.general) {
    const conditions: string[] = ["status=eq.approved"];
    needs.cities?.forEach((c: string) => conditions.push(`city=ilike.*${encodeURIComponent(c)}*`));
    needs.categories?.forEach((c: string) => conditions.push(`category=ilike.*${encodeURIComponent(c)}*`));
    const kUrl = `${supabaseUrl}/rest/v1/knowledge?select=*&${conditions.join("&")}&order=created_at.desc&limit=30`;
    const kRes = await fetch(kUrl, { headers });
    if (kRes.ok) knowledge.push(...await kRes.json());

    const pParts: string[] = ["active=eq.true"];
    if (needs.cities?.length) {
      pParts.push(`cities.name=ilike.*${encodeURIComponent(needs.cities[0])}*`);
    }
    if (needs.categories?.length) {
      pParts.push(`categories.name=ilike.*${encodeURIComponent(needs.categories[0])}*`);
    }
    const pUrl = `${supabaseUrl}/rest/v1/places?select=*,cities(name),categories(name)&${pParts.join("&")}&order=rating.desc&limit=30`;
    const pRes = await fetch(pUrl, { headers });
    if (pRes.ok) {
      const places = await pRes.json();
      for (const p of places) {
        knowledge.push({
          source: "place",
          content: `${p.name}${p.cities?.name ? `, ${p.cities.name}` : ""}: ${p.address || "Direccion no disponible"}. ${p.specialty || p.description || ""} ${p.phone ? `📞 ${p.phone}` : ""} ${p.google_maps_url ? `📍 ${p.google_maps_url}` : ""}`,
        });
      }
    }
  }

  return knowledge;
}

async function buildSystemPrompt(serviceKey: string, supabaseUrl: string, userMessage: string, knowledge: any[]) {
  let dataSection = "";
  if (knowledge.length > 0) {
    const lines = knowledge.map(k => k.content || (typeof k === "string" ? k : "")).filter(Boolean);
    if (lines.length) {
      dataSection = "\n\n## Contexto del directorio:\n" + lines.slice(0, 20).join("\n");
    }
  }

  return [{
    role: "system",
    content: `Eres Mulfai, un asistente de IA útil y conversacional. Respondes en español.
Tu identidad principal es ser útil, no dar información técnica sobre modelos o arquitectura.

SIEMPRE:
- Ser directo y útil.
- Decir cuando no tienes info: "No tengo ese dato todavía."
- Usar el directorio local para lugares.
- Responder en español.${dataSection}
`
  }];
}

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
      model: "claude-opus-4-6-1m",
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

    const clientMsgId = msgId || message_id || Date.now().toString();

    let convId = conversation_id;
    if (!convId) {
      const { data: newConv } = await supabase
        .from("conversations").insert({ user_id: user.id }).select("id").single();
      convId = newConv?.id;
    }

    const contentObj = message?.trim()
      ? { type: "text", text: message }
      : (attachments?.length ? { type: "text", text: attachments[0] } : null);

    if (contentObj) {
      const { data: inserted } = await supabase.from("messages").insert({
        id: msgId || undefined,
        conversation_id: convId,
        role: "user",
        content: message || "",
        attachments: attachments || [],
      }).select("id").single();
      if (inserted && !msgId) msgId = inserted.id;
    }

    const analysis = await analyzeUserMessage(message, apiKey, baseUrl);
    const knowledge = await fetchKnowledge(supabaseUrl, serviceKey, analysis.needs);
    const systemPrompt = await buildSystemPrompt(serviceKey, supabaseUrl, message, knowledge);

    const allMessagesForAI = [
      ...historyMessages,
      ...(message?.trim() ? [{ role: "user", content: [{ type: "text", text: message }] }] : []),
    ];

    const result = await runChat(apiKey, baseUrl, systemPrompt, allMessagesForAI, mode || "normal");

    if (result.error) {
      return NextResponse.json({ error: result.error, code: result.code || 500 }, { status: result.code || 500 });
    }

    const { reader } = result;

    const assistantMsgId = msgId || Date.now().toString() + "-a";
    let fullResponse = "";
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ type: "start", message_id: assistantMsgId });

          let accumulated = "";
          let latestMsgId = assistantMsgId;

          const readStream = async () => {
            try {
              while (true) {
                const { done: d, value } = await reader!.read();
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
                        if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
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
            } catch (err: any) {
              sendEvent({ type: "error", error: err.message });
              controller.close();
            }
          };

          await readStream();
        } catch (err: any) {
          sendEvent({ type: "error", error: err.message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error" }, { status: 500 });
  }
}