import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";

type InitialProfile = {
  status?: string;
  subscription_weeks?: number;
  subscription_start?: string;
  subscription_end?: string;
  used_coupon_label?: string;
  used_coupon_color?: string;
  last_message_at?: string;
  weekly_reset_at?: string;
};

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;
  const userEmail = user?.email ?? "";

  // Fetch the user's display name + profile server-side so the first paint of
  // EmptyState, ChatInterface header, and ConversationSidebar is correct —
  // no "logged-out" flash before hydration.
  let initialFullName: string | null = null;
  let initialProfile: InitialProfile | null = null;
  if (user) {
    const [{ data: uc }, { data: p }] = await Promise.all([
      supabase
        .from("user_context")
        .select("full_name")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    initialFullName = uc?.full_name ?? null;
    initialProfile = p ?? null;
  }

  return (
    <>
      <ChatInterface
        userId={user?.id ?? ""}
        initialIsLoggedIn={!!user}
        initialUserEmail={userEmail}
        initialFullName={initialFullName}
        initialProfile={initialProfile}
      />
    </>
  );
}