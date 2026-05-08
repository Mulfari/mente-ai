import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";
import AuthModal from "@/components/AuthModal";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;

  return (
    <>
      <ChatInterface userId={userId ?? ""} />
    </>
  );
}