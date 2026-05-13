import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 300_000; // 5 min — needed for thinking mode
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

async function knowledgeLookup(userMessage: string): Promise<string | null> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    console.log("[knowledgeLookup] missing env vars, skipping");
    return null;
  }

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/knowledge_rules?select=*&active=eq.true&order=priority.desc`,
      { headers }
    );
    if (!res.ok) {
      console.log("[knowledgeLookup] DB error:", res.status);
      return null;
    }
    const rules: any[] = await res.json();
    console.log("[knowledgeLookup] rules fetched:", rules.length, "msg:", userMessage);

    const msg = userMessage.toLowerCase().trim();
    for (const rule of rules) {
      const trigger = rule.trigger_value.toLowerCase();
      if (rule.trigger_type === "keyword" && msg.includes(trigger)) {
        console.log("[knowledgeLookup] MATCH found:", trigger, "->", rule.response.slice(0, 50));
        return rule.response;
      }
    }
  } catch (e) { console.log("[knowledgeLookup] catch error:", e); }
  return null;
}

async function buildSystemPrompt(supabase: Awaited<ReturnType<typeof createClient>>, baseUrl: string, userMessage: string): Promise<{ role: "system"; content: string }[]> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  // Keywords that trigger directory lookup
  const placeKeywords = [
    "restaurante", "comida", "almuerzo", "cena", "empanada", "pizza", "hamburguesa",
    "farmacia", "medicina", "medicamento", "doctor", "clínica", "clínica", "hospital",
    "gimnasio", "gym", "ejercicio", "lavandería", "lavado", "lavar",
    "estación", "gasolina", "bomba", "estaciones de servicio",
    "dónde puedo", "dónde hay", "recomiéndame", "necesito un", "busco un",
    "en maracay", "en caracas", "en valencia", "en barquisimeto", "en venezuela",
    "lugar", "sitio", "sitios", "lugares", "cerca", "cercano",
  ];

  const msg = userMessage.toLowerCase();
  const needsPlaces = placeKeywords.some(k => msg.includes(k));

  let placesData: any[] = [];

  if (serviceKey && supabaseUrl) {
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    try {
      if (needsPlaces) {
        const placesRes = await fetch(
          `${supabaseUrl}/rest/v1/places?select=*,cities(name,slug),categories(name,icon,color)&active=eq.true&order=rating.desc&limit=200`,
          { headers }
        );
        if (placesRes.ok) placesData = await placesRes.json();
      }
    } catch {}
  }

  const placesList = placesData.map((p: any) => {
    const hoursStr = p.hours ? formatHours(p.hours) : "Horario no disponible";
    const location = p.cities?.name ? `, ${p.cities.name}` : "";
    return `- ${p.name}${location}: ${p.address || "Dirección no disponible"}. ${p.specialty || p.description || ""} ${hoursStr} ${p.phone ? `📞 ${p.phone}` : ""} ${p.whatsapp ? `WhatsApp: ${p.whatsapp}` : ""} ${p.google_maps_url ? `📍 ${p.google_maps_url}` : ""}`;
  }).join("\n");

  const basePrompt = `Eres Mulfai, un asistente de IA diseñado para ayudarte.

IDENTIDAD:
- Tu nombre es Mulfai.
- Eres un asistente de IA personal creado para usuarios en Venezuela.
- Responde siempre de forma amigable, directa y útil.

