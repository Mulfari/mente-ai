import { createClient } from "@/lib/supabase/server";
import ChatInterface from "@/components/ChatInterface";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ChatConvPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user ?? null;

  if (!user) {
    return <ChatInterface userId="" />;
  }

  // Verify conversation belongs to this user
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  return (
    <ChatInterface userId={user.id ?? ""} initialConversationId={conv ? id : undefined} />
  );
}
