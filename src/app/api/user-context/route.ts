import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/user-context — return the current user's saved context
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ context: null });
  }

  const { data: ctx } = await supabase
    .from("user_context")
    .select("full_name, city, interests, custom_notes, updated_at")
    .eq("user_id", profile.id)
    .maybeSingle();

  return NextResponse.json({ context: ctx ?? null });
}
