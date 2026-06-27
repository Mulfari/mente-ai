import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";

// "Continuar" un enlace compartido = BIFURCAR: copia la foto de la conversación
// a la cuenta de quien la abre. La original queda intacta; cada quien tiene su
// propia rama (así nunca hay que regenerar enlaces). Solo logueado — el visitante
// sin cuenta bifurca a su historial anónimo en el cliente (localStorage).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const profile = await getProfileByClerkId(userId);
  if (!profile) return NextResponse.json({ error: "Sin perfil" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { token?: string } | null;
  const token = body?.token;
  if (!token) return NextResponse.json({ error: "Falta token" }, { status: 400 });

  const supabase = createClient();
  const { data: share } = await supabase
    .from("shared_conversations")
    .select("title, messages")
    .eq("token", token)
    .maybeSingle();
  if (!share) return NextResponse.json({ error: "Enlace no encontrado" }, { status: 404 });

  const now = new Date().toISOString();
  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({ user_id: profile.id, title: (share.title as string) || "Conversación", created_at: now, updated_at: now })
    .select()
    .single();
  if (convErr || !conv) return NextResponse.json({ error: convErr?.message || "No se pudo crear" }, { status: 500 });

  const rows = ((share.messages as { role: string; content: string }[]) ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ conversation_id: conv.id, role: m.role, content: m.content }));
  if (rows.length) {
    const { error: msgErr } = await supabase.from("messages").insert(rows);
    if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 });
  }

  return NextResponse.json({ conversationId: conv.id });
}
