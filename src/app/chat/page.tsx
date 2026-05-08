import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import AuthModal from "@/components/AuthModal";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, weekly_used, weekly_msg_limit")
    .eq("id", user.id)
    .single();

  return (
    <>
      <ChatInterface
        userId={user.id}
        weeklyUsed={(profile as any)?.weekly_used ?? 0}
        weeklyLimit={(profile as any)?.weekly_msg_limit ?? 1000}
      />
      <AuthModal onSuccess={() => {}} />
    </>
  );
}