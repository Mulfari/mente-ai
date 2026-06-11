import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";

// POST /api/user-context/save — save or upsert user context
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  // user_context.user_id stores the internal profile UUID, not the Clerk id
  const profile = await getProfileByClerkId(userId);
  if (!profile) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

  const { full_name, city, custom_notes, interests } = await req.json();

  if (typeof full_name !== "string" && typeof city !== "string" &&
      typeof custom_notes !== "string" && typeof interests !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const trimmed = {
    full_name: (full_name ?? "").trim(),
    city:      (city          ?? "").trim(),
    custom_notes: (custom_notes ?? "").trim(),
    interests: (interests ?? "").trim(),
  };

  const { data: existing } = await supabase
    .from("user_context")
    .select("id")
    .eq("user_id", profile.id)
    .maybeSingle();

  let err: string | null = null;

  if (existing) {
    const { error: e } = await supabase
      .from("user_context")
      .update({ ...trimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (e) err = e.message;
  } else {
    const { error: e } = await supabase
      .from("user_context")
      .insert({ user_id: profile.id, ...trimmed });
    if (e) err = e.message;
  }

  if (err) return NextResponse.json({ error: err }, { status: 500 });
  return NextResponse.json({ success: true });
}