import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";
import LandingPageGate from "@/components/landing/LandingPageGate";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;

  if (!userId) {
    return <LandingPageGate />;
  }

  return <ChatInterface userId={userId} />;
}
