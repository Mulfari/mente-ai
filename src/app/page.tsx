import { auth } from "@clerk/nextjs/server";
import ChatInterface from "@/components/ChatInterface";
import LandingPageGate from "@/components/landing/LandingPageGate";
import { getOrCreateProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPageGate />;
  }

  const profile = await getOrCreateProfile(userId);
  if (!profile) {
    // DB unavailable — show the landing rather than crashing the page.
    return <LandingPageGate />;
  }

  const supabase = createClient();
  const { data: uc } = await supabase
    .from("user_context")
    .select("full_name")
    .eq("user_id", profile.id)
    .maybeSingle();

  return (
    <ChatInterface
      userId={profile.id}
      initialIsLoggedIn
      initialUserEmail={profile.email}
      initialFullName={uc?.full_name ?? null}
      initialProfile={profile}
    />
  );
}
