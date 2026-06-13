import { currentUser } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  email: string;
  clerk_user_id?: string;
  status?: string;
  role?: string;
  subscription_weeks?: number;
  subscription_start?: string;
  subscription_end?: string;
  used_coupon_label?: string;
  used_coupon_color?: string;
  last_message_at?: string;
  weekly_reset_at?: string;
  plan?: string;
  daily_msg_count?: number;
  daily_reset_at?: string;
};

// Resolve the internal profile for a Clerk user. The Clerk webhook
// (user.created) normally creates the row; this fallback covers the gap
// when the webhook is delayed or not yet configured, so a fresh sign-up
// can use the app immediately.
export async function getOrCreateProfile(clerkUserId: string): Promise<Profile | null> {
  const supabase = createClient();

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (existing) return existing as Profile;

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses?.[0]?.emailAddress ??
    "";

  const { data: created, error } = await supabase
    .from("profiles")
    .upsert(
      { clerk_user_id: clerkUserId, email, status: "active", subscription_weeks: 0, weekly_limit: 0 },
      { onConflict: "clerk_user_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("[profile] getOrCreateProfile failed", error);
    return null;
  }
  return created as Profile;
}

// Lookup-only variant for API routes that must not create rows.
export async function getProfileByClerkId(clerkUserId: string): Promise<Profile | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  return (data as Profile) ?? null;
}
