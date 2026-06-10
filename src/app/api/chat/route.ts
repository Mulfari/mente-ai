import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as jose from "jose";

const VPS_SECRET = process.env.VPS_SECRET || process.env.VPS_SHARED_SECRET || "";
const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://localhost:3000";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 300_000;
const HOURLY_LIMIT = 20;
const COOLDOWN_MINUTES = 5;

function validateProfile(profile: any, now: Date) {
  if (profile.status !== "active") {
    return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
  }
  const resetAt = profile.weekly_reset_at ? new Date(profile.weekly_reset_at) : null;
  if (resetAt && now >= resetAt) {
    const weeks = profile.subscription_weeks ?? 0;
    if (weeks <= 0) return { error: "Error 403. Por favor intente nuevamente.", code: 403 };
  }
  // Paid users (any nonzero subscription_weeks, including -1) skip hourly throttle.
  const isPaid = (profile.subscription_weeks ?? 0) !== 0;
  if (!isPaid) {
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
  }
  return null;
}

function historyToText(messages: { role: string; content: any[] }[]): string {
  return messages
    .map(m => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content.map((p: any) => p.text || "").join(" ")}`)
    .join("\n");
}

// Generate VPS JWT token server-side using service role key (bypasses browser token)
async function generateVpsToken(userId: string): Promise<string> {
  if (!VPS_SECRET) throw new Error("VPS_SECRET no configurado");
  const secret = new TextEncoder().encode(VPS_SECRET);
  return await new jose.SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Error 401.", code: 401 }, { status: 401 });
    const supabase = await createClient();

    // Validate profile (clerk_user_id is the link)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, status, subscription_weeks, subscription_start, hourly_msg_count, hourly_reset_at, weekly_reset_at")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) return NextResponse.json({ error: "Error 404.", code: 404 }, { status: 404 });
    const internalUserId = profile.id;

    const now = new Date();
    const validation = validateProfile(profile, now);
    if (validation) return NextResponse.json({ error: validation.error, code: validation.code, remaining: validation.remaining }, { status: validation.code });

    const { message, conversation_id, mode, resume_message_id, message_id } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    // Load conversation history
    const historyMessages: { role: string; content: any[] }[] = [];
    let conversationSummary: string | null = null;

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

      const { data: conv } = await supabase
        .from("conversations").select("summary")
        .eq("id", conversation_id).single();
      if (conv?.summary) conversationSummary = conv.summary;
    }

    if (resume_message_id) {
      await supabase.from("messages").update({ in_progress: false }).eq("id", resume_message_id);
    }

    // Get user context
    const { data: userContext } = await supabase
      .from("user_context")
      .select("full_name, city, interests, custom_notes")
      .eq("user_id", internalUserId)
      .maybeSingle();

    const historyText = historyMessages.length > 0 ? historyToText(historyMessages) : "";
    const fullHistoryText = conversationSummary && historyText
      ? `[Resumen de conversacion anterior]\n${conversationSummary}\n\n[Mensajes recientes]\n${historyText}`
      : conversationSummary ? `[Resumen de conversacion anterior]\n${conversationSummary}` : historyText;

    // Generate VPS token server-side (no browser involvement)
    let vpsToken: string;
    try {
      vpsToken = await generateVpsToken(internalUserId);
    } catch {
      return NextResponse.json({ error: "Error de autenticación con el servidor." }, { status: 500 });
    }

    const assistantMsgId = message_id || crypto.randomUUID();

    // Set up SSE streaming — connect directly to VPS /api/stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); } catch { /* stream closed */ }
        };

        try {
          sendEvent({ type: "start", message_id: assistantMsgId });

          // Call VPS streaming endpoint with server-generated token
          const vpsRes = await fetch(`${VPS_URL}/api/stream`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: vpsToken,
              user_id: internalUserId,
              message_id: assistantMsgId,
              conversation_id: conversation_id || null,
              mode: mode || "normal",
              question: message,
              attachments: "[]",
              user_context: JSON.stringify({
                name: userContext?.full_name || "",
                city: userContext?.city || "",
                interests: userContext?.interests || "",
                notes: userContext?.custom_notes || "",
              }),
              conversation_history: fullHistoryText || undefined,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });

          if (!vpsRes.ok) {
            const errBody = await vpsRes.json().catch(() => ({}));
            sendEvent({ type: "error", error: errBody.error || "Error del servidor. Intenta de nuevo." });
            controller.close();
            return;
          }

          if (!vpsRes.body) {
            sendEvent({ type: "error", error: "Error de conexión con el servidor." });
            controller.close();
            return;
          }

          // Pipe VPS SSE stream directly to the browser
          const reader = vpsRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentEvent = "";
          let currentData = "";
          let accumulatedText = "";

          const flushEvent = () => {
            if (!currentEvent || !currentData) return;
            let data: any;
            try { data = JSON.parse(currentData); } catch { currentEvent = ""; currentData = ""; return; }

            if (currentEvent === "chunk" && data.type === "chunk") {
              accumulatedText += data.text || "";
              sendEvent({ type: "chunk", id: assistantMsgId, text: data.text || "", is_deep: data.is_deep });
            } else if (currentEvent === "done" && data.type === "done") {
              sendEvent({ type: "done" });
            } else if (currentEvent === "error") {
              sendEvent({ type: "error", error: data.message || "Error." });
            }
            currentEvent = "";
            currentData = "";
          };

          while (true) {
            try {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines[lines.length - 1] ?? "";
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                if (line === "") { flushEvent(); continue; }
                const eventMatch = line.match(/^event: (.+)/);
                const dataMatch = line.match(/^data: (.+)/);
                if (eventMatch) { flushEvent(); currentEvent = eventMatch[1]; }
                else if (dataMatch) { currentData = dataMatch[1]; }
              }
            } catch {
              break;
            }
          }
          flushEvent();

          // Save final message to DB
          if (accumulatedText) {
            await supabase.from("messages").upsert({
              id: assistantMsgId,
              conversation_id: conversation_id,
              role: "assistant",
              content: accumulatedText,
              mode: mode || "normal",
            }, { onConflict: "id" });
          }

          sendEvent({ type: "done" });
          controller.close();

        } catch (err: any) {
          sendEvent({ type: "error", error: err.message || "Error de conexión." });
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