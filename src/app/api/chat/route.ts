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

const SYSTEM_PROMPT = {
  role: "system",
  content: `Eres Mulfai, un asistente de IA útil y conversacional. Respondes en español.
Tu identidad principal es ser útil, no dar información técnica sobre modelos o arquitectura.

SIEMPRE:
- Ser directo y útil.
- Responder en español.`,
};

async function runChat(
  apiKey: string,
  baseUrl: string,
  model: string,
  allMessages: any[],
  mode: string,
): Promise<{ response: Response; isJson: boolean; errorMsg?: string; statusCode?: number }> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("Content-Type", "application/json");
  headers.set("anthropic-version", "2023-06-01");
  headers.set("x-api-key", apiKey);

  const response = await fetchWithRetry(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      stream: false,
      system: SYSTEM_PROMPT,
      messages: allMessages,
      ...(mode === "deep" ? { thinking: { type: "enabled", budget_tokens: 1024 } } : {}),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let errorMsg = "Por favor intente de nuevo.";
    try { errorMsg = JSON.parse(text)?.error?.message || errorMsg; } catch {}
    return { response, isJson: true, errorMsg, statusCode: response.status };
  }

  return { response, isJson: false };
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
    const model = process.env.ANTHROPIC_MODEL || "[private model]";

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

    if (resume_message_id) {
      await supabase.from("messages").update({ in_progress: false }).eq("id", resume_message_id);
    }

    const convId = conversation_id;

    const allMessagesForAI = [
      ...historyMessages,
      ...(message?.trim() ? [{ role: "user", content: [{ type: "text", text: message }] }] : []),
    ];

    const result = await runChat(apiKey, baseUrl, model, allMessagesForAI, mode || "normal");

    if (result.isJson) {
      return NextResponse.json({ error: result.errorMsg || "Error" }, { status: result.statusCode || 500 });
    }

    const assistantMsgId = message_id || crypto.randomUUID();
    let fullResponse = "";
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ type: "start", message_id: assistantMsgId });

          const raw = await result.response.text();

          try {
            const data = JSON.parse(raw);
            if (data.error) {
              sendEvent({ type: "error", error: data.error.message || data.error });
              controller.close();
              return;
            }
            if (data.content && Array.isArray(data.content)) {
              for (const block of data.content) {
                if (block.type === "text") {
                  fullResponse += block.text;
                }
              }
            }
            if (fullResponse) {
              await supabase.from("messages").upsert({
                id: assistantMsgId,
                conversation_id: convId,
                role: "assistant",
                content: fullResponse,
              }, { onConflict: "id" });
              sendEvent({ type: "chunk", id: assistantMsgId, text: fullResponse, is_deep: mode === "deep" });
            }
          } catch {
            const lines = raw.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const json = JSON.parse(line.slice(6));
                  if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
                    fullResponse += json.delta.text;
                    await supabase.from("messages").upsert({
                      id: assistantMsgId,
                      conversation_id: convId,
                      role: "assistant",
                      content: fullResponse,
                    }, { onConflict: "id" });
                    sendEvent({ type: "chunk", id: assistantMsgId, text: json.delta.text, is_deep: mode === "deep" });
                  }
                } catch {}
              }
            }
          }

          sendEvent({ type: "done" });
          controller.close();
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