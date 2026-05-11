import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatConvPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  // Verify conversation belongs to this user before rendering
  if (user) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (!conv) {
      // Redirect to /chat if conversation doesn't exist or doesn't belong to user
      return (
        <ChatInterface userId={user.id ?? ""} />
      );
    }
  }

  return (
    <ChatInterface userId={user?.id ?? ""} />
  );
}
