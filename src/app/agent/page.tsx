"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";

export const dynamic = 'force-dynamic';

let supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!supabase) supabase = createClient();
  return supabase;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  _loading?: boolean;
}

const CITIES = [
  { label: "Maracay", value: "Maracay" },
  { label: "Caracas", value: "Caracas" },
  { label: "Valencia", value: "Valencia" },
  { label: "Barquisimeto", value: "Barquisimeto" },
  { label: "San Cristóbal", value: "San Cristóbal" },
  { label: "Maracaibo", value: "Maracaibo" },
  { label: "Ciudad Guayana", value: "Ciudad Guayana" },
  { label: "Barcelona", value: "Barcelona" },
  { label: "Maturín", value: "Maturín" },
  { label: "Cumaná", value: "Cumaná" },
  { label: "Barinas", value: "Barinas" },
  { label: "Cabimas", value: "Cabimas" },
  { label: "Turmero", value: "Turmero" },
  { label: "Acarigua", value: "Acarigua" },
  { label: "Ciudad Bolívar", value: "Ciudad Bolívar" },
];

const VPS_URL = "http://177.7.46.156:3000";

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString("es-VE", { hour: "2-digit", minute: "2-digit" });
}

export default function AgentPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showCityPrompt, setShowCityPrompt] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function checkAuth() {
    const { data: { user } } = await getSupabase().auth.getUser();
    if (user) {
      setIsLoggedIn(true);
      setUserId(user.id);
      setShowCityPrompt(true);
      // Welcome message
      setMessages([{
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Hola! Soy **Mente AI**, tu asistente personal con inteligencia artificial.\n\nEstoy aqui para ayudarte con lo que necesites: restaurantes, servicios, informacion local, y mucho mas.\n\nAntes de empezar, **en que ciudad estas?** Asi puedo darte respuestas personalizadas.",
        created_at: new Date().toISOString(),
      }]);
    } else {
      window.location.href = "/";
    }
    setIsLoading(false);
  }

  function selectCity(city: string) {
    setShowCityPrompt(false);
    setIsAgentMode(true);
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Perfecto! Soy tu agente en ${city}. Estoy listo para ayudarte.\n\nPreguntame lo que quieras.`,
      created_at: new Date().toISOString(),
    }]);
  }

  async function sendMessage() {
    if (!input.trim() || isSending) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setConversationHistory(prev => [...prev, { role: "user", content: input.trim() }]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch(`${VPS_URL}/api/orchestrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: input.trim(),
          user_id: userId,
          conversation_id: "agent",
          mode: "normal",
          attachments: [],
          agent_mode: true,
        }),
        signal: AbortSignal.timeout(300000),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error del servidor");
      }

      const result = await res.json();
      const fullResponse = result.response || "";

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: fullResponse,
        created_at: new Date().toISOString(),
      };

      setMessages(prev => [...prev, assistantMsg]);
      setConversationHistory(prev => [...prev, { role: "assistant", content: fullResponse }]);

      // Save to Supabase
      await getSupabase().from("messages").insert({
        id: assistantMsg.id,
        conversation_id: "agent",
        role: "assistant",
        content: fullResponse,
      });

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${err.message || "No se pudo procesar tu mensaje."}`,
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ backgroundColor: "var(--background)" }}>
        <div className="animate-spin w-8 h-8 rounded-full border-2" style={{ borderColor: "var(--primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (showCityPrompt && isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🧠</div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--primary)" }}>Mente AI</h1>
            <p className="text-base" style={{ color: "var(--text-tertiary)" }}>Tu asistente personal con IA</p>
          </div>
          <div className="text-center mb-6">
            <p className="text-base font-medium mb-1" style={{ color: "var(--text-primary)" }}>Para darte la mejor experiencia</p>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>En que ciudad estas?</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {CITIES.map(city => (
              <button
                key={city.value}
                onClick={() => selectCity(city.value)}
                className="py-3 px-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                style={{ backgroundColor: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
              >
                {city.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="flex-none px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">🧠</span>
          <span className="font-bold text-base" style={{ color: "var(--primary)" }}>Mente AI</span>
        </div>
        <button
          onClick={() => window.location.href = "/"}
          className="text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{ color: "var(--text-secondary)", backgroundColor: "transparent", border: "1px solid var(--border)" }}
        >
          Volver al inicio
        </button>
      </header>

      {/* Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg"
          style={{ backgroundColor: "var(--primary)", color: "white" }}>
          {notification}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4`}>
              <div className={`max-w-[80%] ${msg.role === "user" ? "order-1" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-2 mb-1.5 ml-1">
                    <span className="text-base">🤖</span>
                    <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>Mente AI</span>
                  </div>
                )}
                <div
                  className="rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor: msg.role === "user" ? "var(--user-bubble)" : "var(--surface)",
                    color: msg.role === "user" ? "white" : "var(--text-primary)",
                    borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  }}
                >
                  <ReactMarkdown
                    components={{
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2">
                          <table className="w-full text-xs border-collapse" style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="px-3 py-2 text-left font-semibold uppercase" style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="px-3 py-2" style={{ borderTop: "1px solid var(--border)" }}>
                          {children}
                        </td>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="border-l-4 pl-3 my-2" style={{ borderColor: "var(--primary)", color: "var(--text-secondary)" }}>
                          {children}
                        </blockquote>
                      ),
                      code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
                <span className="text-xs mt-1 block ml-1" style={{ color: "var(--text-tertiary)" }}>
                  {formatTime(msg.created_at)}
                </span>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start mb-4">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--text-tertiary)", animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--text-tertiary)", animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: "var(--text-tertiary)", animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-none">
        <div className="max-w-2xl mx-auto">
          <div className="relative flex items-end gap-2 rounded-2xl px-4 py-3" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Preguntame lo que quieras..."
              className="flex-1 resize-none bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)", maxHeight: "120px" }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || isSending}
              className="flex-none w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              style={{
                backgroundColor: input.trim() ? "var(--primary)" : "var(--surface)",
                color: input.trim() ? "white" : "var(--text-tertiary)",
                cursor: input.trim() ? "pointer" : "default",
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-center text-xs mt-2" style={{ color: "var(--text-tertiary)" }}>
            Mente AI puede cometer errores. Verifica informacion importante.
          </p>
        </div>
      </div>
    </div>
  );
}