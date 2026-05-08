import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";
import AuthModal from "@/components/AuthModal";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  const profile = userId
    ? await supabase.from("profiles").select("weekly_used, weekly_msg_limit").eq("id", userId).single()
    : null;

  return (
    <>
      <ChatInterface
        userId={userId ?? ""}
        weeklyUsed={(profile as any)?.weekly_used ?? 0}
        weeklyLimit={(profile as any)?.weekly_msg_limit ?? 1000}
      />
    </>
  );
}