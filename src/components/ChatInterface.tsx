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
};

export default function ChatInterface({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [weeklyUsed, setWeeklyUsed] = useState(0);
  const [weeklyLimit] = useState(1000); // TBD
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  async function loadConversations() {
    const { data } = await supabase
      .from("conversations")
      .select("id, title")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
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

  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("weekly_used, weekly_msg_limit")
      .eq("id", userId)
      .single();
    if (data) setWeeklyUsed(data.weekly_used);
  }

  useEffect(() => {
    loadConversations();
    loadProfile();
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function startNewConversation() {
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: userId, title: "Nueva conversación" })
      .select()
      .single();
    if (data) {
      setConversations([data, ...conversations]);
      setActiveConversation(data);
      setMessages([]);
    }
  }

  async function sendMessage() {
    if (!input.trim() || sending || !activeConversation) return;

    const userMsg = input.trim();
    setInput("");
    setSending(true);

    // Add user message
    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        conversation_id: activeConversation.id,
        role: "user",
        content: userMsg,
      })
      .select()
      .single();

    if (inserted) {
      setMessages(prev => [...prev, inserted]);
    }

    // Send to API
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          conversation_id: activeConversation.id,
        }),
      });

      const result = await res.json();

      if (result.error) {
        const errorMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: `Error: ${result.error}`,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, errorMsg]);
      } else if (result.message) {
        const aiMsg: Message = {
          id: Date.now().toString(),
          role: "assistant",
          content: result.message,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
        setWeeklyUsed(prev => prev + 1);

        // Update conversation title if it's the first message
        if (messages.length === 0) {
          const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : "");
          await supabase
            .from("conversations")
            .update({ title, updated_at: new Date().toISOString() })
            .eq("id", activeConversation.id);
          setActiveConversation({ ...activeConversation, title });
          loadConversations();
        }
      }
    } catch (err) {
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: "Error de conexión. Intenta de nuevo.",
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }

    setSending(false);
  }

  const remaining = weeklyLimit - weeklyUsed;

  return (
    <div className="flex-1 flex flex-col md:ml-0 mt-14 md:mt-0">
      {/* Mobile menu toggle */}
      <div className="md:hidden flex items-center px-4 py-2" style={{ backgroundColor: "var(--surface)" }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="text-sm px-3 py-1.5 rounded-lg"
          style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          {menuOpen ? "Cerrar" : "Historial"}
        </button>
      </div>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="mb-4">
              <span className="text-3xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
              <span className="text-3xl font-semibold" style={{ color: "var(--text-primary)" }}> AI</span>
            </div>
            <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              {remaining > 0
                ? "Escribe un mensaje para comenzar"
                : "Has alcanzado tu límite semanal"}
            </p>
            {remaining <= 100 && remaining > 0 && (
              <p className="text-xs" style={{ color: "var(--warning)" }}>
                Te quedan {remaining} mensajes esta semana
              </p>
            )}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Cargando...</p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm"
                  style={{
                    backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--surface)",
                    color: "var(--text-primary)",
                    border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl text-sm"
                  style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
                >
                  Escribiendo...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="max-w-2xl mx-auto">
          {/* Counter */}
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {remaining} mensajes restantes esta semana
            </span>
            {!activeConversation && (
              <button
                onClick={startNewConversation}
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
              >
                Nueva conversación
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={remaining > 0 ? "Escribe un mensaje..." : "Límite alcanzado"}
              disabled={remaining <= 0 || sending}
              className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending || remaining <= 0}
              className="px-4 py-3 rounded-xl transition-opacity"
              style={{ backgroundColor: "var(--primary)", color: "white" }}
            >
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