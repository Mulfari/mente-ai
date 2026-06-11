import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile, type Profile } from "@/lib/profile";
import ChatInterface from "@/components/ChatInterface";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatConvPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();

  let internalUserId = "";
  let userEmail = "";
  let initialFullName: string | null = null;
  let initialProfile: Profile | null = null;

  if (userId) {
    const profile = await getOrCreateProfile(userId);
    if (profile) {
      internalUserId = profile.id;
      userEmail = profile.email;
      initialProfile = profile;

      const supabase = createClient();
      const { data: uc } = await supabase
        .from("user_context")
        .select("full_name")
        .eq("user_id", profile.id)
        .maybeSingle();
      initialFullName = uc?.full_name ?? null;
    }
  }

  return (
    <ChatInterface
      userId={internalUserId}
      convIdFromUrl={id}
      initialIsLoggedIn={!!internalUserId}
      initialUserEmail={userEmail}
      initialFullName={initialFullName}
      initialProfile={initialProfile}
    />
  );
}
