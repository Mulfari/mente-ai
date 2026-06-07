import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/track-query — record a query event (chip click or typed prompt).
// Anonymous events (no session) are allowed and inserted with user_id: null.
// If the user is logged in we also stamp the row with their city so the
// trending "Cerca de ti" section can filter by it later.
type Body = {
  categoryId?: string | null;
  subOptionId?: string | null;
  source: "discover" | "typed" | "research";
  prompt: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.prompt || !body.source) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let city: string | null = null;
  if (user) {
    const { data: ctx } = await supabase
      .from("user_context")
      .select("city")
      .eq("user_id", user.id)
      .maybeSingle();
    city = ((ctx?.city ?? "").trim()) || null;
  }

  const { error } = await supabase.from("query_events").insert({
    user_id: user?.id ?? null,
    category_id: body.categoryId ?? null,
    sub_option_id: body.subOptionId ?? null,
    source: body.source,
    prompt: body.prompt,
    city,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
