import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  return (
    <>
      <ChatInterface userId={user?.id ?? ""} />
    </>
  );
}