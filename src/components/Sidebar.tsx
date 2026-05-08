"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

export default function Sidebar({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function loadConversations() {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data);
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, [userId]);

  return (
    <aside
      className="hidden md:flex flex-col w-64 h-full shrink-0 border-r"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="p-4 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
          <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
        </div>
      </div>

      {/* New conversation */}
      <div className="p-3 shrink-0">
        <a
          href="/chat"
          className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl text-sm font-medium text-center transition-colors"
          style={{ backgroundColor: "var(--primary)", color: "white" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva conversación
        </a>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <p className="text-xs font-medium px-3 py-2" style={{ color: "var(--text-secondary)" }}>
          Recientes
        </p>
        {loading ? (
          <div className="flex items-center gap-2 px-3 py-2" style={{ color: "var(--text-secondary)" }}>
            <div className="w-4 h-4 border-2 rounded-full border-t-transparent animate-spin" style={{ borderColor: "var(--text-secondary)", borderTopColor: "transparent" }} />
            <span className="text-xs">Cargando...</span>
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-sm px-3 py-2" style={{ color: "var(--text-secondary)" }}>
            Sin conversaciones
          </p>
        ) : (
          conversations.map((conv) => (
            <a
              key={conv.id}
              href={`/chat?c=${conv.id}`}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm mb-1 transition-colors truncate"
              style={{ color: "var(--text-secondary)" }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--background)")}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="truncate">{conv.title}</span>
            </a>
          ))
        )}
      </div>

      {/* Bottom: user info */}
      <div className="p-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          className="flex items-center gap-2 w-full py-2 px-3 rounded-xl text-sm transition-colors"
          style={{ color: "var(--text-secondary)" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--background)")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}