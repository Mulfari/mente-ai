"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import AuthModal from "./AuthModal";

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

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => {
      setIsLoggedIn(!!d.session);
    });
  }, []);

  async function loadConversations() {
    if (!isLoggedIn) return;
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
  }, [userId, isLoggedIn]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }

  async function newConversation() {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
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
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    setActiveConv(conv);
    await loadMessages(conv.id);
    setShowSidebar(false);
  }

  async function deleteConv(convId: string, e: React.MouseEvent) {
    e.stopPropagation();
    await supabase.from("conversations").delete().eq("id", convId);
    setConversations(prev => prev.filter(c => c.id !== convId));
    if (activeConv?.id === convId) {
      setActiveConv(null);
      setMessages([]);
    }
  }

  async function copyMessage(content: string, msgId: string) {
    await navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function sendMessage() {
    if (!input.trim() || sending) return;

    if (!isLoggedIn) { setShowAuthPrompt(true); return; }

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
    autoResize();

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
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  const remaining = weeklyLimit - weeklyUsed;
  const isDisabled = remaining <= 0 || !isLoggedIn;

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-200 md:translate-x-0 md:relative`}
        style={{ backgroundColor: "var(--surface)" }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mulfai</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-1 rounded hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90 active:scale-95"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nueva conversación
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider px-2 py-2" style={{ color: "var(--text-tertiary)" }}>Historial</p>
          {conversations.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Sin conversaciones</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map(conv => (
                <div key={conv.id} onClick={() => selectConv(conv)}
                  className={`group w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-2 cursor-pointer transition-all ${
                    activeConv?.id === conv.id ? "" : "hover:bg-[var(--surface-hover)]"
                  }`}
                  style={{
                    color: activeConv?.id === conv.id ? "var(--primary)" : "var(--text-secondary)",
                    backgroundColor: activeConv?.id === conv.id ? "rgba(16,163,127,0.1)" : "transparent",
                  }}>
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1 truncate">{conv.title}</span>
                  <span className="text-xs shrink-0 opacity-0 group-hover:opacity-60" style={{ color: "var(--text-tertiary)" }}>
                    {formatTime(conv.updated_at)}
                  </span>
                  <button onClick={(e) => deleteConv(conv.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-60 p-1 rounded hover:bg-[var(--danger)]/10 transition-all"
                    style={{ color: "var(--danger)" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-secondary)" }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>U</div>
              <span className="flex-1 text-left truncate">Mi cuenta</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl shadow-xl py-1 overflow-hidden"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="px-3 py-2 mb-1" style={{ borderBottom: "1px solid var(--border)" }}>
                  <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Semanal</p>
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    {remaining} mensajes restantes
                  </p>
                </div>
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-[var(--danger)]/10"
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
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 shrink-0 border-b"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <button onClick={() => setShowSidebar(true)}
            className="p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors md:hidden" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 mx-auto md:mx-0">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mulfai</span>
          </div>

          <div className="w-5 md:w-0" />
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="text-center max-w-lg">
                {/* Large logo */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg"
                  style={{ backgroundColor: "var(--primary)" }}>
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <h1 className="text-2xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Mulfai</h1>
                <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
                  {isDisabled ? "Límite semanal alcanzado" : "Tu asistente IA personal"}
                </p>

                {/* Suggestion cards */}
                {isLoggedIn && !isDisabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md mx-auto">
                    {[
                      "Explícame un tema complejo de forma simple",
                      "Ayúdame a escribir un correo profesional",
                      "Resuelve un problema técnico que tengo",
                      "Genera ideas creativas para un proyecto",
                    ].map((suggestion, i) => (
                      <button key={i} onClick={() => setInput(suggestion)}
                        className="text-left px-4 py-3 rounded-xl text-sm transition-all hover:bg-[var(--surface)] active:scale-95"
                        style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {!isLoggedIn && (
                  <div className="max-w-sm mx-auto">
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                      Inicia sesión para chatear con Mulfai
                    </p>
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-6 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
                      style={{ backgroundColor: "var(--primary)", color: "white" }}>
                      Iniciar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
                <span className="text-sm">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in group`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center mr-3 mt-1 shrink-0 shadow-md"
                      style={{ backgroundColor: "var(--primary)" }}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                  <div className="relative max-w-[85%]">
                    <div
                      className="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm"
                      style={{
                        backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--surface)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                        borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                        boxShadow: msg.role === "assistant" ? "0 2px 8px rgba(0,0,0,0.3)" : "none",
                      }}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-transparent prose-pre:p-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className={`flex items-center gap-1 mt-1 ${msg.role === "user" ? "justify-end" : "justify-start"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                      <button onClick={() => copyMessage(msg.content, msg.id)}
                        className="p-1 rounded-md hover:bg-[var(--surface-hover)] transition-colors"
                        style={{ color: "var(--text-tertiary)" }} title="Copiar">
                        {copiedId === msg.id ? (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start animate-fade-in">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center mr-3 mt-1 shrink-0"
                    style={{ backgroundColor: "var(--primary)" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <div className="px-4 py-3 rounded-2xl shadow-sm text-sm"
                    style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", borderRadius: "18px 18px 18px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {[0, 150, 300].map((delay, i) => (
                        <span key={i} className="w-2 h-2 rounded-full animate-pulse-dot"
                          style={{ backgroundColor: "var(--primary)", animationDelay: `${delay}ms` }} />
                      ))}
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
            {/* Input container */}
            <div className="flex items-end gap-3 px-4 py-3 rounded-2xl shadow-lg transition-all"
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
                placeholder={isLoggedIn ? (isDisabled ? "Límite alcanzado" : "Escribe un mensaje...") : "Inicia sesión para chatear..."}
                disabled={isDisabled || sending}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent placeholder-opacity-50"
                style={{ color: "var(--text-primary)", maxHeight: "200px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || isDisabled}
                className="shrink-0 p-2.5 rounded-xl transition-all hover:opacity-90 active:scale-90 disabled:opacity-30"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {/* Footer hint */}
            <div className="flex items-center justify-center gap-3 mt-3">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Mulfai puede cometer errores. Verifica información importante.
              </p>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>·</span>
              <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                Enter = enviar · Shift+Enter = nueva línea
              </span>
            </div>
          </div>
        </div>
      </div>
      {showAuthPrompt && <AuthModal onSuccess={() => { setShowAuthPrompt(false); setIsLoggedIn(true); }} />}
    </div>
  );
}