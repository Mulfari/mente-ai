import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ChatInterface from "@/components/ChatInterface";

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
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "var(--primary)" }}>
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium mb-2" style={{ color: "var(--text-primary)" }}>
          Tu cuenta está pendiente de activación
        </p>
        <p className="text-sm text-center" style={{ color: "var(--text-secondary)" }}>
          Un administrador la activará pronto.
        </p>
        <a href="/" className="mt-4 text-sm font-medium px-4 py-2 rounded-lg" style={{ color: "var(--accent)" }}>
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside
        className="hidden md:flex flex-col w-64 h-full shrink-0 border-r"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="p-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
            <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
          </div>
        </div>

        <div className="p-3 shrink-0">
          <button
            onClick={() => window.location.href = "/chat"}
            className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva conversación
          </button>
        </div>

        <ConversationsList userId={user.id} />

        <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={async () => {
              const { createClient } = await import("@/lib/supabase/client");
              const s = createClient();
              await s.auth.signOut();
              window.location.href = "/";
            }}
            className="flex items-center gap-2 w-full py-2 px-3 rounded-xl text-sm"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <ChatInterface
        userId={user.id}
        weeklyUsed={profile.weekly_used}
        weeklyLimit={profile.weekly_msg_limit}
      />
    </div>
  );
}

async function ConversationsList({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(20);

  return (
    <div className="flex-1 overflow-y-auto px-3 pb-3">
      <p className="text-xs font-medium px-3 py-2" style={{ color: "var(--text-secondary)" }}>Recientes</p>
      {!data || data.length === 0 ? (
        <p className="text-sm px-3 py-2" style={{ color: "var(--text-secondary)" }}>Sin conversaciones</p>
      ) : (
        data.map(conv => (
          <button
            key={conv.id}
            onClick={() => window.location.href = `/chat?c=${conv.id}`}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm mb-1"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="truncate">{conv.title}</span>
          </button>
        ))
      )}
    </div>
  );
}