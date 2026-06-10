import { auth } from "@clerk/nextjs/server";
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
  const { userId } = await auth();
  const supabase = await createClient();

  let userEmail = "";
  let initialFullName: string | null = null;
  let initialProfile: InitialProfile | null = null;

  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (profile) {
      userEmail = profile.email;
      initialProfile = profile;

      const { data: uc } = await supabase
        .from("user_context")
        .select("full_name")
        .eq("user_id", profile.id)
        .maybeSingle();
      initialFullName = uc?.full_name ?? null;
    }
  }

  return (
    <>
      <ChatInterface
        userId={userId ?? ""}
        initialIsLoggedIn={!!userId}
        initialUserEmail={userEmail}
        initialFullName={initialFullName}
        initialProfile={initialProfile}
      />
    </>
  );
}