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
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }

  async function newConversation() {
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: "Nueva conversación" })
      .select()
      .single();
    if (data) {
      setConversations([data, ...conversations]);
      setActiveConv(data);
      setMessages([]);
      setShowSidebar(false);
    }
  }

  async function selectConv(conv: Conversation) {
    setActiveConv(conv);
    await loadMessages(conv.id);
    setShowSidebar(false);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;

    // Auto-create conversation if none selected
    let conv = activeConv;
    if (!conv) {
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title: "Nueva conversación" })
        .select()
        .single();
      if (data) {
        setConversations([data, ...conversations]);
        conv = data;
        setActiveConv(data);
      } else return;
    }

    const userMsg = input.trim();
    setInput("");
    setSending(true);

    if (!conv) return;

    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, role: "user", content: userMsg })
      .select()
      .single();

    if (inserted) setMessages(prev => [...prev, inserted]);

    try {
      const convId = conv.id;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: convId }),
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
          .insert({ conversation_id: convId, role: "assistant", content: result.message })
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
        setWeeklyUsed(p => p + 1);

        if (messages.filter(m => m.role === "user").length === 0) {
          const title = userMsg.slice(0, 50) + (userMsg.length > 50 ? "..." : "");
          await supabase.from("conversations")
            .update({ title, updated_at: new Date().toISOString() })
            .eq("id", convId);
          setActiveConv({ ...conv, title });
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
    textareaRef.current?.focus();
  }

  const remaining = weeklyLimit - weeklyUsed;
  const isDisabled = remaining <= 0;

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-200 md:translate-x-0 md:relative`}
        style={{ backgroundColor: "var(--surface)" }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded" style={{ backgroundColor: "var(--primary)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mente AI</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-1 rounded" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva conversación
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <p className="text-xs font-medium px-2 py-2" style={{ color: "var(--text-tertiary)" }}>Historial</p>
          {conversations.length === 0 ? (
            <p className="text-xs px-2 py-2" style={{ color: "var(--text-tertiary)" }}>Sin conversaciones</p>
          ) : (
            conversations.map(conv => (
              <button key={conv.id} onClick={() => selectConv(conv)}
                className={`w-full text-left px-2 py-2 rounded-lg text-sm mb-0.5 flex items-center gap-2 transition-colors ${
                  activeConv?.id === conv.id ? "" : "hover:bg-[var(--surface-hover)]"
                }`}
                style={{
                  color: activeConv?.id === conv.id ? "var(--primary)" : "var(--text-secondary)",
                  backgroundColor: activeConv?.id === conv.id ? "rgba(16,163,127,0.1)" : "transparent",
                }}>
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="truncate">{conv.title}</span>
              </button>
            ))
          )}
        </div>

        {/* Bottom menu */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-sm"
              style={{ color: "var(--text-secondary)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>U</div>
              <span className="flex-1 text-left truncate">Mi cuenta</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg shadow-lg py-1"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm"
                  style={{ color: "var(--danger)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar backdrop */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 flex items-center justify-between px-4 shrink-0 border-b"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <button onClick={() => setShowSidebar(true)}
            className="p-2 rounded-lg md:hidden" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Model indicator */}
          <div className="flex items-center gap-2 mx-auto md:mx-0">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Mente AI
            </span>
          </div>

          {/* Usage counter */}
          {remaining <= 200 && (
            <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "var(--surface)", color: "var(--warning)", border: "1px solid var(--border)" }}>
              {remaining} msgs
            </span>
          )}
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="text-center max-w-md">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "var(--surface)" }}>
                  <svg className="w-6 h-6" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M8.58 4.75C9.24 3.47 10.72 2.5 12.5 2.5c1.78 0 3.26.97 3.92 2.25M16.5 8c-2.17 0-4.23.75-5.77 2.13M15.5 16c0 5.25-4.5 9-9.5 9C6.5 25 2 21.25 2 16c0-2.5 1-4.77 2.63-6.33M14.5 12c1.88 0 3.41.97 4.27 2.44" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Mente AI
                </h2>
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                  {isDisabled ? "Límite semanal alcanzado" : "Escribe algo para comenzar"}
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <div className="w-5 h-5 border-2 rounded-full border-t-transparent animate-spin"
                  style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
                <span className="text-sm">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg, i) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded flex items-center justify-center mr-3 mt-1 shrink-0"
                      style={{ backgroundColor: "var(--primary)" }}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                  <div
                    className="max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                    style={{
                      backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--surface)",
                      color: "var(--text-primary)",
                      borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    }}>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded flex items-center justify-center mr-3 mt-1 shrink-0"
                    style={{ backgroundColor: "var(--primary)" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <div className="px-4 py-3 rounded-2xl text-sm" style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", borderRadius: "18px 18px 18px 4px" }}>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: "var(--primary)" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: "var(--primary)" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: "var(--primary)" }} />
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input area */}
        <div className="px-4 pb-6 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-2 px-4 py-3 rounded-2xl"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={isDisabled ? "Límite alcanzado" : "Escribe un mensaje..."}
                disabled={isDisabled || sending}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent"
                style={{ color: "var(--text-primary)", maxHeight: "200px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || isDisabled}
                className="shrink-0 p-2 rounded-xl transition-colors disabled:opacity-40"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p className="text-center text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
              Mente AI puede cometer errores. Verifica información importante.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}