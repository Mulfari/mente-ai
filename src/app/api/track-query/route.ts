import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";

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

  const { userId } = await auth();
  const supabase = await createClient();

  // query_events.user_id and user_context.user_id store the internal
  // profile UUID — resolve it from the Clerk id first.
  let internalUserId: string | null = null;
  let city: string | null = null;
  if (userId) {
    const profile = await getProfileByClerkId(userId);
    internalUserId = profile?.id ?? null;
    if (internalUserId) {
      const { data: ctx } = await supabase
        .from("user_context")
        .select("city")
        .eq("user_id", internalUserId)
        .maybeSingle();
      city = ((ctx?.city ?? "").trim()) || null;
    }
  }

  const { error } = await supabase.from("query_events").insert({
    user_id: internalUserId,
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
