import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  // Fetch the user's display name server-side so the EmptyState opener
  // renders correctly on first paint (no "VeChat" flash before hydration).
  let initialFullName: string | null = null;
  if (user) {
    const { data: uc } = await supabase
      .from("user_context")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    initialFullName = uc?.full_name ?? null;
  }

  return (
    <ChatInterface
      userId={user?.id ?? ""}
      initialIsLoggedIn={!!user}
      initialFullName={initialFullName}
    />
  );
}