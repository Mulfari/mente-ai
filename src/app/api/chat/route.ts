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
        const delay = RETRY_DELAY_MS * (attempt + 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (attempt < MAX_RETRIES) {
        const delay = RETRY_DELAY_MS * (attempt + 1);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

function buildStreamReader(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  controller: ReadableStreamDefaultController<Uint8Array>,
  onChunk: (text: string) => void,
  onDone: () => void,
) {
  const decoder = new TextDecoder();
  let buffer = "";

  function run() {
    reader.read().then(({ done, value }) => {
      if (done) {
        try { controller.close(); } catch {}
        onDone();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines[lines.length - 1] ?? "";
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i];
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            try { controller.close(); } catch {}
            onDone();
            return;
          }
          try {
            const json = JSON.parse(data);
            // Skip thinking blocks — only forward text_delta to client
            if (json.type === "content_block_delta") {
              if (json.delta?.type === "text_delta") {
                const text = json.delta.text;
                const chunk = `data: ${JSON.stringify({ type: "chunk", text })}\n\n`;
                try { controller.enqueue(new TextEncoder().encode(chunk)); } catch {}
                onChunk(text);
              }
              // Skip thinking_delta — don't forward internal reasoning
            }
          } catch {}
        }
      }
      run();
    }).catch((err) => {
      try { controller.error(err); } catch {}
      onDone();
    });
  }
  run();
}

function streamAIResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void,
  onDone: () => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      buildStreamReader(reader, controller, onChunk, onDone);
    },
  });
}

function validateUser(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  return supabase
    .from("profiles")
    .select("status, subscription_weeks, subscription_start, weekly_limit, messages_used, weekly_reset_at, last_message_at, hourly_msg_count, hourly_reset_at, status")
    .eq("id", userId)
    .single()
    .then(({ data: profile }) => profile);
}

function buildMessages(histMsg: { role: string; content: any[] }[], message: string, attachments?: any[]) {
  const requestContent = attachments?.length
    ? attachments
    : [{ type: "text", text: message }];
  return [
    ...histMsg,
    { role: "user", content: requestContent },
  ];
}

function validateProfile(profile: any, now: Date) {
  if (profile.status !== "active") {
    return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
  }

  const resetAt = profile.weekly_reset_at ? new Date(profile.weekly_reset_at) : null;
  if (resetAt && now >= resetAt) {
    const weeks = profile.subscription_weeks ?? 0;
    if (weeks <= 0) {
      return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
    }
  }

  const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
  if (hourlyResetAt && now >= hourlyResetAt) {
    profile.hourly_msg_count = 0;
  }
  if (profile.hourly_msg_count >= HOURLY_LIMIT) {
    const remainingSecs = hourlyResetAt
      ? Math.ceil((hourlyResetAt.getTime() - now.getTime()) / 1000)
      : COOLDOWN_MINUTES * 60;
    const remainingMins = Math.ceil(remainingSecs / 60);
    return {
      error: `Demasiados mensajes. Espera ${remainingMins}min para continuar.`,
      code: 429,
      remaining: remainingSecs,
    };
  }

  const messagesUsed = profile.messages_used ?? 0;
  const weeklyLimit = profile.weekly_limit ?? 100;
  if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) {
    return { error: "Error 429. Por favor intente nuevamente.", code: 429 };
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Error 401. Por favor intente nuevamente.", code: 401 }, { status: 401 });
    }

    const profile = await validateUser(supabase, user.id);
    if (!profile) {
      return NextResponse.json({ error: "Error 404. Por favor intente nuevamente.", code: 404 }, { status: 404 });
    }

    const now = new Date();
    const validation = validateProfile(profile, now);
    if (validation) {
      return NextResponse.json({ error: validation.error, code: validation.code, remaining: validation.remaining }, { status: validation.code });
    }

    const { message, conversation_id, attachments, mode } = await request.json();

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    // Load history
    const historyMessages: { role: string; content: any[] }[] = [];
    if (conversation_id) {
      const { data: prevMessages } = await supabase
        .from("messages")
        .select("role, content, attachments")
        .eq("conversation_id", conversation_id)
        .order("created_at", { ascending: true })
        .limit(30);

      if (prevMessages && prevMessages.length > 0) {
        for (const m of prevMessages) {
          const contentParts: any[] = [];
          if (typeof m.content === "string" && m.content.trim()) {
            contentParts.push({ type: "text", text: m.content });
          }
          if (m.attachments && Array.isArray(m.attachments) && m.attachments.length > 0) {
            contentParts.push(...m.attachments.map((a: any) => (typeof a === "string" ? { type: "text", text: `[adjunto: ${a}]` } : a)));
          }
          if (contentParts.length > 0) {
            historyMessages.push({ role: m.role, content: contentParts });
          }
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${apiKey}`);
    headers.set("Content-Type", "application/json");
    headers.set("anthropic-version", "2023-06-01");
    headers.set("x-api-key", apiKey);

    const allMessages = buildMessages(historyMessages, message, attachments);

    let assistantText = "";
    let streamError: string | null = null;

    const response = await fetchWithRetry(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-opus-4.6-1m",
        max_tokens: 4096,
        stream: true,
        messages: allMessages,
        ...(mode === "deep" ? {
          thinking: {
            type: "enabled",
            budget_tokens: 10000,
          },
        } : {}),
      }),
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      let errorMsg = "Por favor intente de nuevo.";
      try {
        const errorData = JSON.parse(rawText);
        errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
      } catch { /* keep generic */ }
      return NextResponse.json({ error: errorMsg, code: response.status }, { status: response.status });
    }

    const reader = response.body!.getReader();
    const stream = streamAIResponse(reader, (text) => { assistantText += text; }, () => {});

    // Update usage counts
    const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
    const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
    const needsHourlyReset = !hourlyResetAt || now >= hourlyResetAt;
    const newHourlyReset = needsHourlyReset
      ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      : hourlyResetAt!.toISOString();
    await supabase
      .from("profiles")
      .update({
        messages_used: (profile.messages_used ?? 0) + 1,
        last_message_at: now.toISOString(),
        hourly_msg_count: newHourlyCount,
        hourly_reset_at: newHourlyReset,
      })
      .eq("id", user.id);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("fetch")) {
      return NextResponse.json({ error: "El servidor tardo demasiado en responder. Intenta de nuevo.", code: 504 }, { status: 504 });
    }
    return NextResponse.json({ error: "Error 500. Por favor intente nuevamente.", code: 500 }, { status: 500 });
  }
}