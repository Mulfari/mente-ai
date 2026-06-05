import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/track-query — record a query event (chip click or typed prompt).
// Anonymous events (no session) are allowed and inserted with user_id: null.
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

  const { error } = await supabase.from("query_events").insert({
    user_id: user?.id ?? null,
    category_id: body.categoryId ?? null,
    sub_option_id: body.subOptionId ?? null,
    source: body.source,
    prompt: body.prompt,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
