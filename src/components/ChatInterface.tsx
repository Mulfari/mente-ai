"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import dynamic from "next/dynamic";
const AuthModal = dynamic(() => import("./AuthModal"));
const AccountMenu = dynamic(() => import("./AccountMenu"));

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  user_id?: string;
  conversation_id?: string;
  attachments?: string[];
  _previewUrls?: Record<string, string>;
  _loading?: boolean;
  in_progress?: boolean;
  _retryReq?: { message: string; conversationId: string; contentParts: any[]; mode: string } | null;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};


export default function ChatInterface({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarLock, setSidebarLock] = useState<"locked" | "unlocked">("unlocked");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [profile, setProfile] = useState<{status?: string; subscription_weeks?: number; subscription_start?: string; subscription_end?: string; used_coupon_label?: string; used_coupon_color?: string; last_message_at?: string; weekly_reset_at?: string} | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
    const [onboardingStep, setOnboardingStep] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [isSendDisabled, setIsSendDisabled] = useState(false);
  const [responseMode, setResponseMode] = useState<"normal" | "deep">("normal");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [displayedText, setDisplayedText] = useState<Record<string, string>>({});
  // Typing reveal state per message
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const revealCancelled = useRef<Record<string, boolean>>({});

  function smoothReveal(msgId: string, text: string) {
    // Cancel any pending reveal for this message
    if (revealTimers.current[msgId]) {
      clearTimeout(revealTimers.current[msgId]!);
      revealTimers.current[msgId] = null;
    }
    revealCancelled.current[msgId] = false;

    const current = displayedText[msgId] || "";
    if (current === text) return;

    // If text jumped significantly (>15 chars new), show all at once then start char reveal
    if (text.length > current.length + 15) {
      // Flash all new content immediately so it never looks stuck
      setDisplayedText(prev => ({ ...prev, [msgId]: text }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text } : m));
      return;
    }

    // Reveal character by character from current position
    let charIndex = current.length;
    const tick = () => {
      if (revealCancelled.current[msgId]) return;
      charIndex++;
      const revealed = text.slice(0, charIndex);
      setDisplayedText(prev => ({ ...prev, [msgId]: revealed }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: revealed } : m));

      if (charIndex >= text.length) return; // Done

      // Natural typing rhythm
      const prevCh = text[charIndex - 1] || "";
      const nextCh = text[charIndex] || "";
      let delay = 15 + Math.random() * 10;
      if (".!?".includes(prevCh)) delay = 70 + Math.random() * 50; // Long pause after sentence end
      else if (",;:".includes(prevCh)) delay = 45 + Math.random() * 30; // Medium pause
      else if (nextCh === " " || nextCh === "\n") delay = 25 + Math.random() * 15; // Quick space
      else if (nextCh === "`") delay = 5; // Fast for code
      else if (prevCh === " ") delay = 20 + Math.random() * 10; // Word start

      revealTimers.current[msgId] = setTimeout(tick, delay);
    };

    revealTimers.current[msgId] = setTimeout(tick, 40);
  }

  function flushReveal(msgId: string, text: string) {
    // Called when streaming ends — cancel reveal and show full text
    revealCancelled.current[msgId] = true;
    if (revealTimers.current[msgId]) {
      clearTimeout(revealTimers.current[msgId]!);
      revealTimers.current[msgId] = null;
    }
    setDisplayedText(prev => ({ ...prev, [msgId]: text }));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text } : m));
  }
  type QueuedMsg = { text: string; files: File[]; previews: Record<string, string> };
  const queuedMsgRef = useRef<QueuedMsg | null>(null);
  const currentStreamReqRef = useRef<{ message: string; conversationId: string; contentParts: any[]; mode: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const lastErrorRef = useRef<{ message: string; conversationId: string | null; attachments: any[] } | null>(null);

  useEffect(() => {
    // Read theme from localStorage on mount
    try {
      const saved = localStorage.getItem("mulfai-theme");
      const initialTheme = saved === "light" ? "light" : "dark";
      setTheme(initialTheme);
      document.documentElement.setAttribute("data-theme", initialTheme);
    } catch {}

    supabase.auth.getSession().then(({ data: d }) => {
      setIsLoggedIn(!!d.session);
      if (d.session?.user?.email) setUserEmail(d.session.user.email);
      if (d.session) loadConversations(d.session.user.id);
      if (d.session) {
        setTimeout(() => {
          const seen = localStorage.getItem("mulfai_onboarding_seen");
          const never = localStorage.getItem("mulfai_onboarding_never");
          console.log("[Onboarding] getSession — seen:", seen, "never:", never, "→ shouldShow:", !seen && !never);
          if (!seen && !never) setShowOnboarding(true);
        }, 1500);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      if (session?.user?.email) setUserEmail(session.user.email);
      if (loggedIn && session?.user?.id) {
        loadConversations(session.user.id);
        // Show onboarding on login (only if not already dismissed)
        setTimeout(() => {
          const seen = localStorage.getItem("mulfai_onboarding_seen");
          const never = localStorage.getItem("mulfai_onboarding_never");
          console.log("[Onboarding] onAuthStateChange — seen:", seen, "never:", never, "→ shouldShow:", !seen && !never);
          if (!seen && !never) setShowOnboarding(true);
        }, 800);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load daily suggestions
  function loadSuggestions() {
    if (!isLoggedIn) return;
    setSuggestionsLoading(true);
    fetch("/api/suggestions")
      .then(r => r.json())
      .then(d => { if (d.suggestions) setSuggestions(d.suggestions); setSuggestionsLoading(false); })
      .catch(() => setSuggestionsLoading(false));
  }
  useEffect(() => {
    loadSuggestions();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    supabase
      .from("profiles")
      .select("subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at, status")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [userId, isLoggedIn]);

  // Theme: read from localStorage and sync with document
  useEffect(() => {
    try {
      const stored = localStorage.getItem("mulfai-theme") as "dark" | "light" | null;
      if (stored === "light" || stored === "dark") {
        setTheme(stored);
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch {}
  }, []);

  async function loadConversations(currentUserId?: string) {
    const uid = currentUserId ?? userId;
    if (!uid) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at, messages(count)")
      .eq("user_id", uid)
      .order("updated_at", { ascending: false })
      .limit(20);
    if (!data) return;
    // Filter out empty "Nueva conversación" placeholders (never had a message)
    const filtered = data.filter((c: any) => {
      const msgs = c.messages as any[];
      return (msgs && msgs.length > 0 && (msgs[0]?.count ?? 0) > 0) || c.title !== "Nueva conversación";
    });
    setConversations(filtered);
  }

  async function loadMessages(conversationId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) console.error("loadMessages error:", error);
    // Filter out messages still actively streaming with no content.
    // If message has content (from progressive save), show it even if in_progress=true
    const valid = (data ?? []).filter(m => !(m.role === "assistant" && m.in_progress && !m.content));
    // Clear streaming state — these were saved from a previous session
    setStreamingMsgId(null);
    setMessages(valid);
    lastErrorRef.current = null;
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, [userId, isLoggedIn]);

  // Load initial conversation from URL (works for both /chat and /chat/[id])
  // Runs whenever isLoggedIn or userId changes, plus checks URL on mount
  useEffect(() => {
    async function loadFromUrl() {
      if (!isLoggedIn || !userId) return;

      const parts = window.location.pathname.split("/").filter(Boolean);
      const urlId = parts[parts.length - 1];
      console.log("[Mulfai] loadFromUrl url:", window.location.pathname, "urlId:", urlId);

      if (!urlId || urlId === "chat" || urlId === userId) {
        setActiveConv(null);
        setMessages([]);
        return;
      }

      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("id", urlId)
        .eq("user_id", userId)
        .single();
      console.log("[Mulfai] conv result:", data?.id, "error:", error);

      if (!data || error) {
        // Conversation not found — reset to home
        setActiveConv(null);
        setMessages([]);
        return;
      }

      setActiveConv(data);
      setConversations(prev => prev.some(c => c.id === data.id) ? prev : [data, ...prev]);
      console.log("[Mulfai] calling loadMessages:", data.id);
      await loadMessages(data.id);
      console.log("[Mulfai] done, messages count:", messages.length);
    }
    loadFromUrl();
  }, [isLoggedIn, userId]);

  // Sync activeConv with URL when user changes conversations
  useEffect(() => {
    if (!activeConv) return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const urlId = parts[parts.length - 1];
    if (urlId !== activeConv.id) {
      window.history.replaceState(null, "", `/chat/${activeConv.id}`);
    }
  }, [activeConv]);

  // Realtime subscription for conversations
  useEffect(() => {
    if (!isLoggedIn || !userId) return;

    const channel = supabase
      .channel("conversations-sidebar")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "conversations",
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          const conv = payload.new as Conversation;
          setConversations(prev => {
            if (prev.find(c => c.id === conv.id)) return prev;
            return [conv, ...prev];
          });
        } else if (payload.eventType === "DELETE") {
          setConversations(prev => prev.filter(c => c.id !== payload.old.id));
        } else if (payload.eventType === "UPDATE") {
          setConversations(prev => {
            const updated = prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c);
            // Only hide empty "Nueva conversación" if it has no messages (checked via filter in the render)
            return updated;
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, userId]);

  // Realtime for new messages in active conversation
  useEffect(() => {
    if (!isLoggedIn || !userId || !activeConv) return;

    const channel = supabase
      .channel(`messages-${activeConv.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${activeConv.id}`,
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.role === "assistant") {
          setMessages(prev => {
            // Ignore if it's the message we're currently streaming
            if (prev.find(m => m.id === streamingMsgId)) return prev;
            if (prev.find(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (document.hidden && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("Mulfai", { body: msg.content?.slice(0, 100) || "Nuevo mensaje" });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(p => {
                if (p === "granted") new Notification("Mulfai", { body: msg.content?.slice(0, 100) || "Nuevo mensaje" });
              });
            }
            setNotification("Nuevo mensaje de Mulfai");
            if (notifTimer.current) clearTimeout(notifTimer.current);
            notifTimer.current = setTimeout(() => setNotification(null), 5000);
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLoggedIn, userId, activeConv?.id]);

  useEffect(() => {
    if (isLoggedIn && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  
  function dismissOnboarding() {
    const noMostrar = (document.getElementById("no-mostrar") as HTMLInputElement)?.checked;
    if (noMostrar) localStorage.setItem("mulfai_onboarding_never", "1");
    localStorage.setItem("mulfai_onboarding_seen", "1");
    setShowOnboarding(false);
  }

  const steps = [
    {
      title: "Escribe lo que necesites",
      sub: "Puedes chatear con Mulfai como si hablaras con una persona. Pregunta lo que quieras, en cualquier tema.",
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
      preview: (
        <div className="space-y-2 mt-4">
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-2xl rounded-br-md text-xs font-medium"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
              Explícame qué es el machine learning
            </div>
          </div>
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl rounded-bl-md text-xs"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}>
              Machine learning es una rama de la IA donde...
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Adjunta imágenes",
      sub: "Envía fotos y la IA las analiza. Perfecto para diagramas, código en pantallas, o cualquier cosa visual.",
      icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      preview: (
        <div className="flex items-center gap-2 mt-4 px-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <svg className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: "var(--background)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>
            Adjunta una imagen...
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      ),
    },
    {
      title: "Modo Pensar",
      sub: "Para preguntas complejas, activa el modo 'Pensar'. La IA analiza más a fondo antes de responder.",
      icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      preview: (
        <div className="flex items-center gap-2 mt-4">
          <div className="flex-1 h-8 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
            <div className="h-full rounded-xl flex items-center gap-1.5 px-3" style={{ background: "rgba(16,163,127,0.08)" }}>
              <svg className="w-3 h-3 shrink-0" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: "var(--primary)", width: "60%" }} />
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ backgroundColor: "rgba(16,163,127,0.15)", color: "var(--primary)" }}>
            Pensar
          </span>
        </div>
      ),
    },
    {
      title: "Tu suscripción",
      sub: "Tienes un límite de mensajes semanal. Agrega tiempo desde 'Mi cuenta' cuando lo necesites.",
      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
      preview: (
        <div className="flex items-center gap-3 mt-4 px-3 py-3 rounded-xl" style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(16,163,127,0.2), rgba(16,163,127,0.05))" }}>
            <svg className="w-4 h-4" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>1 semana restante</p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Restablece cada lunes</p>
          </div>
          <button className="text-[10px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
            Añadir
          </button>
        </div>
      ),
    },
  ];

  function OnboardingStep({ step }: { step: number }) {
    const s = steps[step];
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg, rgba(16,163,127,0.15), rgba(16,163,127,0.05))" }}>
            <svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-secondary)" }}>{s.sub}</p>
          </div>
        </div>
        {s.preview}
      </div>
    );
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Keep textarea focused after sending + prevent zoom on mobile
  useEffect(() => {
    if (!sending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sending]);

  // Lock viewport height to prevent mobile browser resize on focus
  useEffect(() => {
    const lockHeight = () => {
      document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
    };
    lockHeight();
    window.addEventListener("resize", lockHeight);
    // Also lock on focus events which trigger keyboard on mobile
    const inputs = document.querySelectorAll("input, textarea");
    inputs.forEach(el => {
      el.addEventListener("focus", lockHeight);
    });
    return () => window.removeEventListener("resize", lockHeight);
  }, []);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · " +
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  function getBlockReason(): { canSend: boolean; canWrite: boolean; reason: string } {
    if (!isLoggedIn) return { canSend: false, canWrite: false, reason: "Inicia sesion para chatear" };
    if (profile && profile.status === "inactive") return { canSend: false, canWrite: false, reason: "Tu suscripcion esta inactiva" };
    const weeks = profile?.subscription_weeks ?? -1;
    if (weeks === 0) return { canSend: false, canWrite: false, reason: "Tu suscripcion ha expirado. Añade tiempo para continuar." };
    return { canSend: true, canWrite: true, reason: "" };
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("mulfai-theme", next); } catch {}
  }


  async function newConversation() {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    setActiveConv(null);
    setMessages([]);
    setShowSidebar(false);
    loadConversations();
    window.history.pushState(null, "", "/chat");
    loadSuggestions();
  }

  async function selectConv(conv: Conversation) {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    // Update updated_at in sidebar list so date label doesn't disappear
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, updated_at: new Date().toISOString() } : c));
    setActiveConv({ ...conv, updated_at: new Date().toISOString() });
    window.history.pushState(null, "", `/chat/${conv.id}`);
    setShowSidebar(false);
    await loadMessages(conv.id);
  }

  async function deleteConv(convId: string) {
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

  function compressImage(file: File, maxWidth = 1280, quality = 0.7): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality).split(",")[1]);
        };
        img.onerror = reject;
        img.src = e.target!.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const newFiles: File[] = [];
    const newUrls: Record<string, string> = { ...previewUrls };

    for (const file of files) {
      if (attachments.length + newFiles.length >= 3) break;
      if (file.size > 5 * 1024 * 1024) continue; // 5MB limit
      newFiles.push(file);
      const key = file.name + file.size;
      const url = URL.createObjectURL(file);
      newUrls[key] = url;
    }

    setAttachments(prev => [...prev, ...newFiles]);
    setPreviewUrls(newUrls);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(name: string, size: number) {
    const key = name + size;
    URL.revokeObjectURL(previewUrls[key]);
    setAttachments(prev => prev.filter(f => !(f.name === name && f.size === size)));
    setPreviewUrls(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function submitSuggestion(s: string) {
    if (sending) return;
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    setSending(true);
    setSuggestions([]);

    let conv = activeConv;
    if (!conv) {
      const now = new Date().toISOString();
      const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
      const { data } = await supabase.from("conversations").insert({ user_id: userId, title, updated_at: now, created_at: now }).select().single();
      if (data) {
        setConversations([data, ...conversations]);
        conv = data;
        setActiveConv(data);
        window.history.pushState(null, "", `/chat/${data.id}`);
      } else { setSending(false); return; }
    }

    const convId = conv!.id;
    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, role: "user", content: s, attachments: [] })
      .select().single();
    if (inserted) setMessages(prev => [...prev, inserted]);

    try {
      const reqParams = { message: s, conversationId: convId, contentParts: [], mode: responseMode };
      currentStreamReqRef.current = reqParams;

      const { data: assistantMsg } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, role: "assistant", content: "", in_progress: true })
        .select().single();

      const msgId = assistantMsg?.id || Date.now().toString();
      if (assistantMsg) setMessages(prev => [...prev, { ...assistantMsg, _loading: true, _retryReq: reqParams }]);
      else setMessages(prev => [...prev, { id: msgId, role: "assistant", content: "", created_at: new Date().toISOString(), _loading: true, _retryReq: reqParams }]);
      setStreamingMsgId(msgId);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: s, conversation_id: convId, mode: responseMode }),
      });

      if (!res.ok) {
        if (assistantMsg) supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        const result = await res.json();
        const errorCode = result.code || res.status;
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: result.error || `Error ${errorCode}. Intenta de nuevo.`, created_at: new Date().toISOString(),
        }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      const updateStreamText = async (text: string) => {
        smoothReveal(msgId, text);
        await supabase.from("messages").update({ content: text, in_progress: true }).eq("id", msgId);
      };

      const processStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines[lines.length - 1] ?? "";
            for (let i = 0; i < lines.length - 1; i++) {
              const line = lines[i];
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") continue;
                try {
                  const json = JSON.parse(data);
                  if (json.type === "chunk" && json.text) { fullText += json.text; await updateStreamText(fullText); }
                } catch {}
              }
            }
            result = await reader.read();
          }
          // Stream done: await final save and flush reveal animation
          await supabase.from("messages").upsert({ id: msgId, conversation_id: convId, content: fullText, in_progress: false });
          flushReveal(msgId, fullText);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText, _loading: false } : m));
          currentStreamReqRef.current = null;
          setSending(false);
          setStreamingMsgId(null);
          const now = new Date().toISOString();
          supabase.from("conversations").update({ updated_at: now }).eq("id", convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          setActiveConv({ ...conv!, updated_at: now });
          if (queuedMsgRef.current) {
            const q = queuedMsgRef.current as QueuedMsg;
            queuedMsgRef.current = null;
            setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
          } else {
            textareaRef.current?.focus();
          }
        } catch (_err) {
          const req = currentStreamReqRef.current;
          if (req) {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Conexion perdida. Reintentando...", _loading: true } : m));
            setTimeout(async () => {
              const res2 = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: req.message, conversation_id: req.conversationId, attachments: req.contentParts, mode: req.mode }),
              });
              if (!res2.ok) {
                const result = await res2.json();
                supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: result.error || "Error. Intenta de nuevo.", _loading: false, _retryReq: req } : m));
              } else {
                const reader2 = res2.body!.getReader();
                const decoder2 = new TextDecoder();
                let buffer2 = "";
                let fullText2 = "";
                const updateStreamText2 = async (text: string) => {
                  smoothReveal(msgId, text);
                  await supabase.from("messages").update({ content: text, in_progress: true }).eq("id", msgId);
                };
                const processStream2 = async () => {
                  try {
                    let result2 = await reader2.read();
                    while (!result2.done) {
                      buffer2 += decoder2.decode(result2.value, { stream: true });
                      const lines2 = buffer2.split("\n");
                      buffer2 = lines2[lines2.length - 1] ?? "";
                      for (let i = 0; i < lines2.length - 1; i++) {
                        const line = lines2[i];
                        if (line.startsWith("data: ")) {
                          const data = line.slice(6);
                          if (data === "[DONE]") continue;
                          try {
                            const json = JSON.parse(data);
                            if (json.type === "chunk" && json.text) { fullText2 += json.text; await updateStreamText2(fullText2); }
                          } catch {}
                        }
                      }
                      result2 = await reader2.read();
                    }
                    await supabase.from("messages").upsert({ id: msgId, conversation_id: convId, content: fullText2, in_progress: false });
                    flushReveal(msgId, fullText2);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText2, _loading: false } : m));
                    currentStreamReqRef.current = null;
                    setSending(false);
                    setStreamingMsgId(null);
                  } catch (_err) {
                    supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error. Intenta de nuevo.", _loading: false, _retryReq: req } : m));
                    currentStreamReqRef.current = null;
                    setSending(false);
                    setStreamingMsgId(null);
                  }
                };
                processStream2();
              }
            }, 1000);
          } else {
            supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo.", _loading: false } : m));
            setSending(false);
            setStreamingMsgId(null);
          }
        }
      };

      processStream();
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Error de conexion. Intenta de nuevo.", created_at: new Date().toISOString() }]);
      setSending(false);
    }
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  async function sendMessage() {
    if (!input.trim() && attachments.length === 0) return;
    const block = getBlockReason();
    if (!block.canSend) return;

    // If AI is currently streaming, queue this message (max 1)
    if (sending) {
      if (queuedMsgRef.current) return; // Already queued, ignore
      queuedMsgRef.current = { text: input.trim(), files: [...attachments], previews: { ...previewUrls } } as QueuedMsg;
      setInput("");
      setAttachments([]);
      setPreviewUrls({});
      autoResize();
      return;
    }

    let conv = activeConv;
    const queuedMsg = queuedMsgRef.current;
    queuedMsgRef.current = null;
    const userMsg = queuedMsg ? queuedMsg.text : input.trim();
    const filesToSend = queuedMsg ? queuedMsg.files : [...attachments];

    if (!conv) {
      const now = new Date().toISOString();
      const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : "");
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: userId, title, updated_at: now, created_at: now })
        .select()
        .single();
      if (data) {
        setConversations([data, ...conversations]);
        conv = data;
        setActiveConv(data);
        window.history.pushState(null, "", `/chat/${data.id}`);
      } else return;
    }

    if (!conv) return;

    setInput("");
    setAttachments([]);
    setPreviewUrls({});
    setSending(true);
    autoResize();

    const savedPreviews = queuedMsg ? queuedMsg.previews : { ...previewUrls };

    if (!conv) return;

    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: conv.id, role: "user", content: userMsg, attachments: filesToSend.map(f => f.name) })
      .select()
      .single();
    if (inserted) {
      setMessages(prev => [...prev, { ...inserted, _previewUrls: savedPreviews }]);
    }

    try {
      const convId = conv.id;

      // Build message content for API
      const contentParts: any[] = [{ type: "text", text: userMsg }];
      for (const file of filesToSend) {
        if (file.type.startsWith("image/")) {
          const base64 = await compressImage(file);
          contentParts.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } });
        }
      }

      // Create assistant message in DB (with in_progress flag so we can resume)
      const reqParams = { message: userMsg, conversationId: convId, contentParts, mode: responseMode };
      currentStreamReqRef.current = reqParams;

      const { data: assistantMsg } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, role: "assistant", content: "", in_progress: true })
        .select()
        .single();

      const msgId = assistantMsg?.id || Date.now().toString();
      if (assistantMsg) {
        setMessages(prev => [...prev, { ...assistantMsg, _loading: true, _retryReq: reqParams }]);
      } else {
        setMessages(prev => [...prev, {
          id: msgId, role: "assistant", content: "", created_at: new Date().toISOString(), _loading: true, _retryReq: reqParams
        }]);
      }
      setStreamingMsgId(msgId);

      // Send streaming request
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: convId, attachments: contentParts, mode: responseMode, message_id: msgId }),
      });

      if (!res.ok) {
        const result = await res.json();
        const errorCode = result.code || res.status;
        // Clear in_progress flag
        if (assistantMsg) {
          supabase.from("messages").update({ in_progress: false, content: result.error || `Error ${errorCode}. Intenta de nuevo.` }).eq("id", msgId);
        }
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: result.error || `Error ${errorCode}. Intenta de nuevo.`, created_at: new Date().toISOString(),
        }]);
        setSending(false);
        setStreamingMsgId(null);
        textareaRef.current?.focus();
        // Flush queued message on error too
        if (queuedMsgRef.current) {
          const q = queuedMsgRef.current as QueuedMsg;
          queuedMsgRef.current = null;
          setTimeout(() => {
            setInput(q.text);
            setAttachments(q.files);
            setPreviewUrls(q.previews);
            autoResize();
            sendMessage();
          }, 500);
        }
      } else {
        // Process streaming response
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        const updateStreamText = async (text: string) => {
          // Update both local state and DB progressively
          smoothReveal(msgId, text);
          await supabase.from("messages").update({ content: text, in_progress: true }).eq("id", msgId);
        };

        const processStream = async () => {
          try {
            let result = await reader.read();
            while (!result.done) {
              buffer += decoder.decode(result.value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines[lines.length - 1] ?? "";
              for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const json = JSON.parse(data);
                    if (json.type === "chunk" && json.text) {
                      fullText += json.text;
                      await updateStreamText(fullText);
                    }
                  } catch {}
                }
              }
              result = await reader.read();
            }
            // Stream done: await final save
            const { error: saveError } = await supabase.from("messages").upsert({
              id: msgId,
              conversation_id: convId,
              content: fullText,
              in_progress: false,
            });
            if (saveError) console.error("[Mulfai] save failed:", saveError);
            else console.log("[Mulfai] saved to DB:", msgId, "chars:", fullText.length);
            flushReveal(msgId, fullText);
            setMessages(prev => prev.map(m =>
              m.id === msgId ? { ...m, content: fullText, _loading: false } : m
            ));
            currentStreamReqRef.current = null;
            setSending(false);
            setStreamingMsgId(null);
            if (queuedMsgRef.current) {
              const q = queuedMsgRef.current as QueuedMsg;
              queuedMsgRef.current = null;
              setTimeout(() => {
                setInput(q.text);
                setAttachments(q.files);
                setPreviewUrls(q.previews);
                autoResize();
                sendMessage();
              }, 100);
            } else {
              textareaRef.current?.focus();
            }
          } catch (_err) {
            const req = currentStreamReqRef.current;
            if (req) {
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: "Conexion perdida. Reintentando...", _loading: true } : m
              ));
              setTimeout(async () => {
                const res2 = await fetch("/api/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ message: req.message, conversation_id: req.conversationId, attachments: req.contentParts, mode: req.mode }),
                });
                if (!res2.ok) {
                  const result = await res2.json();
                  setMessages(prev => prev.map(m =>
                    m.id === msgId ? { ...m, content: result.error || "Error. Intenta de nuevo.", _loading: false } : m
                  ));
                } else {
                  const reader2 = res2.body!.getReader();
                  const decoder2 = new TextDecoder();
                  let buffer2 = "";
                  let fullText2 = "";
                  const updateStreamText2 = (text: string) => {
                    smoothReveal(msgId, text);
                  };
                  const processStream2 = () => {
                    reader2.read().then(({ done, value }) => {
                      if (done) {
                        supabase.from("messages").upsert({ id: msgId, conversation_id: req.conversationId, role: "assistant", content: fullText2, in_progress: false });
                        flushReveal(msgId, fullText2);
                        setMessages(prev => prev.map(m =>
                          m.id === msgId ? { ...m, content: fullText2, _loading: false } : m
                        ));
                        currentStreamReqRef.current = null;
                        setSending(false);
                        setStreamingMsgId(null);
                        if (queuedMsgRef.current) {
                          const q = queuedMsgRef.current as QueuedMsg;
                          queuedMsgRef.current = null;
                          setTimeout(() => {
                            setInput(q.text);
                            setAttachments(q.files);
                            setPreviewUrls(q.previews);
                            autoResize();
                            sendMessage();
                          }, 100);
                        } else {
                          textareaRef.current?.focus();
                        }
                        return;
                      }
                      buffer2 += decoder2.decode(value, { stream: true });
                      const lines = buffer2.split("\n");
                      buffer2 = lines[lines.length - 1] ?? "";
                      for (let i = 0; i < lines.length - 1; i++) {
                        const line = lines[i];
                        if (line.startsWith("data: ")) {
                          const data = line.slice(6);
                          if (data === "[DONE]") continue;
                          try {
                            const json = JSON.parse(data);
                            if (json.type === "chunk" && json.text) {
                              fullText2 += json.text;
                              updateStreamText2(fullText2);
                            }
                          } catch {}
                        }
                      }
                      processStream2();
                    }).catch(() => {
                      setMessages(prev => prev.map(m =>
                        m.id === msgId ? { ...m, content: "Error. Intenta de nuevo.", _loading: false } : m
                      ));
                      currentStreamReqRef.current = null;
                      setSending(false);
                      setStreamingMsgId(null);
                    });
                  };
                  processStream2();
                }
              }, 1000);
              return;
            }
            setMessages(prev => prev.map(m =>
              m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo.", _loading: false } : m
            ));
            setSending(false);
            setStreamingMsgId(null);
          }
        };

        processStream();
      }
    } catch (_err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: "Error de conexion. Intenta de nuevo.", created_at: new Date().toISOString(),
      }]);
      setSending(false);
    }

    setSending(false);
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  const isDisabled = !isLoggedIn;

  return (
    <div className="fixed inset-0 flex" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[260px] max-sm:w-[88vw] flex flex-col md:hidden ${!isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
        style={{
          backgroundColor: "rgba(22,22,22,0.96)",
          backdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          transform: `translateX(${showSidebar ? "0" : "-100%"})`,
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
        }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              Mulfai
            </span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-1.5 rounded-md transition-colors hover:bg-white/5" style={{ color: "var(--text-tertiary)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-4 shrink-0 pb-3">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] cursor-pointer"
            style={{
              backgroundColor: "rgba(16,163,127,0.1)",
              color: "#10A37F",
              border: "1px solid rgba(16,163,127,0.15)",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(16,163,127,0.18)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,163,127,0.35)";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(16,163,127,0.1)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(16,163,127,0.15)";
            }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2">
          <div className="pb-2">
            <p className="px-2 pb-2 text-[11px] font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
              Historial
            </p>
          </div>
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Sin conversaciones</p>
            </div>
          ) : (
            <div className="space-y-0.5 pb-4">
              {conversations.map(conv => {
                const isActive = activeConv?.id === conv.id;
                const dateStr = (conv.updated_at && conv.updated_at !== conv.created_at) ? conv.updated_at : conv.created_at;
                const d = new Date(dateStr || "");
                const now = new Date();
                const isValidDate = !isNaN(d.getTime());
                const isToday = isValidDate && d.toDateString() === now.toDateString();
                const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                const isYesterday = isValidDate && d.toDateString() === yesterday.toDateString();
                const diffMs = isValidDate ? now.getTime() - d.getTime() : 0;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                const dateLabel = isValidDate
                  ? isToday ? "Hoy" : isYesterday ? "Ayer" : diffDays > 1 ? `Hace ${diffDays} días` : ""
                  : "";

                // Mobile: swipeable
                if (typeof window !== "undefined" && window.innerWidth < 768) {
                  return (
                    <div key={conv.id}>
                      <SwipeableConversation
                        conv={conv}
                        isActive={isActive}
                        dateLabel={dateLabel}
                        onSelect={() => selectConv(conv)}
                        onDelete={() => deleteConv(conv.id)}
                      />
                    </div>
                  );
                }
                // Desktop: inline hover button
                return (
                  <div key={conv.id}
                    className="group w-full text-left rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 px-3 py-3 relative"
                    onClick={() => selectConv(conv)}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: isActive ? "rgba(16,163,127,0.15)" : "rgba(255,255,255,0.04)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                        style={{ color: isActive ? "#10A37F" : "rgba(255,255,255,0.3)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight" style={{ color: isActive ? "var(--text-primary)" : "rgba(255,255,255,0.55)" }}>{conv.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{dateLabel}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                      className="shrink-0 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer"
                      style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.1)" }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.18)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.3)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(239,68,68,0.25)";
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.08)";
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(239,68,68,0.1)";
                        (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                      }}
                      title="Eliminar conversación">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-3 pb-4 pt-2 shrink-0 flex items-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          {/* User */}
          <button onClick={() => setShowAccountMenu(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all flex-1 min-w-0"
            style={{ color: "var(--text-secondary)" }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
              style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{userEmail}</span>
            {profile && (
              <div className="w-1.5 h-1.5 rounded-full ml-1 shrink-0"
                style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "#10A37F" : "#EF4444" }} />
            )}
          </button>
          {/* Actions */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={toggleTheme}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}
              title={theme === "dark" ? "Claro" : "Oscuro"}>
              {theme === "dark" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
            <button
              onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}
              title="Cerrar sesión">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" style={{ transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)", opacity: showSidebar ? 1 : 0, pointerEvents: showSidebar ? "auto" : "none" }} onClick={() => setShowSidebar(false)} />

      {/* Desktop sidebar - collapsible */}
      <div className="relative shrink-0 hidden md:block">
        {/* Collapsed: logo strip + hover area (shown when unlocked) */}
        {sidebarLock === "unlocked" && (
          <div
            className="absolute inset-y-0 left-0 z-50 flex flex-col items-center cursor-pointer group"
            onClick={() => setSidebarLock("unlocked")}
            onMouseEnter={e => { if (sidebarLock === "unlocked") setSidebarLock("unlocked"); }}
            title="Expandir sidebar (desbloqueado)"
            style={{ width: "48px" }}>
            <div className="w-full h-full flex flex-col items-center justify-center pt-6 gap-3"
              style={{ backgroundColor: "rgba(22,22,22,0.98)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all group-hover:scale-110"
                style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)", boxShadow: "0 2px 12px rgba(16,163,127,0.3)" }}>
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                style={{ color: "var(--text-tertiary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}
        <div
          className={`absolute inset-y-0 left-0 z-50 w-[260px] flex flex-col ${!isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
          style={{
            backgroundColor: "rgba(22,22,22,0.96)",
            backdropFilter: "blur(40px)",
            borderRight: "1px solid rgba(255,255,255,0.05)",
            transform: sidebarLock === "unlocked" ? "translateX(-100%)" : "translateX(0)",
            transition: "transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
            {sidebarLock !== "locked" && (
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)" }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Mulfai</span>
              </div>
            )}
            <button onClick={() => setSidebarLock(s => s === "locked" ? "unlocked" : "locked")}
              className="p-1.5 rounded-md transition-colors hover:bg-white/5 ml-auto" style={{ color: "var(--text-tertiary)" }}
              title={sidebarLock === "locked" ? "Sidebar fija (clic para desbloquear)" : "Sidebar colapsable al hacer hover"}>
              {sidebarLock === "locked" ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* New chat button */}
          {sidebarLock !== "locked" && (
            <div className="px-4 shrink-0 pb-3">
              <button onClick={newConversation}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: "rgba(16,163,127,0.1)", color: "#10A37F", border: "1px solid rgba(16,163,127,0.15)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Nuevo chat
              </button>
            </div>
          )}

          {/* Conversations */}
          {sidebarLock !== "locked" && (
            <div className="flex-1 overflow-y-auto px-2">
              <div className="pb-2">
                <p className="px-2 pb-2 text-[11px] font-medium tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>Historial</p>
              </div>
              {conversations.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>Sin conversaciones</p>
                </div>
              ) : (
                <div className="space-y-0.5 pb-4">
                  {conversations.map(conv => {
                    const isActive = activeConv?.id === conv.id;
                    const dateStr = (conv.updated_at && conv.updated_at !== conv.created_at) ? conv.updated_at : conv.created_at;
                    const d = new Date(dateStr || "");
                    const now = new Date();
                    const isValidDate = !isNaN(d.getTime());
                    const isToday = isValidDate && d.toDateString() === now.toDateString();
                    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                    const isYesterday = isValidDate && d.toDateString() === yesterday.toDateString();
                    const diffMs = isValidDate ? now.getTime() - d.getTime() : 0;
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const dateLabel = isValidDate
                      ? isToday ? "Hoy" : isYesterday ? "Ayer" : diffDays > 1 ? `Hace ${diffDays} días` : ""
                      : "";
                    return (
                      <div key={conv.id}
                        className="group w-full text-left rounded-xl flex items-center gap-3 cursor-pointer transition-all duration-200 px-3 py-3 relative"
                        onClick={() => selectConv(conv)}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.03)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                        )}
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: isActive ? "rgba(16,163,127,0.15)" : "rgba(255,255,255,0.04)" }}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                            style={{ color: isActive ? "#10A37F" : "rgba(255,255,255,0.3)" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate leading-tight" style={{ color: isActive ? "var(--text-primary)" : "rgba(255,255,255,0.55)" }}>{conv.title}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>{dateLabel}</p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                          className="shrink-0 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer"
                          style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.1)" }}
                          title="Eliminar conversación">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bottom */}
          {sidebarLock !== "locked" && (
            <div className="px-3 pb-4 pt-2 shrink-0 flex items-center" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <button onClick={() => setShowAccountMenu(true)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all flex-1 min-w-0"
                style={{ color: "var(--text-secondary)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                  style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)" }}>
                  {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
                </div>
                <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{userEmail}</span>
              </button>
              <div className="flex items-center gap-1 ml-2">
                <button onClick={toggleTheme}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}>
                  {theme === "dark" ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                  )}
                </button>
                <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                  className="p-1.5 rounded-lg transition-all"
                  style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface-hover)" }}
                  title="Cerrar sesión">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-center px-4 shrink-0 md:hidden"
          style={{
            background: "linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(28,28,28,0.99) 100%)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}>
          <button onClick={() => setShowSidebar(true)}
            className="absolute left-4 p-2 rounded-full transition-colors hover:bg-white/10" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", boxShadow: "0 2px 10px rgba(16,163,127,0.35)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--primary)" }}>M</span>ulfai
            </span>
          </div>
          {/* Subscription indicator */}
          {isLoggedIn && profile && (
            <button onClick={() => setShowAccountMenu(true)}
              className="absolute right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80"
              style={{
                backgroundColor: (profile.subscription_weeks ?? 0) > 0 || (profile.subscription_weeks ?? 0) < 0
                  ? "rgba(16,163,127,0.15)" : "rgba(239,68,68,0.15)",
                color: (profile.subscription_weeks ?? 0) > 0 || (profile.subscription_weeks ?? 0) < 0
                  ? "var(--primary)" : "var(--danger)",
              }}>
              <div className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: (profile.subscription_weeks ?? 0) > 0 || (profile.subscription_weeks ?? 0) < 0
                    ? "var(--primary)" : "var(--danger)",
                }} />
              {(profile.subscription_weeks ?? 0) < 0 ? (
                <span>Ilimitado</span>
              ) : (profile.subscription_weeks ?? 0) > 0 ? (
                <span>{profile.subscription_weeks} sem{(profile.subscription_weeks ?? 0) !== 1 ? "s" : ""}</span>
              ) : (
                <span>Expirado</span>
              )}
            </button>
          )}
        </header>

        {/* Messages */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {messages.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-full max-w-md">
                {/* Hero */}
                <div className="text-center mb-8">
                  {/* Gradient logo */}
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Mulfai</h1>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Tu asistente de IA personal
                  </p>
                </div>

                {!isLoggedIn && (
                  <div className="text-center mt-2 mb-6">
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-6 sm:px-10 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                      Iniciar sesion
                    </button>
                  </div>
                )}

                {/* Suggestions or blocked state */}
                {isLoggedIn && (
                  <div className="mt-4">
                    {(() => {
                      const block = getBlockReason();
                      if (!block.canWrite) {
                        return (
                          <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                              style={{ backgroundColor: "rgba(245,158,11,0.1)" }}>
                              <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                                style={{ color: "var(--warning)" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--warning)" }}>
                              {"Suscripcion bloqueada"}
                            </p>
                            <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                              {block.reason}
                            </p>
                            <button onClick={() => setShowAccountMenu(true)}
                              className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                              Anadir tiempo
                            </button>
                          </div>
                        );
                      }
                      if (suggestionsLoading) {
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {[0, 1, 2, 3].map(i => (
                              <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface)" }} />
                            ))}
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {suggestions.map((s, i) => (
                            <button key={i} onClick={() => submitSuggestion(s)}
                              className="text-left px-4 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2 group"
                              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ backgroundColor: "rgba(16,163,127,0.12)", color: "var(--primary)" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                              </span>
                              <span className="group-hover:text-[var(--primary)] transition-colors leading-tight">{s}</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
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
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Esta conversacion esta vacia</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4 animate-fade-in group`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2.5 mt-0.5 shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                  <div className="relative max-w-[90%] lg:max-w-[78%]">
                    {/* Sender label */}
                    <p className={`text-xs font-semibold mb-1.5 ${msg.role === "user" ? "text-right" : ""}`}
                      style={{ color: msg.role === "user" ? "rgba(255,255,255,0.6)" : "var(--text-tertiary)" }}>
                      {msg.role === "user" ? "Tú" : "Mulfai"}
                    </p>
                    <div
                      className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === "user" ? "var(--primary)" : "var(--surface)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                      }}>
                      {msg.role === "user" ? (
                        <>
                          {msg._previewUrls && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {Object.values(msg._previewUrls).map((url, i) => (
                                <img key={i} src={url} alt="adjunto"
                                  onClick={() => setLightboxUrl(url)}
                                  className="rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ width: "120px", height: "120px" }} />
                              ))}
                            </div>
                          )}
                          <p className="whitespace-pre-wrap font-medium">{msg.content}</p>
                        </>
                      ) : msg._loading || msg.id === streamingMsgId ? (
                        <div className="flex items-center gap-2 py-1 min-h-[24px]">
                          {msg.content ? (
                            <span className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)", wordBreak: "break-word" }}>
                              {msg.content}
                              <span className="typing-cursor ml-0.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              {[0, 150, 300].map((delay, i) => (
                                <span key={i} className="w-2 h-2 rounded-full animate-pulse-dot"
                                  style={{ backgroundColor: "var(--text-secondary)", animationDelay: `${delay}ms` }} />
                              ))}
                            </span>
                          )}
                        </div>
                      ) : msg.content && /^(Error|Conexion)/.test(msg.content) && !msg._retryReq ? (
                        <div className="flex items-center gap-2 py-1" style={{ color: "var(--danger)" }}>
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-sm">{msg.content}</span>
                        </div>
                      ) : (
                        <div className="prose prose-invert prose-sm max-w-none">
                          <ReactMarkdown
                            components={{
                              code({ className, children }) {
                                const match = /language-(\w+)/.exec(className || "");
                                const code = String(children).replace(/\n$/, "");
                                if (!match) {
                                  return <code className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#a5d6ff" }}>{code}</code>;
                                }
                                return (
                                  <div className="relative group rounded-xl overflow-hidden my-2" style={{ maxWidth: "100%" }}>
                                    <div className="flex items-center justify-between px-4 py-2"
                                      style={{ backgroundColor: "rgba(0,0,0,0.3)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                                      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
                                        {match[1]}
                                      </span>
                                      <button onClick={() => navigator.clipboard.writeText(code)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors"
                                        style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}>
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        Copiar
                                      </button>
                                    </div>
                                    <SyntaxHighlighter
                                      style={vscDarkPlus as any}
                                      language={match[1]}
                                      PreTag="div"
                                      customStyle={{ margin: 0, borderRadius: 0, fontSize: "13px", backgroundColor: "transparent" }}
                                    >
                                      {code}
                                    </SyntaxHighlighter>
                                  </div>
                                );
                              }
                            }}
                          >{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {/* Timestamp + copy + retry */}
                    <div className={`flex items-center gap-1.5 mt-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
                        <>
                          {!msg._loading && msg.id !== streamingMsgId && (
                            <button onClick={async () => {
                              // Find the user message right before this assistant message in local state
                              const msgs = messages;
                              const idx = msgs.findIndex(m => m.id === msg.id);
                              if (idx <= 0) return;
                              const prevMsg = msgs[idx - 1];
                              if (prevMsg.role !== "user") return;

                              // Cancel any pending reveal animation for this message
                              if (revealTimers.current[msg.id]) {
                                clearTimeout(revealTimers.current[msg.id]!);
                                revealTimers.current[msg.id] = null;
                              }
                              revealCancelled.current[msg.id] = true;
                              setDisplayedText(prev => { const n = { ...prev }; delete n[msg.id]; return n; });
                              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: "", _loading: true } : m));
                              // Clear DB message and mark in_progress for new response
                              await supabase.from("messages").update({ content: "", in_progress: true }).eq("id", msg.id);
                              const res = await fetch("/api/chat", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ message: prevMsg.content, conversation_id: activeConv?.id }),
                              });
                              if (!res.ok) {
                                const result = await res.json();
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: result.error || "Error. Intenta de nuevo.", _loading: false } : m));
                              } else {
                                const reader = res.body!.getReader();
                                const decoder = new TextDecoder();
                                let buffer = "";
                                let fullText = "";
                                const updateStream = (text: string) => {
                                  smoothReveal(msg.id, text);
                                };
                                const processStream = () => {
                                  reader.read().then(({ done, value }) => {
                                    if (done) {
                                      supabase.from("messages").upsert({
                                        id: msg.id,
                                        conversation_id: activeConv?.id,
                                        content: fullText,
                                        in_progress: false,
                                      });
                                      flushReveal(msg.id, fullText);
                                      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: fullText, _loading: false } : m));
                                      return;
                                    }
                                    buffer += decoder.decode(value, { stream: true });
                                    const lines = buffer.split("\n");
                                    buffer = lines[lines.length - 1] ?? "";
                                    for (let i = 0; i < lines.length - 1; i++) {
                                      const line = lines[i];
                                      if (line.startsWith("data: ")) {
                                        const data = line.slice(6);
                                        if (data === "[DONE]") continue;
                                        try {
                                          const json = JSON.parse(data);
                                          if (json.type === "chunk" && json.text) { fullText += json.text; updateStream(fullText); }
                                        } catch {}
                                      }
                                    }
                                    processStream();
                                  }).catch(() => {
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: "Error. Intenta de nuevo.", _loading: false } : m));
                                  });
                                };
                                processStream();
                              }
                            }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                              style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Reintentar
                            </button>
                          )}
                          <button onClick={() => copyMessage(msg.content, msg.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                            style={{ color: "var(--text-tertiary)" }}>
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
                          </>
                      )}
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              <div ref={messagesEndRef} />
          </div>
        )}
      </main>
        {/* Input area */}
        <div className="px-4 pb-4 pt-2 flex-none">
          <div className="max-w-3xl mx-auto">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {attachments.map((file, i) => {
                  const key = file.name + file.size;
                  const isImage = file.type.startsWith("image/");
                  return (
                    <div key={i} className="relative group">
                      {isImage ? (
                        <img src={previewUrls[key]} alt={file.name}
                          className="w-10 h-10 rounded-xl object-cover"
                          style={{ backgroundColor: "var(--surface)" }} />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: "var(--surface)" }}>
                          <svg className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <button onClick={() => removeAttachment(file.name, file.size)}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: "var(--danger)", color: "white" }}>
                        <svg className="w-2 h-2" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Floating input card */}
            <div className="relative">
              <div className="rounded-2xl overflow-hidden"
                style={{
                  backgroundColor: "rgba(26,26,26,0.8)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)",
                }}>

                {/* Mode selector — pill tabs */}
                <div className="flex items-center gap-1 px-4 pt-3">
                  <button onClick={() => setResponseMode("normal")}
                    className="relative px-3 py-1.5 text-xs font-medium rounded-full transition-all"
                    style={{ color: responseMode === "normal" ? "white" : "var(--text-tertiary)" }}>
                    {responseMode === "normal" && (
                      <span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", opacity: 0.15 }} />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Normal
                    </span>
                  </button>
                  <button onClick={() => setResponseMode("deep")}
                    className="relative px-3 py-1.5 text-xs font-medium rounded-full transition-all"
                    style={{ color: responseMode === "deep" ? "white" : "var(--text-tertiary)" }}>
                    {responseMode === "deep" && (
                      <span className="absolute inset-0 rounded-full" style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", opacity: 0.15 }} />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Pensar
                    </span>
                  </button>
                  <div className="flex-1 h-px mx-2" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
                  {/* Attachment */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={attachments.length >= 3 || isDisabled || sending}
                    className="shrink-0 p-1.5 rounded-full transition-all hover:bg-white/5 disabled:opacity-30"
                    style={{ color: "var(--text-tertiary)" }}
                    title="Adjuntar">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
                    onChange={handleFileSelect} className="hidden" />
                </div>

                {/* Text area */}
                <div className="flex items-end gap-2 px-3 pb-3">
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
                    placeholder={(() => {
                      const block = getBlockReason();
                      if (!isLoggedIn) return "Inicia sesion para chatear...";
                      if (!block.canWrite) return "Sin suscripcion activa...";
                      return "Escribe un mensaje...";
                    })()}
                    disabled={sending || !getBlockReason().canWrite}
                    rows={1}
                    className="flex-1 text-sm outline-none resize-none bg-transparent leading-relaxed py-1"
                    style={{ color: getBlockReason().canWrite ? "var(--text-primary)" : "var(--text-tertiary)", maxHeight: "200px" }}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={(!input.trim() && attachments.length === 0) || sending || isDisabled}
                    className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white", boxShadow: "0 2px 12px rgba(16,163,127,0.4)" }}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
        {showAuthPrompt && <AuthModal onSuccess={() => {
          setShowAuthPrompt(false);
          window.location.reload();
        }} onClose={() => setShowAuthPrompt(false)} />}
      {showAccountMenu && <AccountMenu
        email={userEmail}
        profile={profile}
        onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
        onClose={() => setShowAccountMenu(false)}
      />}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-lg flex items-center gap-2 animate-fade-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)", boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          <div className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-xs font-medium">{notification}</span>
          <button onClick={() => setNotification(null)}
            className="ml-1 p-0.5 rounded transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-tertiary)" }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)" }}
          onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 p-2.5 rounded-xl transition-colors hover:bg-white/10"
            style={{ color: "white" }}
            onClick={() => setLightboxUrl(null)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src={lightboxUrl} alt="Vista completa"
            className="rounded-2xl shadow-2xl cursor-zoom-out"
            style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain" }}
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Onboarding overlay */}
      {showOnboarding && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.85)", backdropFilter: "blur(16px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) dismissOnboarding(); }}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 25px 50px rgba(0,0,0,0.6)" }}>
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-4"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <span className="text-white font-semibold text-sm">Tour rápido de Mulfai</span>
              </div>
              <button onClick={dismissOnboarding}
                className="w-7 h-7 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 transition-colors">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step content */}
            <div id="onboarding-step" className="px-5 py-5">
              <OnboardingStep step={onboardingStep} />
            </div>

            {/* Navigation */}
            <div className="px-5 pb-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full transition-all"
                    style={{ backgroundColor: i === onboardingStep ? "var(--primary)" : "var(--border)" }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {onboardingStep > 0 ? (
                  <button onClick={() => setOnboardingStep(s => s - 1)}
                    className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
                    style={{ color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
                    ← Anterior
                  </button>
                ) : (
                  <span />
                )}
                {onboardingStep < 3 ? (
                  <button onClick={() => setOnboardingStep(s => s + 1)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                    Siguiente →
                  </button>
                ) : (
                  <button onClick={dismissOnboarding}
                    className="px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                    ¡Empezar! →
                  </button>
                )}
              </div>
            </div>

            {/* Skip + no mostrar */}
            <div className="px-5 pb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="no-mostrar"
                  className="w-4 h-4 rounded accent-[#10A37F]" />
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>No mostrar de nuevo</span>
              </label>
              <button onClick={dismissOnboarding} className="text-[11px] hover:underline" style={{ color: "var(--text-tertiary)" }}>
                Saltar tour
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type SwipeableConvProps = {
  conv: Conversation;
  isActive: boolean;
  dateLabel: string;
  onSelect: () => void;
  onDelete: () => void;
};

function SwipeableConversation({ conv, isActive, dateLabel, onSelect, onDelete }: SwipeableConvProps) {
  const [offset, setOffset] = React.useState(0);
  const [startX, setStartX] = React.useState(0);
  const [startY, setStartY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const [removed, setRemoved] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const DELETE_THRESHOLD = 70;

  function handleTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setStartX(t.clientX);
    setStartY(t.clientY);
    setDragging(true);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging) return;
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - startY);
    const dx = startX - t.clientX;
    if (dy > 12 && dy > Math.abs(dx)) return;
    setOffset(Math.max(0, Math.min(dx, 160)));
  }

  function handleTouchEnd() {
    if (!dragging) return;
    setDragging(false);
    if (offset >= DELETE_THRESHOLD) {
      setRemoved(true);
      setTimeout(() => onDelete(), 250);
    } else {
      setOffset(0);
    }
  }

  function handleClick() {
    if (offset > 5) { setOffset(0); return; }
    onSelect();
  }

  if (removed) {
    return <div className="rounded-xl mb-0.5" style={{ height: 53, transition: "height 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.2s ease-out", opacity: 0 }} />;
  }

  const progress = Math.min(offset / DELETE_THRESHOLD, 1);
  const atThreshold = offset >= DELETE_THRESHOLD;
  const actionWidth = offset + 16;

  return (
    <div className="relative mb-0.5" ref={containerRef}>
      {/* Delete action */}
      <div
        className="absolute inset-y-0 right-0 flex items-center"
        style={{ width: `${actionWidth}px`, pointerEvents: "none" }}
      >
        <div
          className="w-full h-full flex items-center justify-end pl-4 pr-3 gap-2 rounded-r-xl"
          style={{
            backgroundColor: atThreshold ? "#B91C1C" : "#DC2626",
            opacity: offset > 0 ? 1 : 0,
            transition: dragging ? "none" : "background-color 0.15s, opacity 0.15s",
            boxShadow: atThreshold ? "0 0 0 2px #EF4444, 0 0 16px rgba(239,68,68,0.5)" : "none",
            animation: atThreshold ? "pulseDelete 0.8s ease-in-out infinite" : "none",
          }}
        >
          <span
            className="text-xs font-semibold text-white"
            style={{
              opacity: atThreshold ? 1 : progress,
              transition: "opacity 0.15s",
            }}
          >
            Eliminar
          </span>
          <div
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: atThreshold ? "36px" : "32px",
              height: atThreshold ? "36px" : "32px",
              backgroundColor: atThreshold ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.2)",
              transition: "width 0.15s, height 0.15s, background-color 0.15s",
            }}
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main row */}
      <div
        className="relative flex items-center gap-2.5 px-4 py-3 cursor-pointer select-none rounded-xl"
        style={{
          backgroundColor: "#141414",
          transform: `translateX(-${offset}px)`,
          willChange: "transform",
          transition: dragging ? "none" : offset > 0 ? "transform 0.28s cubic-bezier(0.25, 0.46, 0.45, 0.94)" : "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "pan-y",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onMouseEnter={e => { if (!dragging) (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.03)"; }}
        onMouseLeave={e => {
          if (!dragging) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "#141414";
            if (offset > 0) setOffset(0);
          }
        }}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "#10A37F" }} />
        )}
        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: isActive ? "rgba(16,163,127,0.15)" : "rgba(255,255,255,0.04)" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            style={{ color: isActive ? "#10A37F" : "rgba(255,255,255,0.3)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="flex-1 text-xs font-medium truncate" style={{ color: isActive ? "var(--text-primary)" : "rgba(255,255,255,0.55)" }}>
          {conv.title}
        </p>
        <span className="text-[10px] shrink-0" style={{ color: "rgba(255,255,255,0.2)" }}>{dateLabel}</span>
      </div>
    </div>
  );
}