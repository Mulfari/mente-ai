import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import Sidebar from "@/components/Sidebar";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("status, weekly_used, weekly_msg_limit")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    redirect("/");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userId={user.id} />
      <ChatInterface userId={user.id} />
    </div>
  );
}