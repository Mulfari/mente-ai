import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("status, subscription_weeks, subscription_start, weekly_limit, messages_used, weekly_reset_at")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    }

    if (profile.status === "inactive") {
      return NextResponse.json({ error: "Cuenta inactiva. Solicita un código de cupón para activar tu cuenta." }, { status: 403 });
    }

    if (profile.status !== "active") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
    }

    const messagesUsed = profile.messages_used ?? 0;
    const weeklyLimit = profile.weekly_limit ?? 100;
    if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) {
      return NextResponse.json({ error: "Has alcanzado tu límite semanal de mensajes." }, { status: 429 });
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

    // Build content array — puede ser texto solo o texto + imágenes
    const requestContent = attachments && attachments.length > 0
      ? attachments
      : [{ type: "text", text: message }];

    const response = await fetch(`${baseUrl}/v1/messages`, {
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
      const errorMsg = errorData?.error?.message || errorData?.message || `API Error: ${response.status}`;
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();

    // El contenido es un array, buscar el bloque de texto (ignorar thinking)
    const responseContent = data.content || [];
    const textBlock = responseContent.find((c: any) => c.type === "text");
    const aiMessage = textBlock?.text || "Sin respuesta del modelo.";

    // Incrementar contador de mensajes usados
    await supabase
      .from("profiles")
      .update({ messages_used: profile.messages_used + 1 })
      .eq("id", user.id);

    return NextResponse.json({ message: aiMessage });

  } catch {
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}