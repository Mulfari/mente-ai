import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";
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
      <div className="flex flex-col h-screen items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
        <p className="text-lg font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Tu cuenta está pendiente de activación
        </p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Un administrador la activará pronto.
        </p>
        <a href="/" className="mt-4 text-sm font-medium px-4 py-2 rounded-lg" style={{ color: "var(--primary)" }}>
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <>
      <ChatInterface
        userId={user.id}
        weeklyUsed={profile.weekly_used}
        weeklyLimit={profile.weekly_msg_limit}
      />
      <AuthModal />
    </>
  );
}