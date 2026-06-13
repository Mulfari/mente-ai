import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";

// Compartir conversaciones por enlace público (modelo "foto fija").
//   GET    ?conversationId=  → estado del enlace ({ token } | { token: null })
//   POST   { conversationId } → crea/actualiza la foto y devuelve { token }
//   DELETE ?conversationId=  → desactiva (borra) el enlace
//
// Token corto aleatorio (base62, no adivinable). Una conversación tiene a lo
// sumo un enlace activo (unique conversation_id en la tabla).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; // sin 0/O/1/I/l
function newToken(len = 9): string {
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function ownerProfileId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await getProfileByClerkId(userId);
  return profile?.id ?? null;
}

// Verifica que la conversación pertenece al usuario.
async function ownsConversation(
  supabase: ReturnType<typeof createClient>,
  conversationId: string,
  ownerId: string
): Promise<{ title: string } | null> {
  const { data } = await supabase
    .from("conversations")
    .select("title, user_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!data || data.user_id !== ownerId) return null;
  return { title: (data.title as string) || "Conversación" };
}

export async function GET(req: NextRequest) {
  const ownerId = await ownerProfileId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });

  const supabase = createClient();
  const { data } = await supabase
    .from("shared_conversations")
    .select("token, expires_at")
    .eq("conversation_id", conversationId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  // Un enlace vencido (>24h) se trata como inexistente.
  const live = data && new Date(data.expires_at as string).getTime() > Date.now();
  return NextResponse.json({
    token: live ? (data!.token as string) : null,
    expiresAt: live ? (data!.expires_at as string) : null,
  });
}

const SHARE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function POST(req: NextRequest) {
  const ownerId = await ownerProfileId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { conversationId?: string } | null;
  const conversationId = body?.conversationId;
  if (!conversationId) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });

  const supabase = createClient();
  const owned = await ownsConversation(supabase, conversationId, ownerId);
  if (!owned) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });

  // Snapshot de los mensajes publicables (sin los que quedaron en progreso).
  const { data: msgs } = await supabase
    .from("messages")
    .select("role, content, created_at, in_progress")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  const snapshot = (msgs ?? [])
    .filter((m) => !m.in_progress && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role as string, content: m.content as string }));

  if (snapshot.length === 0) {
    return NextResponse.json({ error: "La conversación está vacía" }, { status: 400 });
  }

  // ¿Ya hay enlace vivo? Conservar token Y su caducidad (reabrir refresca el
  // contenido pero NO reinicia el reloj de 24h). Si no hay o ya venció, se
  // acuña un token nuevo con 24h frescas (el URL viejo, ya vencido, muere).
  const { data: existing } = await supabase
    .from("shared_conversations")
    .select("token, expires_at")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  const live = existing && new Date(existing.expires_at as string).getTime() > Date.now();
  const token = live ? (existing!.token as string) : newToken();
  const expiresAt = live
    ? (existing!.expires_at as string)
    : new Date(Date.now() + SHARE_TTL_MS).toISOString();

  const { error } = await supabase.from("shared_conversations").upsert(
    {
      token,
      conversation_id: conversationId,
      owner_id: ownerId,
      title: owned.title,
      messages: snapshot,
      updated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: "conversation_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ token, expiresAt });
}

export async function DELETE(req: NextRequest) {
  const ownerId = await ownerProfileId();
  if (!ownerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const conversationId = req.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "Falta conversationId" }, { status: 400 });

  const supabase = createClient();
  await supabase
    .from("shared_conversations")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("owner_id", ownerId);
  return NextResponse.json({ success: true });
}
