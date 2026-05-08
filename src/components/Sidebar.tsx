"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

export default function Sidebar({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);
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

  async function handleLogout() {
    setLogoutLoading(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col w-64 h-full border-r"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Logo */}
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
            <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
          </div>
        </div>

        {/* Nueva conversación */}
        <div className="p-3">
          <Link
            href="/chat"
            className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: "var(--primary)", color: "white" }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva conversación
          </Link>
        </div>

        {/* Lista de conversaciones */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="text-xs font-medium px-3 py-2" style={{ color: "var(--text-secondary)" }}>
            Recientes
          </p>
          {loading ? (
            <p className="text-sm px-3 py-2" style={{ color: "var(--text-secondary)" }}>Cargando...</p>
          ) : conversations.length === 0 ? (
            <p className="text-sm px-3 py-2" style={{ color: "var(--text-secondary)" }}>
              Sin conversaciones
            </p>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                className="w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors truncate"
                style={{ color: "var(--text-secondary)" }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--background)")}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                {conv.title}
              </button>
            ))
          )}
        </div>

        {/* Logout */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="flex items-center gap-2 w-full py-2 px-3 rounded-lg text-sm transition-colors"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--danger)", e.currentTarget.style.color = "white")}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent", e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {logoutLoading ? "Saliendo..." : "Cerrar sesión"}
          </button>
        </div>
      </aside>

      {/* Mobile: top bar + logout button */}
      <div
        className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 h-14"
        style={{ backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
          <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {logoutLoading ? "..." : "Salir"}
        </button>
      </div>
    </>
  );
}