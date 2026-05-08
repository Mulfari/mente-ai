import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
import Sidebar from "@/components/Sidebar";
import AuthModal from "@/components/AuthModal";

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
    return (
      <div className="flex flex-col h-screen items-center justify-center px-4">
        <p className="text-lg mb-4" style={{ color: "var(--text-primary)" }}>
          Tu cuenta está pendiente de activación.
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Un administrador la activará pronto.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userId={user.id} />
      <ChatInterface userId={user.id} />
      <AuthModal />
    </div>
  );
}