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

const CAPABILITIES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "Asistente inteligente",
    desc: "Pregunta lo que quieras, siempre disponible",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    title: "Escribe y crea",
    desc: "Correos, ensayos, código y más",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: "Respuestas instantáneas",
    desc: "Pensando, resumiendo y explicando",
  },
];

const SUGGESTIONS = [
  "Explícame física cuántica como si tuviera 10 años",
  "Ayúdame a planificar un viaje a Europa",
  "Escribe un poema sobre la tecnología",
  "Dame ideas para un negocio online",
];

export default function ChatInterface({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
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
        if (aiMsg) setMessages(prev => [...prev, aiMsg]);
        else setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: result.message, created_at: new Date().toISOString(),
        }]);

        if (conv.title === "Nueva conversación") {
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

  const isDisabled = !isLoggedIn;

  return (
    <div className="flex h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-72 flex flex-col transition-transform duration-200 md:translate-x-0 md:relative`}
        style={{ backgroundColor: "var(--surface)" }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-5 border-b shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Mulfai</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="p-4 shrink-0">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm font-semibold shadow-md transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 opacity-40"
                style={{ backgroundColor: "var(--background)" }}>
                <svg className="w-5 h-5" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Sin conversaciones</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(conv => (
                <div key={conv.id} onClick={() => selectConv(conv)}
                  className={`group w-full text-left px-3 py-2.5 rounded-xl text-sm flex items-center gap-3 cursor-pointer transition-all ${
                    activeConv?.id === conv.id ? "" : "hover:bg-[var(--surface-hover)]"
                  }`}
                  style={{
                    color: activeConv?.id === conv.id ? "var(--primary)" : "var(--text-secondary)",
                    backgroundColor: activeConv?.id === conv.id ? "rgba(16,163,127,0.12)" : "transparent",
                  }}>
                  <svg className="w-4 h-4 shrink-0 opacity-50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1 truncate font-medium">{conv.title}</span>
                  <button onClick={(e) => deleteConv(conv.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-[var(--danger)]/10"
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
        <div className="p-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-secondary)" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>U</div>
              <span className="flex-1 text-left text-sm font-medium" style={{ color: "var(--text-primary)" }}>Mi cuenta</span>
              <svg className="w-4 h-4 opacity-50" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 rounded-xl shadow-2xl overflow-hidden"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--danger)]/10"
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
        <header className="h-16 flex items-center justify-center px-4 shrink-0 border-b md:hidden"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <button onClick={() => setShowSidebar(true)}
            className="absolute left-4 p-2.5 rounded-xl hover:bg-[var(--surface-hover)] transition-colors" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>Mulfai</span>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-12">
              <div className="w-full max-w-lg">
                {/* Hero */}
                <div className="text-center mb-10">
                  {/* Gradient logo */}
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", boxShadow: "0 12px 40px rgba(16,163,127,0.3)" }}>
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>Mulfai</h1>
                  <p className="text-base" style={{ color: "var(--text-secondary)" }}>
                    Tu asistente de IA personal
                  </p>
                </div>

                {/* Capabilities */}
                <div className="grid grid-cols-1 gap-2 mb-6">
                  {CAPABILITIES.map((cap, i) => (
                    <div key={i}
                      className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-default hover:scale-[1.01] hover:shadow-md"
                      style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: "linear-gradient(135deg, rgba(16,163,127,0.15), rgba(16,163,127,0.05))" }}>
                        <div style={{ color: "var(--primary)" }}>{cap.icon}</div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold mb-0.5" style={{ color: "var(--text-primary)" }}>{cap.title}</p>
                        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{cap.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Suggestions */}
                {isLoggedIn && !isDisabled && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold text-center mb-3" style={{ color: "var(--text-tertiary)" }}>
                      Prueba preguntarme
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {SUGGESTIONS.map((s, i) => (
                        <button key={i} onClick={() => setInput(s)}
                          className="text-left px-4 py-3 rounded-xl text-sm transition-all hover:scale-[1.02] active:scale-[0.99]"
                          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 2px 6px rgba(0,0,0,0.1)" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!isLoggedIn && (
                  <div className="mt-6 text-center">
                    <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
                      Inicia sesión para comenzar a chatear
                    </p>
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-10 py-3.5 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white", boxShadow: "0 8px 24px rgba(16,163,127,0.3)" }}>
                      Iniciar sesión
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-2.5" style={{ color: "var(--text-secondary)" }}>
                <div className="w-5 h-5 border-2 rounded-full animate-spin"
                  style={{ borderColor: "var(--border)", borderTopColor: "var(--primary)" }} />
                <span className="text-sm">Cargando...</span>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-8">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-5 animate-fade-in group`}>
                  {msg.role === "assistant" && (
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mr-3 mt-0.5 shrink-0 shadow-md"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                  <div className="relative max-w-[78%]">
                    <div
                      className="px-5 py-3.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--surface)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                        borderRadius: msg.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                        boxShadow: msg.role === "assistant" ? "0 4px 12px rgba(0,0,0,0.2)" : "none",
                      }}>
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1 mt-1.5 justify-start opacity-0 group-hover:opacity-100 transition-all">
                        <button onClick={() => copyMessage(msg.content, msg.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                          style={{ color: "var(--text-tertiary)" }}>
                          {copiedId === msg.id ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex justify-start mb-5 animate-fade-in">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center mr-3 mt-0.5 shrink-0 shadow-md"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <div className="px-5 py-3.5 rounded-2xl text-sm"
                    style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", borderRadius: "18px 18px 18px 6px", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" }}>
                    <span className="inline-flex items-center gap-1.5">
                      {[0, 150, 300].map((delay, i) => (
                        <span key={i} className="w-2.5 h-2.5 rounded-full animate-pulse-dot"
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
            <div className="flex items-end gap-2 px-5 py-4 rounded-2xl shadow-lg transition-all"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.25)" }}>
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
                placeholder={isLoggedIn ? "Escribe un mensaje..." : "Inicia sesión para chatear..."}
                disabled={isDisabled || sending}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent"
                style={{ color: "var(--text-primary)", maxHeight: "200px" }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending || isDisabled}
                className="shrink-0 p-3 rounded-xl transition-all hover:opacity-90 active:scale-90 disabled:opacity-30"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white", boxShadow: "0 4px 12px rgba(16,163,127,0.3)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAuthPrompt && <AuthModal onSuccess={() => { setShowAuthPrompt(false); setIsLoggedIn(true); }} />}
    </div>
  );
}