REGLAS DE IDIOMA (SIEMPRE):
- Responde SIEMPRE en español.
- Nunca mezcles idiomas. Si el usuario escribe en inglés, puedes responder brevemente en inglés pero luego continua en español.
- No uses términos técnicos en inglés cuando exista traducción natural al español.
- Para código de programación puedes usar nombres en inglés.`;

  let directorySection = "";
  if (placesList) {
    directorySection = `\n\nDIRECTORIO LOCAL:\n${placesList}\n\nCuando el usuario pregunte por lugares (restaurantes, farmacias, clínicas, gyms, lavanderías, estaciones), usa este directorio. Da siempre: nombre, dirección, horario y teléfono cuando estén disponibles. Si no tienes el dato, sé honesto: "No tengo ese lugar en mi directorio todavía." NO inventes información.`;
  }

  const instructions = needsPlaces
    ? ""
    : "\n\nSi el usuario pregunta sobre algo que no está en el directorio (opiniones personales, programación, matemáticas, etc.), responde con tu conocimiento general de forma útil.";

  return [{ role: "system", content: basePrompt + directorySection + instructions }];
}

function formatHours(hours: any): string {
  if (!hours || typeof hours !== "object") return "";
  const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
  const entries = Object.entries(hours);
  if (entries.length === 0) return "";
  return entries.map(([day, time]: [string, any]) => `${days[parseInt(day)] || day}: ${time || "cerrado"}`).join(", ");
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
      model: "claude-opus-4.6-1m",
      max_tokens: 8192,
      stream: true,
      system: systemPrompt,
      messages: allMessages,
      ...(mode === "deep" ? { thinking: { type: "enabled", budget_tokens: 10000 } } : {}),
    }),
  });

  if (!response.ok) {
    const rawText = await response.text().catch(() => "");
    let errorMsg = "Por favor intente de nuevo.";
    try {
      const errorData = JSON.parse(rawText);
      errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
    } catch {}
    return { error: errorMsg, code: response.status };
  }

  return { reader: response.body!.getReader(), ok: true };
}

async function streamAndAccumulate(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  return new Promise((resolve) => {
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          resolve(fullText);
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines[lines.length - 1] ?? "";
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                fullText += json.delta.text;
              }
            } catch {}
          }
        }
        pump();
      }).catch(() => resolve(fullText));
    }
    pump();
  });
}

async function streamToClient(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  return new Promise((resolve) => {
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          try { controller.close(); } catch {}
          resolve();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines[lines.length - 1] ?? "";
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const json = JSON.parse(data);
              if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                const chunk = `data: ${JSON.stringify({ type: "chunk", text: json.delta.text })}\n\n`;
                try { controller.enqueue(new TextEncoder().encode(chunk)); } catch {}
              }
            } catch {}
          }
        }
        pump();
      }).catch((err) => {
        try { controller.error(err); } catch {}
        resolve();
      });
    }
    pump();
  });
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Error 401.", code: 401 }, { status: 401 });
    }

    const profile = await validateUser(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Error 404.", code: 404 }, { status: 404 });
    }

    const now = new Date();
    const validation = validateProfile(profile, now);
    if (validation) {
      return NextResponse.json(
        { error: validation.error, code: validation.code, remaining: validation.remaining },
        { status: validation.code }
      );
    }

    const { message, conversation_id, attachments, mode, resume_message_id, message_id } = await request.json();

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";

    // Load conversation history
    const historyMessages: { role: string; content: any[] }[] = [];
    if (conversation_id) {
      const { data: prevMessages } = await supabase
        .from("messages")
        .select("id, role, content, attachments")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true })
        .limit(30);

      if (prevMessages && prevMessages.length > 0) {
        for (const m of prevMessages) {
          if (resume_message_id && m.id === resume_message_id) continue;
          const contentParts: any[] = [];
          if (typeof m.content === "string" && m.content.trim()) {
            contentParts.push({ type: "text", text: m.content });
          }
          if (m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
            contentParts.push(...m.attachments.map((a: any) =>
              typeof a === "string" ? { type: "text", text: `[adjunto: ${a}]` } : a
            ));
          }
          if (contentParts.length > 0) {
            historyMessages.push({ role: m.role, content: contentParts });
          }
        }
      }
    }

    // For resume flow: clear the old in-progress message
    let msgId = resume_message_id;
    if (resume_message_id) {
      await supabase.from("messages").update({ in_progress: false }).eq("id", resume_message_id);
    }

    // Check knowledge rules first — if match, respond directly without calling AI
    const knowledgeResponse = await knowledgeLookup(message);
    console.log("[chat] knowledgeLookup result:", knowledgeResponse ? `MATCH: "${knowledgeResponse.slice(0, 60)}..."` : "null");
    if (knowledgeResponse) {
      // Determine conversation ID
      let convId = conversation_id;
      if (!convId) {
        const { data: newConv } = await supabase.from("conversations").insert({ user_id: user.id, title: message?.trim().slice(0, 40) }).select("id").single();
        if (newConv) convId = newConv.id;
      }

      // Save user message
      let saveId = msgId || message_id;
      if (!resume_message_id) {
        const { data: savedMsg } = await supabase.from("messages").insert({
          conversation_id: convId || undefined,
          user_id: user.id,
          role: "user",
          content: message,
          attachments: attachments?.length ? attachments : null,
        }).select("id").single();
        if (savedMsg) saveId = savedMsg.id;
      }

      const now2 = new Date();
      const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
      const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
      const needsReset = !hourlyResetAt || now2 >= hourlyResetAt;
      await supabase.from("profiles").update({
        last_message_at: now2.toISOString(),
        hourly_msg_count: newHourlyCount,
        hourly_reset_at: needsReset ? new Date(now2.getTime() + 60 * 60 * 1000).toISOString() : hourlyResetAt!.toISOString(),
      }).eq("id", user.id);

      // Save assistant message to DB
      const { data: savedAiMsg } = await supabase.from("messages").insert({
        conversation_id: convId || undefined,
        user_id: user.id,
        role: "assistant",
        content: knowledgeResponse,
        in_progress: false,
      }).select("id").single();
      const aiMsgId = savedAiMsg?.id || saveId;

      // Stream in the format the client expects: { type: "chunk", text: "..." }
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "start", message_id: aiMsgId })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "chunk", text: knowledgeResponse })}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "message_stop" })}\n\n`));
          controller.close();
        }
      });

      // Update conversation title and timestamp
      if (convId) {
        const title = message?.trim().slice(0, 40) + (message?.trim().length > 40 ? "..." : "");
        supabase.from("conversations").update({
          title,
          updated_at: new Date().toISOString(),
        }).eq("id", convId);
      }

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const allMessagesForAI = [
      ...historyMessages,
      { role: "user", content: attachments?.length ? attachments : [{ type: "text", text: message }] },
    ];

    // Build dynamic system prompt — only fetches places if relevant
    const systemPrompt = await buildSystemPrompt(supabase, baseUrl, message);
    const result = await runChat(apiKey, baseUrl, systemPrompt, allMessagesForAI, mode);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.code });
    }

    const reader = result.reader;

    // Update hourly usage count (skip on resume to avoid double-counting)
    if (!resume_message_id) {
      const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
      const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
      const needsReset = !hourlyResetAt || now >= hourlyResetAt;
      await supabase.from("profiles").update({
        last_message_at: now.toISOString(),
        hourly_msg_count: newHourlyCount,
        hourly_reset_at: needsReset ? new Date(now.getTime() + 60 * 60 * 1000).toISOString() : hourlyResetAt!.toISOString(),
      }).eq("id", user.id);
    }

    // === ROBUST: stream to client AND accumulate, then save to DB on stream end ===
    const stream = new ReadableStream({
      async start(controller) {
        const aiReader = reader;
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        const saveId = msgId || message_id;

        async function pump() {
          try {
            let result = await aiReader.read();
            while (!result.done) {
              buffer += decoder.decode(result.value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines[lines.length - 1] ?? "";
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                      fullText += json.delta.text;
                      const chunk = `data: ${JSON.stringify({ type: "chunk", text: json.delta.text })}\n\n`;
                      try { controller.enqueue(new TextEncoder().encode(chunk)); } catch {}
                      // Progressive save (fire-and-forget) so partial text survives connection drops
                      if (saveId && conversation_id) {
                        supabase.from("messages").upsert({
                          id: saveId,
                          conversation_id,
                          content: fullText,
                          in_progress: true,
                        }, { onConflict: "id" });
                      }
                    }
                  } catch {}
                }
              }
              result = await aiReader.read();
            }
            // === Stream done: await DB save before [DONE] ===
            if (saveId && conversation_id) {
              const content = fullText.trim() || "(respuesta no disponible)";
              console.log("[chat] saving msg:", saveId, "chars:", content.length);
              const { error } = await supabase.from("messages").upsert({
                id: saveId,
                conversation_id,
                content,
                in_progress: false,
              }, { onConflict: "id" });
              if (error) console.error("[chat] upsert failed:", error);
              else console.log("[chat] upsert ok:", saveId);
              const title = message?.trim().slice(0, 40) + (message?.trim().length > 40 ? "..." : "");
              supabase.from("conversations").update({
                title: message ? title : undefined,
                updated_at: new Date().toISOString(),
              }).eq("id", conversation_id);
            }
            try {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              controller.close();
            } catch {}
          } catch (err) {
            if (saveId && conversation_id) {
              await supabase.from("messages").upsert({
                id: saveId,
                conversation_id,
                content: fullText.trim() || "(error en respuesta)",
                in_progress: false,
              }, { onConflict: "id" });
            }
            try { controller.error(err as Error); } catch {}
          }
        }

        // Send message ID back to client first
        if (saveId) {
          try { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type: "msg_id", id: saveId })}\n\n`)); } catch {}
        }
        pump();
      },
    });

    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    };
    if (msgId) headers["X-Message-Id"] = msgId;

    return new Response(stream, { headers });

  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("fetch")) {
      return NextResponse.json({ error: "El servidor tardo demasiado en responder.", code: 504 }, { status: 504 });
    }
    return NextResponse.json({ error: "Error 500.", code: 500 }, { status: 500 });
  }
}
