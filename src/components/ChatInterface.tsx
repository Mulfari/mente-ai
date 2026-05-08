"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

export default function ChatInterface({
  userId,
  weeklyUsed: initialUsed,
  weeklyLimit
}: {
  userId: string;
  weeklyUsed: number;
  weeklyLimit: number;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [weeklyUsed, setWeeklyUsed] = useState(initialUsed);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  async function loadConversations() {
    const { data } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (data) setConversations(data);
  }

  async function loadMessages(conversationId: string) {
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startNewConversation() {
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: "Nueva conversación" })
      .select()
      .single();
    if (data) {
      setConversations([data, ...conversations]);
      setActiveConv(data);
      setMessages([]);
    }
  }

  async function selectConversation(conv: Conversation) {
    setActiveConv(conv);
    await loadMessages(conv.id);
    setSidebarOpen(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending || !activeConv) return;

    const userMsg = input.trim();
    setInput("");
    setSending(true);

    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: activeConv.id, role: "user", content: userMsg })
      .select()
      .single();

    if (inserted) setMessages(prev => [...prev, inserted]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: activeConv.id }),
      });

      const result = await res.json();

      if (result.error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: result.error, created_at: new Date().toISOString(),
        }]);
      } else if (result.message) {
        const { data: aiMsg } = await supabase
          .from("messages")
          .insert({ conversation_id: activeConv.id, role: "assistant", content: result.message })
          .select()
          .single();

        if (aiMsg) {
          setMessages(prev => [...prev, aiMsg]);
        } else {
          setMessages(prev => [...prev, {
            id: Date.now().toString(), role: "assistant",
            content: result.message, created_at: new Date().toISOString(),
          }]);
        }
        setWeeklyUsed(prev => prev + 1);

        if (messages.length === 0) {
          const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : "");
          await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", activeConv.id);
          setActiveConv({ ...activeConv, title });
          loadConversations();
        }
      }
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: "Error de conexión. Intenta de nuevo.", created_at: new Date().toISOString(),
      }]);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  const remaining = weeklyLimit - weeklyUsed;

  return (
    <div className="flex-1 flex flex-col relative">
      {/* Sidebar overlay */}
      {sidebarOpen && (
        <div className="absolute inset-0 z-40 flex">
          <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="w-72 h-full flex flex-col" style={{ backgroundColor: "var(--surface)", borderLeft: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>Historial</span>
              <button onClick={() => setSidebarOpen(false)} style={{ color: "var(--text-secondary)" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <button onClick={startNewConversation}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium mb-4"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva conversación
              </button>
              <p className="text-xs font-medium px-3 py-2 mb-1" style={{ color: "var(--text-secondary)" }}>Recientes</p>
              {conversations.length === 0 ? (
                <p className="text-sm px-3 py-2" style={{ color: "var(--text-secondary)" }}>Sin conversaciones</p>
              ) : (
                conversations.map(conv => (
                  <button key={conv.id} onClick={() => selectConversation(conv)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm mb-1 truncate"
                    style={{
                      color: activeConv?.id === conv.id ? "var(--accent)" : "var(--text-secondary)",
                      backgroundColor: activeConv?.id === conv.id ? "var(--background)" : "transparent",
                    }}>
                    {conv.title}
                  </button>
                ))
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 border-b shrink-0"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg"
            style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
            <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
          </div>
        </div>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
              style={{ backgroundColor: "var(--primary)", color: "white" }}>U</div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-1 w-48 rounded-lg shadow-xl py-1 z-50"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                className="w-full flex items-center gap-2 px-4 py-2 text-sm" style={{ color: "var(--danger)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full px-4">
            <div className="text-center max-w-lg">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: "var(--primary)" }}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.58 4.75C9.24 3.47 10.72 2.5 12.5 2.5c1.78 0 3.26.97 3.92 2.25M16.5 8c-2.17 0-4.23.75-5.77 2.13M15.5 16c0 5.25-4.5 9-9.5 9C6.5 25 2 21.25 2 16c0-2.5 1-4.77 2.63-6.33M14.5 12c1.88 0 3.41.97 4.27 2.44" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                Mente<span style={{ color: "var(--accent)" }}>AI</span>
              </h2>
              <p className="text-base mb-2" style={{ color: "var(--text-secondary)" }}>
                {remaining > 0
                  ? activeConv ? "Escribe algo para continuar" : "Inicia una nueva conversación"
                  : "Has alcanzado tu límite semanal"}
              </p>
              {remaining <= 200 && remaining > 0 && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mt-2"
                  style={{ backgroundColor: "var(--surface)", color: "var(--warning)", border: "1px solid var(--border)" }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {remaining} mensajes restantes
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
              <div className="w-5 h-5 border-2 rounded-full border-t-transparent animate-spin"
                style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
              <span className="text-sm">Cargando...</span>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                  style={{
                    backgroundColor: msg.role === "user" ? "var(--primary)" : "transparent",
                    color: "var(--text-primary)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="px-4 py-3 rounded-2xl text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                  <span className="inline-flex items-center gap-2">
                    <div className="w-4 h-4 border-2 rounded-full border-t-transparent animate-spin"
                      style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} />
                    Escribiendo...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <div className="px-4 pb-6 pt-2 shrink-0">
        <div className="max-w-3xl mx-auto">
          {remaining <= 500 && remaining > 0 && (
            <div className="flex items-center justify-center mb-3">
              <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                {remaining} msgs restantes
              </span>
            </div>
          )}

          {!activeConv && (
            <button onClick={startNewConversation}
              className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
              style={{ backgroundColor: "var(--primary)", color: "white" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva conversación
            </button>
          )}

          <div className="flex items-end gap-2 p-2 rounded-2xl"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              placeholder={remaining > 0 ? "Escribe un mensaje..." : "Límite semanal agotado"}
              disabled={remaining <= 0 || sending}
              rows={1} className="flex-1 px-3 py-2 text-sm outline-none resize-none bg-transparent"
              style={{ color: "var(--text-primary)", maxHeight: "120px" }} />
            <button onClick={sendMessage} disabled={!input.trim() || sending || remaining <= 0}
              className="p-2 rounded-xl shrink-0" style={{ backgroundColor: "var(--primary)", color: "white" }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}