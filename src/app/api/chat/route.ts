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
      .select("status, weekly_used, weekly_msg_limit")
      .eq("id", user.id)
      .single();

    if (!profile || profile.status !== "active") {
      return NextResponse.json({ error: "Cuenta no activa" }, { status: 403 });
    }

    const { message, conversation_id } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
    }

    // Check weekly limit
    if (profile.weekly_used >= profile.weekly_msg_limit) {
      return NextResponse.json({
        error: "Has alcanzado tu límite semanal. Espera hasta el próximo lunes o contacta al administrador."
      }, { status: 429 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || "";
    const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";

    const headers = new Headers();
    headers.set("Authorization", `Bearer ${apiKey}`);
    headers.set("Content-Type", "application/json");
    headers.set("anthropic-version", "2023-06-01");
    headers.set("x-api-key", apiKey);

    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: "claude-opus-4.6-1m",
        max_tokens: 2048,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData?.error?.message || `API Error: ${response.status}`;
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }

    const data = await response.json();
    const aiMessage = data.content?.[0]?.text || "Sin respuesta del modelo.";

    // Increment weekly counter
    await supabase
      .from("profiles")
      .update({ weekly_used: profile.weekly_used + 1 })
      .eq("id", user.id);

    return NextResponse.json({ message: aiMessage });

  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}