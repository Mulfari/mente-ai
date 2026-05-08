import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import AuthModal from "@/components/AuthModal";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  if (!user) redirect("/");

  return (
    <>
      <ChatInterface userId={user.id} />
      <AuthModal onSuccess={() => {}} />
    </>
  );
}