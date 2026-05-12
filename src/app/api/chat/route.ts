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
    .select("status, subscription_weeks, subscription_start, weekly_limit, messages_used, weekly_reset_at, last_message_at, hourly_msg_count, hourly_reset_at, status")
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
  const messagesUsed = profile.messages_used ?? 0;
  const weeklyLimit = profile.weekly_limit ?? 100;
  if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) {
    return { error: "Error 429. Por favor intente nuevamente.", code: 429 };
  }
  return null;
}

async function runChat(
  apiKey: string,
  baseUrl: string,
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
      max_tokens: 4096,
      stream: true,
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

    const allMessagesForAI = [
      ...historyMessages,
      { role: "user", content: attachments?.length ? attachments : [{ type: "text", text: message }] },
    ];

    // Run the AI request
    const result = await runChat(apiKey, baseUrl, allMessagesForAI, mode);
    if ("error" in result) {
      return NextResponse.json({ error: result.error, code: result.code }, { status: result.code });
    }

    const reader = result.reader;

    // Update usage counts (skip on resume to avoid double-counting)
    if (!resume_message_id) {
      const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
      const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
      const needsReset = !hourlyResetAt || now >= hourlyResetAt;
      await supabase.from("profiles").update({
        messages_used: (profile.messages_used ?? 0) + 1,
        last_message_at: now.toISOString(),
        hourly_msg_count: newHourlyCount,
        hourly_reset_at: needsReset ? new Date(now.getTime() + 60 * 60 * 1000).toISOString() : hourlyResetAt!.toISOString(),
      }).eq("id", user.id);
    }

    // === ROBUST: stream to client AND accumulate, then save to DB on stream end ===
    const stream = new ReadableStream({
      async start(controller) {
        // Capture reader reference and abort signal inside the stream context
        const aiReader = reader;
        const abortSig = request.signal;
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let saved = false;
        const saveId = msgId || message_id;

        const saveToDb = () => {
          if (saved || !saveId || !conversation_id) return;
          saved = true;
          // Fire-and-forget with dynamic waitUntil if available
          const doSave = async () => {
            try {
              const { error } = await supabase.from("messages").upsert({
                id: saveId,
                conversation_id,
                content: fullText || "(respuesta no disponible)",
                in_progress: false,
              });
              if (error) console.error("[chat] upsert failed:", error);
            } catch (e) { console.error("[chat] save error:", e); }
          };
          // Use waitUntil so the save runs even after stream closes (Vercel Functions)
          const ctx = request as any;
          if (ctx.waitUntil) {
            ctx.waitUntil(doSave());
          } else {
            doSave();
          }
        };

        function pump() {
          aiReader.read().then(({ done, value }) => {
            if (done || abortSig?.aborted) {
              saveToDb();
              try { controller.close(); } catch {}
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
                    const chunk = `data: ${JSON.stringify({ type: "chunk", text: json.delta.text })}\n\n`;
                    try { controller.enqueue(new TextEncoder().encode(chunk)); } catch {}
                  }
                } catch {}
              }
            }
            pump();
          }).catch((err) => {
            saveToDb();
            try { controller.error(err); } catch {}
          });
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
