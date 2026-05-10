import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 2000;
const TIMEOUT_MS = 60_000; // 60 segundos
const HOURLY_LIMIT = 20;
const COOLDOWN_MINUTES = 5;

async function fetchWithRetry(url: string, options: RequestInit): Promise<Response> {
  // Simple: una vez con timeout, si falla por timeout (AbortError) reintentar 1 vez
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isAbort = err.name === "AbortError" || err.message?.includes("fetch") || !err.name;
      if (isAbort && attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Error 401. Por favor intente nuevamente.", code: 401 }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status, subscription_weeks, subscription_start, weekly_limit, messages_used, weekly_reset_at, last_message_at, hourly_msg_count, hourly_reset_at, status")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Error 404. Por favor intente nuevamente.", code: 404 }, { status: 404 });
    }

    if (profile.status !== "active") {
      return NextResponse.json({ error: "Error 403. Por favor intente nuevamente.", code: 403 }, { status: 403 });
    }

    // Reset semanal
    const now = new Date();
    const resetAt = profile.weekly_reset_at ? new Date(profile.weekly_reset_at) : null;

    if (resetAt && now >= resetAt) {
      const weeks = profile.subscription_weeks ?? 0;
      if (weeks <= 0) {
        return NextResponse.json({ error: "Error 403. Por favor intente nuevamente.", code: 403 }, { status: 403 });
      }

      const newResetAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await supabase.from("profiles").update({
        messages_used: 0,
        weekly_reset_at: newResetAt.toISOString(),
        subscription_weeks: weeks - 1,
      }).eq("id", user.id);

      if (weeks - 1 <= 0) {
        await supabase.from("profiles").update({ status: "inactive" }).eq("id", user.id);
        return NextResponse.json({ error: "Error 403. Por favor intente nuevamente.", code: 403 }, { status: 403 });
      }

      const { data: updatedProfile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      profile.messages_used = updatedProfile?.messages_used ?? 0;
    }

    // Cooldown condicional: si >20 msgs/hora, 5min de espera
    const hourlyResetAt = profile.hourly_reset_at ? new Date(profile.hourly_reset_at) : null;
    if (hourlyResetAt && now >= hourlyResetAt) {
      await supabase.from("profiles").update({
        hourly_msg_count: 0,
        hourly_reset_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      }).eq("id", user.id);
      profile.hourly_msg_count = 0;
    }
    if (profile.hourly_msg_count >= HOURLY_LIMIT) {
      const remainingSecs = hourlyResetAt ? Math.ceil((hourlyResetAt.getTime() - now.getTime()) / 1000) : COOLDOWN_MINUTES * 60;
      const remainingMins = Math.ceil(remainingSecs / 60);
      return NextResponse.json(
        { error: `Demasiados mensajes. Espera ${remainingMins}min para continuar.`, code: 429, remaining: remainingSecs },
        { status: 429 }
      );
    }

    // Límite semanal
    const messagesUsed = profile.messages_used ?? 0;
    const weeklyLimit = profile.weekly_limit ?? 100;
    if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) {
      return NextResponse.json({ error: "Error 429. Por favor intente nuevamente.", code: 429 }, { status: 429 });
    }

    const { message, conversation_id, attachments } = await request.json();

    if (!message?.trim() && (!attachments || attachments.length === 0)) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    // Cargar historial de mensajes de la conversación para contexto
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

    const requestContent = attachments && attachments.length > 0
      ? attachments
      : [{ type: "text", text: message }];

    // Construir array de mensajes para el modelo (historial + mensaje actual)
    const allMessages = [
      ...historyMessages,
      { role: "user", content: requestContent },
    ];

    const response = await fetchWithRetry(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-opus-4.6-1m",
        max_tokens: 4096,
        messages: allMessages,
      }),
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => "");
      let errorMsg = "El servicio esta temporalmente saturado. Intenta en unos segundos.";
      try {
        const errorData = JSON.parse(rawText);
        errorMsg = errorData?.error?.message || errorData?.message || errorMsg;
      } catch { /* keep generic */ }
      const errorCode = response.status;
      return NextResponse.json({ error: errorMsg, code: errorCode }, { status: response.status });
    }

    // Buffer complete response
    const raw = await response.text();
    if (!raw.trim()) {
      return NextResponse.json({ error: "El servidor devolvio una respuesta vacia. Intenta de nuevo.", code: 500 }, { status: 500 });
    }
    let assistantText = "";
    try {
      const parsed = JSON.parse(raw);
      const textBlock = parsed.content?.find((c: any) => c.type === "text");
      assistantText = textBlock?.text || "";
    } catch {
      assistantText = raw;
    }

    // Update usage counts
    const newHourlyCount = (profile.hourly_msg_count ?? 0) + 1;
    const needsHourlyReset = !hourlyResetAt || now >= hourlyResetAt;
    const newHourlyReset = needsHourlyReset
      ? new Date(now.getTime() + 60 * 60 * 1000).toISOString()
      : hourlyResetAt.toISOString();
    await supabase
      .from("profiles")
      .update({
        messages_used: (profile.messages_used ?? 0) + 1,
        last_message_at: now.toISOString(),
        hourly_msg_count: newHourlyCount,
        hourly_reset_at: newHourlyReset,
      })
      .eq("id", user.id);

    return NextResponse.json({ message: assistantText });

  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("fetch")) {
      return NextResponse.json({ error: "El servidor tardo demasiado en responder. Intenta de nuevo.", code: 504 }, { status: 504 });
    }
    return NextResponse.json({ error: "Error 500. Por favor intente nuevamente.", code: 500 }, { status: 500 });
  }
}