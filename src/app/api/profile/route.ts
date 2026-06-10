import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET /api/profile — return the current user's profile
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, status, subscription_weeks, subscription_start, subscription_end, hourly_msg_count, weekly_reset_at, used_coupon_label, used_coupon_color")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ profile: null });
  return NextResponse.json({ profile });
}
