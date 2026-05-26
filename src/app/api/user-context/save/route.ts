import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/user-context/save — save or upsert user context
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    .eq("user_id", user.id)
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
      .insert({ user_id: user.id, ...trimmed });
    if (e) err = e.message;
  }

  if (err) return NextResponse.json({ error: err }, { status: 500 });
  return NextResponse.json({ success: true });
}