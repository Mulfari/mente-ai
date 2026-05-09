import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const RATE_LIMIT_MS = 30 * 1000; // 30 segundos entre mensajes
const MAX_RETRIES = 2;
const TIMEOUT_MS = 60_000; // 60 segundos

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Reintentar en errores de red o 5xx (excepto 429 que es rate limit del proxy)
      if (!res.ok && res.status >= 500 && res.status !== 429 && attempt < retries) {
        const delay = (attempt + 1) * 1500; // 1.5s, 3s
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (err: any) {
      clearTimeout(timeoutId);

      // Reintentar en timeout o errores de red
      if (attempt < retries && (err.name === "AbortError" || err.message?.includes("fetch") || !err.name)) {
        const delay = (attempt + 1) * 1500;
        await new Promise(r => setTimeout(r, delay));
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
      .select("status, subscription_weeks, subscription_start, weekly_limit, messages_used, weekly_reset_at, last_message_at")
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

    // Rate limit
    if (profile.last_message_at) {
      const lastAt = new Date(profile.last_message_at);
      const diffMs = now.getTime() - lastAt.getTime();
      if (diffMs < RATE_LIMIT_MS) {
        const remaining = Math.ceil((RATE_LIMIT_MS - diffMs) / 1000);
        return NextResponse.json(
          { error: `Error 429. Por favor intente nuevamente en ${remaining}s.`, code: 429 },
          { status: 429 }
        );
      }
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

    const response = await fetchWithRetry(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-opus-4.6-1m",
        max_tokens: 2048,
        messages: [{ role: "user", content: requestContent }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || errorData?.message || `Error 500. Por favor intente nuevamente.`;
      const errorCode = response.status;
      return NextResponse.json({ error: errorMsg, code: errorCode }, { status: response.status });
    }

    const data = await response.json();
    const responseContent = data.content || [];
    const textBlock = responseContent.find((c: any) => c.type === "text");
    const aiMessage = textBlock?.text || "Sin respuesta del modelo.";

    await supabase
      .from("profiles")
      .update({
        messages_used: (profile.messages_used ?? 0) + 1,
        last_message_at: now.toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ message: aiMessage });

  } catch (err: any) {
    if (err.name === "AbortError" || err.message?.includes("fetch")) {
      return NextResponse.json({ error: "Error 504. Por favor intente nuevamente.", code: 504 }, { status: 504 });
    }
    return NextResponse.json({ error: "Error 500. Por favor intente nuevamente.", code: 500 }, { status: 500 });
  }
}