import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;
const TIMEOUT_MS = 300_000;
const HOURLY_LIMIT = 20;
const COOLDOWN_MINUTES = 5;
const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";

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
    const assistantMsgId = message_id || crypto.randomUUID();

    // Fetch user personal context from Supabase
    const { data: userContext } = await supabase
      .from("user_context")
      .select("full_name, city, interests, custom_notes")
      .eq("user_id", user.id)
      .maybeSingle();

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ type: "start", message_id: assistantMsgId });

          // Build conversation history for VPS
          const historyText = historyMessages.length > 0
            ? historyMessages.map(m => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content.map((p: any) => p.text || "").join(" ")}`).join("\n")
            : "";

          // Call VPS orchestrator with full context
          const vpsResponse = await fetch(`${VPS_URL}/api/orchestrate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: message,
              user_id: user.id,
              conversation_id: convId,
              mode: mode || "normal",
              attachments: attachments || [],
              user_context: userContext ? {
                name: userContext.full_name || "",
                city: userContext.city || "",
                interests: userContext.interests || "",
                notes: userContext.custom_notes || "",
              } : null,
              conversation_history: historyText || undefined,
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });

          if (!vpsResponse.ok) {
            const errText = await vpsResponse.text();
            sendEvent({ type: "error", error: "Error del servidor. Intenta de nuevo." });
            controller.close();
            return;
          }

          const result = await vpsResponse.json();
          const fullResponse = result.response || "";

          if (fullResponse) {
            await supabase.from("messages").upsert({
              id: assistantMsgId,
              conversation_id: convId,
              role: "assistant",
              content: fullResponse,
              mode: mode || "normal",
            }, { onConflict: "id" });
            sendEvent({ type: "chunk", id: assistantMsgId, text: fullResponse, is_deep: mode === "deep" });
          }

          sendEvent({ type: "done" });
          controller.close();
        } catch (err: any) {
          sendEvent({ type: "error", error: err.message || "Error de conexion." });
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