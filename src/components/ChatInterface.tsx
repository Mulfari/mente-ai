"use client";

import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  mode?: string;
  _isDeep?: boolean;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};


export default function ChatInterface({ userId, convIdFromUrl }: { userId: string; convIdFromUrl?: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(
    convIdFromUrl ? { id: convIdFromUrl, title: "", created_at: "", updated_at: "" } : null
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // Tracks whether a direct-URL conversation load has completed
  const [convLoaded, setConvLoaded] = useState(false);
  // Set to the conv ID when URL has one — triggers skeleton loading while loadMessages runs
  const [loadingConvId, setLoadingConvId] = useState<string | null>(convIdFromUrl || null);
  // True when actively loading messages for a real conversation (used for skeleton during message load)
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(false);
  // true when URL contains a conv ID — suppress welcome hero
  const [urlHasConv] = useState(!!convIdFromUrl);
  const [sending, setSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarLock, setSidebarLock] = useState<"locked" | "unlocked">(
    typeof window !== "undefined" ? ((localStorage.getItem("vechat-sidebar-lock") || "locked") as "locked" | "unlocked") : "locked"
  );
  const lockRef = useRef<SVGSVGElement>(null);
  const retryRef = useRef<SVGSVGElement>(null);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  // Persist sidebar lock state
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("vechat-sidebar-lock", sidebarLock);
    }
  }, [sidebarLock]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAnimId, setCopiedAnimId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [profile, setProfile] = useState<{status?: string; subscription_weeks?: number; subscription_start?: string; subscription_end?: string; used_coupon_label?: string; used_coupon_color?: string; last_message_at?: string; weekly_reset_at?: string} | null>(null);
  const [userContext, setUserContext] = useState<{full_name: string; city: string; interests: string; custom_notes: string} | null>(null);
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
  const [retryMode, setRetryMode] = useState<string | null>(null);
  const [isSendDisabled, setIsSendDisabled] = useState(false);
  const [responseMode, setResponseMode] = useState<"normal" | "deep">("normal");
  const [streamError, setStreamError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // Theme disabled - only dark mode
  void theme; void setTheme;
  const [searchQuery, setSearchQuery] = useState("");

  const [displayedText, setDisplayedText] = useState<Record<string, string>>({});
  // Typing reveal state per message
  const revealTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});
  const revealCancelled = useRef<Record<string, boolean>>({});

  function smoothReveal(msgId: string, text: string, _isDeep?: boolean) {
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
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, ...(_isDeep !== undefined ? { _isDeep } : {}) } : m));
      return;
    }

    // Reveal character by character from current position
    let charIndex = current.length;
    const tick = () => {
      if (revealCancelled.current[msgId]) return;
      charIndex++;
      const revealed = text.slice(0, charIndex);
      setDisplayedText(prev => ({ ...prev, [msgId]: revealed }));
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: revealed, ...(_isDeep !== undefined ? { _isDeep } : {}) } : m));

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

  function flushReveal(msgId: string, text: string, _isDeep?: boolean) {
    // Called when streaming ends — cancel reveal and show full text
    revealCancelled.current[msgId] = true;
    if (revealTimers.current[msgId]) {
      clearTimeout(revealTimers.current[msgId]!);
      revealTimers.current[msgId] = null;
    }
    setDisplayedText(prev => ({ ...prev, [msgId]: text }));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, ...(_isDeep !== undefined ? { _isDeep } : {}) } : m));
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
    supabase.auth.getSession().then(({ data: d }) => {
      const loggedIn = !!d.session;
      setIsLoggedIn(loggedIn);
      if (d.session?.user?.email) setUserEmail(d.session.user.email);
      if (d.session) loadConversations(d.session.user.id);
      if (d.session && d.session.user.id) {
        supabase
          .from("profiles")
          .select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at")
          .eq("id", d.session.user.id)
          .single()
          .then(({ data: p }) => { if (p) setProfile(p); });
        supabase
          .from("user_context")
          .select("full_name, city, interests, custom_notes")
          .maybeSingle()
          .then(({ data: uc }) => { if (uc) setUserContext(uc); });
        setTimeout(() => {
          const seen = localStorage.getItem("mulfai_onboarding_seen");
          const never = localStorage.getItem("mulfai_onboarding_never");
          if (!seen && !never) setShowOnboarding(true);
        }, 1500);
      }
      // Only become "mounted" (show UI) after profile is loaded
      if (loggedIn) {
          setTimeout(() => setMounted(true), 400);
        } else {
          setMounted(true);
        }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      if (session?.user?.email) setUserEmail(session.user.email);
      if (loggedIn && session?.user?.id) {
        loadConversations(session.user.id);
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
      .select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });

    supabase
      .from("user_context")
      .select("full_name, city, interests, custom_notes")
      .maybeSingle()
      .then(({ data }) => { if (data) setUserContext(data); });
  }, [userId, isLoggedIn]);

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
    setLoadingMessages(true);
    setLoadingConvId(conversationId);
    setIsLoadingMsgs(true);
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (error) console.error("loadMessages error:", error);
    // Filter out messages still actively streaming with no content.
    // If message has content (from progressive save), show it even if in_progress=true
    const valid = (data ?? []).filter(m => !(m.role === "assistant" && m.in_progress && !m.content?.trim()) && !(m.role === "assistant" && !m.in_progress && !m.content?.trim()))
      .map(m => ({ ...m, _isDeep: m.role === "assistant" && m.mode === "deep" })) as Message[];
    // Clear streaming state — these were saved from a previous session
    setStreamingMsgId(null);
    setMessages(valid);
    lastErrorRef.current = null;
    setLoadingMessages(false);
    setConvLoaded(true);
    setLoadingConvId(null);
    setIsLoadingMsgs(false);
  }

  useEffect(() => {
    loadConversations();
  }, [userId, isLoggedIn]);

  // Load initial conversation from URL (works for both /chat and /chat/[id])
  // Runs whenever isLoggedIn or userId changes, plus checks URL on mount
  useEffect(() => {
    async function loadFromUrl() {
      // Run when auth is ready (isLoggedIn) or when we have a direct URL conv ID
      if (!isLoggedIn && !convIdFromUrl) return;

      const parts = window.location.pathname.split("/").filter(Boolean);
      const urlId = parts[parts.length - 1];
      // Immediately mark that we have a conversation in the URL — suppresses hero before DB query
      // urlHasConv is derived from prop
      console.log("[VeChat] loadFromUrl url:", window.location.pathname, "urlId:", urlId);

      const effectiveId = convIdFromUrl || urlId;
      if (!effectiveId || effectiveId === "chat") {
        setActiveConv(null);
        setMessages([]);
        setConvLoaded(false);
        setLoadingConvId(null);
        return;
      }

      // Get current user from client-side auth (userId prop may be empty on server render)
      const { data: authData } = await supabase.auth.getUser();
      const currentUserId = authData?.user?.id;
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at")
        .eq("id", effectiveId)
        .eq("user_id", currentUserId)
        .single();
      console.log("[VeChat] conv result:", data?.id, "error:", error);

      if (!data || error) {
        // Conversation not found — reset to home
        setActiveConv(null);
        setMessages([]);
        return;
      }

      setActiveConv(data);
      setConversations(prev => prev.some(c => c.id === data.id) ? prev : [data, ...prev]);
      console.log("[VeChat] calling loadMessages:", data.id);
      await loadMessages(data.id);
      console.log("[VeChat] done, messages count:", messages.length);
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
            return [...prev, { ...msg, _isDeep: msg.mode === "deep" } as Message];
          });
          if (document.hidden && "Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("VeChat", { body: msg.content?.slice(0, 100) || "Nuevo mensaje" });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then(p => {
                if (p === "granted") new Notification("VeChat", { body: msg.content?.slice(0, 100) || "Nuevo mensaje" });
              });
            }
            setNotification("Nuevo mensaje de VeChat");
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
      sub: "Puedes chatear con VeChat como si hablaras con una persona. Pregunta lo que quieras, en cualquier tema.",
      icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
      preview: (
        <div className="space-y-2 mt-4">
          <div className="flex justify-end">
            <div className="px-3 py-2 rounded-2xl rounded-br-md text-xs font-medium"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
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
          <div className="flex-1 text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)", color: "var(--text-tertiary)", border: "1px solid var(--border)" }}>
            Adjunta una imagen...
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
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
          <div className="flex-1 h-8 rounded-xl overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)", border: "1px solid var(--border)" }}>
            <div className="h-full rounded-xl flex items-center gap-1.5 px-3" style={{ background: "color-mix(in srgb, var(--primary) 8%, transparent)" }}>
              <svg className="w-3 h-3 shrink-0" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div className="h-2 flex-1 rounded-full" style={{ backgroundColor: "var(--primary)", width: "60%" }} />
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)", color: "var(--primary)" }}>
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
        <div className="flex items-center gap-3 mt-4 px-3 py-3 rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)", border: "1px solid var(--border)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))" }}>
            <svg className="w-4 h-4" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>1 semana restante</p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>Restablece cada lunes</p>
          </div>
          <button className="text-[10px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
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
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--primary) 15%, transparent), color-mix(in srgb, var(--primary) 5%, transparent))" }}>
            <svg className="w-5 h-5" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{s.title}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>{s.sub}</p>
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

  

  async function newConversation() {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    setActiveConv(null);
    setMessages([]);
    setConvLoaded(false);
    setLoadingConvId(null);
    setIsLoadingMsgs(false);
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
    setConvLoaded(false);
    setLoadingConvId(conv.id);
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
    setCopiedAnimId(msgId);
    setTimeout(() => {
      setCopiedAnimId(null);
      setCopiedId(null);
    }, 2000);
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
    if (!activeConv) setConvLoaded(true);

    let conv = activeConv;
    if (!conv) {
      const now = new Date().toISOString();
      const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
      const { data } = await supabase.from("conversations").insert({ user_id: userId, title, updated_at: now, created_at: now }).select().single();
      if (data) {
        setConversations([data, ...conversations]);
        conv = data;
        setActiveConv(data);
        setConvLoaded(true);
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
      const loadingText = responseMode === "deep"
        ? "Pensando... (modo profundo, puede tardar un poco)"
        : "";
      if (assistantMsg) setMessages(prev => [...prev, { ...assistantMsg, content: loadingText, _loading: true, _retryReq: reqParams }]);
      else setMessages(prev => [...prev, { id: msgId, role: "assistant", content: loadingText, created_at: new Date().toISOString(), _loading: true, _retryReq: reqParams }]);
      setStreamingMsgId(msgId);

      // Get VPS token and connect directly to VPS for streaming
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }
      const { token: vpsToken, vpsUrl } = await tokenRes.json();

      const params = new URLSearchParams({
        token: vpsToken,
        message_id: msgId,
        conversation_id: convId,
        mode: responseMode,
        question: s,
        attachments: JSON.stringify([]),
        user_context: JSON.stringify(userContext ? { name: userContext.full_name || '', city: userContext.city || '', interests: userContext.interests || '', notes: userContext.custom_notes || '' } : null),
      });

      const streamRes = await fetch(`${vpsUrl}/api/stream?${params.toString()}`, {
        headers: { Accept: 'text/event-stream' },
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        const status = streamRes.status;
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: errData.error || `Error de conexion (${status})` }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errData.error || `Error de conexion (${status})`, created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isDeep = false;

      const updateStreamText = (text: string) => {
        setDisplayedText(prev => ({ ...prev, [msgId]: text }));
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, _isDeep: isDeep } : m));
      };

      const processVPSStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1] ?? '';
            for (const line of lines) {
              const eventMatch = line.match(/^event: (.+)/);
              const dataMatch = line.match(/^data: (.+)/);
              if (!eventMatch || !dataMatch) continue;
              let data: any;
              try { data = JSON.parse(dataMatch[1]); } catch { continue; }
              if (eventMatch[1] === 'chunk' && data.type === 'chunk') {
                isDeep = data.is_deep ?? false;
                const currentText = displayedText[msgId] || '';
                const newText = currentText + data.text;
                updateStreamText(newText);
                await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: newText, role: 'assistant', in_progress: true });
              } else if (eventMatch[1] === 'done' && data.type === 'done') {
                isDeep = data.is_deep ?? isDeep;
              } else if (eventMatch[1] === 'error') {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
                setSending(false);
                setStreamingMsgId(null);
                return;
              }
            }
            result = await reader.read();
          }
          const finalText = displayedText[msgId] || '';
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: finalText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalText, _loading: false, _isDeep: isDeep } : m));
          currentStreamReqRef.current = null;
          setSending(false);
          setStreamingMsgId(null);
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          setActiveConv({ ...conv!, updated_at: now });
          if (queuedMsgRef.current) {
            const q = queuedMsgRef.current as QueuedMsg;
            queuedMsgRef.current = null;
            setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
          } else {
            textareaRef.current?.focus();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: msg.includes('fetch') ? 'Error de conexion. Intenta de nuevo.' : msg, _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
        }
      };

      processVPSStream();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: msg.includes('fetch') ? "Error de conexion. Intenta de nuevo." : msg, created_at: new Date().toISOString() }]);
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

    // Set sending immediately to disable the button
    setSending(true);

    let conv = activeConv;
    const queuedMsg = queuedMsgRef.current;
    queuedMsgRef.current = null;
    const userMsg = queuedMsg ? queuedMsg.text : input.trim();

    // Detect research command
    const researchMatch = userMsg.match(/^(?:investiga|busca|research)\s+(.+?)\s+(?:en|sobre|about)\s+(.+)$/i);
    if (researchMatch) {
      const query = researchMatch[1].trim();
      const location = researchMatch[2].trim();
      const category = researchMatch[1].toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 20);

      setInput("");
      autoResize();

      // Add user message
      const { data: insertedUser } = await supabase
        .from("messages")
        .insert({ conversation_id: conv?.id, role: "user", content: userMsg })
        .select()
        .single();

      // Create research assistant message
      const researchMsgId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: researchMsgId, role: "assistant", content: `Buscando "${query} en ${location}"...`, created_at: new Date().toISOString(), _loading: true
      }]);

      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: `${query} en ${location}`, category }),
        });
        const data = await res.json();

        if (data.items && data.items.length > 0) {
          const resultsText = data.items.map((item: any, i: number) =>
            `${i + 1}. **${item.title}**\n   ${item.site} — ${item.snippet}`
          ).join("\n\n");

          const response = `Encontré ${data.items.length} resultados para "${query} en ${location}":\n\n${resultsText}\n\n¿Quieres que guarde estos resultados? Responde "sí" para guardarlos.`;

          setMessages(prev => prev.map(m => m.id === researchMsgId ? { ...m, content: response, _loading: false } : m));
          // Store the category for saving
          localStorage.setItem(`mulfai-research-pending-${researchMsgId}`, category);
        } else {
          setMessages(prev => prev.map(m => m.id === researchMsgId ? { ...m, content: "No encontré resultados. Prueba con otra búsqueda.", _loading: false } : m));
        }
      } catch {
        setMessages(prev => prev.map(m => m.id === researchMsgId ? { ...m, content: "Error al buscar. Intenta de nuevo.", _loading: false } : m));
      }

      setSending(false);
      return;
    }

    // Check if user wants to save pending research
    if (/^(?:si|sí|guarda|guardar|yes|confirmar)$/i.test(userMsg)) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg.content?.includes("Quieres que guarde")) {
        const pendingCat = localStorage.getItem(`mulfai-research-pending-${lastMsg.id}`);
        if (pendingCat) {
          setInput("");
          setSending(true);
          const saveMsgId = Date.now().toString();
          setMessages(prev => [...prev, {
            id: saveMsgId, role: "assistant", content: "Guardando...", created_at: new Date().toISOString()
          }]);
          try {
            const res = await fetch("/api/research", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "save", category: pendingCat }),
            });
            const data = await res.json();
            setMessages(prev => prev.map(m => m.id === saveMsgId ? { ...m, content: data.success ? `Guardado. ${data.result?.split('\n')[0] || ''}` : "Error al guardar.", _loading: false } : m));
          } catch {
            setMessages(prev => prev.map(m => m.id === saveMsgId ? { ...m, content: "Error al guardar.", _loading: false } : m));
          }
          localStorage.removeItem(`mulfai-research-pending-${lastMsg.id}`);
          setSending(false);
          return;
        }
      }
    }
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
      } else { setSending(false); return; }
    }

    if (!conv) { setSending(false); return; }

    setInput("");
    setAttachments([]);
    setPreviewUrls({});
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
      setIsLoadingMsgs(false);

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
      const loadingText = responseMode === "deep"
        ? "Pensando... (modo profundo, puede tardar un poco)"
        : "";
      if (assistantMsg) {
        setMessages(prev => [...prev, { ...assistantMsg, content: loadingText, _loading: true, _retryReq: reqParams }]);
      } else {
        setMessages(prev => [...prev, {
          id: msgId, role: "assistant", content: loadingText, created_at: new Date().toISOString(), _loading: true, _retryReq: reqParams
        }]);
      }
      setStreamingMsgId(msgId);

      // Get VPS token and connect directly to VPS for streaming
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        textareaRef.current?.focus();
        return;
      }
      const { token: vpsToken, vpsUrl } = await tokenRes.json();

      const params = new URLSearchParams({
        token: vpsToken,
        message_id: msgId,
        conversation_id: convId,
        mode: responseMode,
        question: userMsg,
        attachments: JSON.stringify(contentParts),
        user_context: JSON.stringify(userContext ? { name: userContext.full_name || '', city: userContext.city || '', interests: userContext.interests || '', notes: userContext.custom_notes || '' } : null),
      });

      const streamRes = await fetch(`${vpsUrl}/api/stream?${params.toString()}`, {
        headers: { Accept: 'text/event-stream' },
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        if (assistantMsg) supabase.from('messages').update({ in_progress: false, content: errData.error || 'Error de conexion' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errData.error || 'Error de conexion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        textareaRef.current?.focus();
        if (queuedMsgRef.current) {
          const q = queuedMsgRef.current as QueuedMsg;
          queuedMsgRef.current = null;
          setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 500);
        }
        return;
      }

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let isDeep = false;
      let contextDelta: { add_notes?: string } | null = null;

      const updateStreamText = (text: string) => {
        setDisplayedText(prev => ({ ...prev, [msgId]: text }));
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, _isDeep: isDeep } : m));
      };

      const processVPSStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1] ?? '';
            for (const line of lines) {
              const eventMatch = line.match(/^event: (.+)/);
              const dataMatch = line.match(/^data: (.+)/);
              if (!eventMatch || !dataMatch) continue;
              let data: any;
              try { data = JSON.parse(dataMatch[1]); } catch { continue; }
              if (eventMatch[1] === 'chunk' && data.type === 'chunk') {
                isDeep = data.is_deep ?? false;
                const currentText = displayedText[msgId] || '';
                const newText = currentText + data.text;
                updateStreamText(newText);
                await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: newText, role: 'assistant', in_progress: true });
              } else if (eventMatch[1] === 'done' && data.type === 'done') {
                isDeep = data.is_deep ?? isDeep;
                contextDelta = data.context_delta ?? null;
              } else if (eventMatch[1] === 'error') {
                setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
                setSending(false);
                setStreamingMsgId(null);
                return;
              }
            }
            result = await reader.read();
          }
          const finalText = displayedText[msgId] || '';
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: finalText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalText, _loading: false, _isDeep: isDeep } : m));
          setSending(false);
          setStreamingMsgId(null);
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          setActiveConv(prev => prev ? { ...prev, updated_at: now } : prev);
          if (queuedMsgRef.current) {
            const q = queuedMsgRef.current as QueuedMsg;
            queuedMsgRef.current = null;
            setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
          } else {
            textareaRef.current?.focus();
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: msg.includes('fetch') ? 'Error de conexion. Intenta de nuevo.' : msg, _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
        }
      };

      processVPSStream();
    } catch (_err) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), role: "assistant",
        content: "Error de conexion. Intenta de nuevo.", created_at: new Date().toISOString(),
      }]);
      setSending(false);
    }
  }

  const isDisabled = !isLoggedIn;

  return (
    <div className="fixed inset-0 flex" style={{ backgroundColor: "var(--background)", backgroundImage: "radial-gradient(ellipse 120% 60% at 15% 85%, rgba(16,163,127,0.35) 0%, transparent 55%), radial-gradient(ellipse 90% 50% at 85% 15%, rgba(16,163,127,0.22) 0%, transparent 50%), radial-gradient(ellipse 70% 35% at 50% 50%, rgba(255,255,255,0.07) 0%, transparent 55%)" }}>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-[300px] max-sm:w-[92vw] flex flex-col md:hidden ${!mounted || !isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
        style={{
          backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
          borderRight: "1px solid var(--border)",
          transform: `translateX(${showSidebar ? "0" : "-100%"})`,
          transition: "transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)",
          touchAction: "pan-y",
          overflowY: "auto",
          scrollbarWidth: "none",
        }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VeChat</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 rounded-xl cursor-pointer"
            style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        
        {/* Nueva conversacion + Buscador */}
        <div className="px-4 shrink-0 pb-3 space-y-2">
          <button onClick={newConversation}
            className="group w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 active:scale-[0.97]"
            style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--primary)";
              el.style.backgroundColor = "var(--surface-hover)";
              el.style.boxShadow = "0 0 12px rgba(16,163,127,0.15)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "rgba(255,255,255,0.8)";
              el.style.backgroundColor = "transparent";
              el.style.boxShadow = "none";
            }}
          >
            <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="relative" style={{ transition: "color 0.2s" }}>
              Nueva conversación
            </span>
          </button>

          {/* TODO: Re-enable agent button after /agent page is ready
          <button onClick={() => window.location.href = "/agent"}
            className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 active:scale-[0.97] hidden md:flex"
            style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--primary)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--text-tertiary)";
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="relative">
              Ir al Agente
            </span>
          </button>
          */}

          {/* Buscador */}
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
              style={{ color: "var(--text-tertiary)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar conversaciones..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
              style={{
                backgroundColor: "var(--surface-hover)",
                color: "rgba(255,255,255,0.8)",
                border: "1px solid transparent",
                outline: "none",
              }}
              onFocus={e => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.backgroundColor = "var(--surface)";
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              }}
            />
          </div>

          <button onClick={() => window.location.href = "/agent"}
            className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 active:scale-[0.97] hidden md:flex"
            style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--primary)";
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.color = "var(--text-tertiary)";
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="relative">
              Ir al Agente
            </span>
          </button>
        </div>

        <div className="px-4 pb-1 shrink-0" style={{ height: "1px", backgroundColor: "var(--border)" }} />

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-2" style={{ touchAction: "pan-y" }}>
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{searchQuery ? "Sin resultados" : "Sin conversaciones"}</p>
            </div>
          ) : (
            <div className="space-y-0.5 pb-4">
              {conversations.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => {
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
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--surface-hover)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface-hover)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                        style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight" style={{ color: "rgba(255,255,255,0.8)" }}>{conv.title}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>{dateLabel}</p>
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
        <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => setShowAccountMenu(true)}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: "transparent" }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-[private model]in-w-0 text-left">
              <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
              {profile && (
                <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                  {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
                </p>
              )}
            </div>
            {profile && (
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
            )}
          </button>
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mt-1"
            style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span className="text-xs">Cerrar sesion</span>
          </button>
        </div>
      </div>

      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" style={{ transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)", opacity: showSidebar ? 1 : 0, pointerEvents: showSidebar ? "auto" : "none" }} onClick={() => setShowSidebar(false)} />

      {/* Desktop sidebar - collapsible */}
      <div className="relative shrink-0 hidden md:block" style={{ width: sidebarLock === "locked" || sidebarHovered ? 320 : 48, transition: "width 0.35s cubic-bezier(0.32, 0.72, 0, 1)" }}>
        {/* Collapsed bar - only visible when unlocked AND collapsed */}
        {(sidebarLock === "unlocked" && !sidebarHovered) && (
          <div
            className="absolute inset-y-0 left-0 z-[51] flex flex-col items-center justify-center pt-6 gap-4 cursor-pointer group"
            onClick={() => setSidebarLock("locked")}
            onMouseEnter={() => setSidebarHovered(true)}
            style={{ width: 48, backgroundColor: "var(--surface)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 2px 12px rgba(16,163,127,0.3)" }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            {/* Unlocked icon with pulse glow */}
            <div className="relative">
              <div className="absolute inset-0 rounded-full animate-pulse" style={{ backgroundColor: "rgba(16,163,127,0.2)", filter: "blur(4px)" }} />
              <svg className="w-4 h-4 relative" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                style={{ color: "var(--primary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        )}
        <div
          className={`h-full flex flex-col ${!mounted || !isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 96%, transparent)",
            backdropFilter: "blur(40px)",
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
          onMouseEnter={() => {
            if (sidebarLock === "unlocked") setSidebarHovered(true);
          }}
          onMouseLeave={() => {
            if (sidebarLock === "unlocked") setSidebarHovered(false);
          }}
        >
          <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <span className="text-base font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VeChat</span>
              </div>
            <button onClick={() => {
                setSidebarLock(s => {
                  const next = s === "locked" ? "unlocked" : "locked";
                  try { localStorage.setItem("vechat-sidebar-lock", next); } catch {}
                  return next;
                });
                const el = lockRef.current as SVGSVGElement | null;
                if (el) {
                  el.classList.remove("icon-bounce");
                  void (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect();
                  el.classList.add("icon-bounce");
                }
              }}
              className="p-2 rounded-xl cursor-pointer"
              style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
              title={sidebarLock === "locked" ? "Sidebar fija (clic para desbloquear)" : "Sidebar colapsable al hacer hover"}
              onMouseEnter={e => {
                const svg = e.currentTarget.querySelector("svg");
                if (svg) { (svg as SVGElement).style.color = "var(--primary)"; (svg as SVGElement).style.filter = "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 60%, transparent))"; }
              }}
              onMouseLeave={e => {
                const svg = e.currentTarget.querySelector("svg");
                if (svg) { (svg as SVGElement).style.color = "var(--text-tertiary)"; (svg as SVGElement).style.filter = "none"; }
              }}>
              {sidebarLock === "locked" ? (
                <svg ref={lockRef} className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                  style={{ color: "var(--text-tertiary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              ) : (
                <svg ref={lockRef} className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                  style={{ color: "var(--text-tertiary)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              )}
            </button>
          </div>

          {/* Nueva conversacion + Buscador */}
          <div className="px-4 shrink-0 pb-2 space-y-2">
            <button onClick={newConversation}
              className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 active:scale-[0.97]"
              style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = "var(--primary)";
                el.style.backgroundColor = "var(--surface-hover)";
                el.style.boxShadow = "0 0 12px rgba(16,163,127,0.15)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = "rgba(255,255,255,0.8)";
                el.style.backgroundColor = "transparent";
                el.style.boxShadow = "none";
              }}
            >
              <svg className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90 group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="relative" style={{ transition: "color 0.2s" }}>Nueva conversación</span>
            </button>

            {/* TODO: Re-enable agent button after /agent page is ready
            <button onClick={() => window.location.href = "/agent"}
              className="group w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150 active:scale-[0.97]"
              style={{ backgroundColor: "transparent", color: "rgba(255,255,255,0.8)" }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = "var(--primary)";
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.color = "var(--text-tertiary)";
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="relative">Ir al Agente</span>
            </button>
            */}

            {/* Buscador */}
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                style={{ color: "var(--text-tertiary)" }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar conversaciones..."
                className="w-full pl-9 pr-3 py-2 rounded-xl text-xs transition-all cursor-pointer"
                style={{
                  backgroundColor: "var(--surface-hover)",
                  color: "rgba(255,255,255,0.8)",
                  border: "1px solid transparent",
                  outline: "none",
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.backgroundColor = "var(--surface)";
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = "transparent";
                  e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                }}
              />
            </div>
          </div>

          <div className="px-4 pb-1 shrink-0" style={{ height: "1px", backgroundColor: "var(--border)" }} />

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto px-2" style={{ touchAction: "pan-y" }}>
            {conversations.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{searchQuery ? "Sin resultados" : "Sin conversaciones"}</p>
              </div>
            ) : (
              <div className="space-y-0.5 pb-4">
                {conversations.filter(c => !searchQuery || c.title.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => {
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
                      onMouseEnter={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.backgroundColor = "var(--surface-hover)";
                        el.style.boxShadow = "inset 3px 0 0 var(--primary)";
                      }}
                      onMouseLeave={e => {
                        const el = e.currentTarget as HTMLDivElement;
                        el.style.backgroundColor = "transparent";
                        el.style.boxShadow = "none";
                      }}>
                      {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                      )}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface-hover)" }}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                          style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate leading-tight" style={{ color: "var(--text-primary)" }}>{conv.title}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>{dateLabel}</p>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deleteConv(conv.id); }}
                        className="shrink-0 opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 p-2 rounded-xl transition-all duration-200 flex items-center justify-center cursor-pointer"
                        style={{ color: "#EF4444", backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.1)" }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.2)";
                          (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px rgba(239,68,68,0.3)";
                          (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.1)";
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(239,68,68,0.08)";
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
          <div className="px-3 pb-4 pt-3 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => setShowAccountMenu(true)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{ backgroundColor: "transparent" }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 0 12px rgba(16,163,127,0.35)" }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex-[private model]in-w-0 text-left">
                <p className="text-sm font-medium truncate" style={{ color: "rgba(255,255,255,0.9)" }}>{userEmail}</p>
                {profile && (
                  <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {(profile.subscription_weeks ?? 0) !== 0 ? `${profile.subscription_weeks} semanas` : "Sin suscripcion"}
                  </p>
                )}
              </div>
              {profile && (
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: (profile.subscription_weeks ?? 0) !== 0 ? "var(--primary)" : "var(--danger)", boxShadow: (profile.subscription_weeks ?? 0) !== 0 ? "0 0 6px rgba(16,163,127,0.6)" : "none" }} />
              )}
            </button>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--danger)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all mt-1"
              style={{ color: "rgba(255,255,255,0.5)", backgroundColor: "transparent" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="text-xs">Cerrar sesion</span>
            </button>
          </div>
          </div>
        </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-center px-4 shrink-0 md:hidden"
          style={{
            background: "linear-gradient(180deg, rgba(38,38,38,0.98) 0%, rgba(28,28,28,0.99) 100%)",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid var(--border)",
          }}>
          <button onClick={() => setShowSidebar(true)}
            className="absolute left-4 p-2 rounded-full transition-colors" style={{ color: "rgba(255,255,255,0.8)", backgroundColor: "transparent" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--surface-hover)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", boxShadow: "0 2px 10px color-mix(in srgb, var(--primary) 35%, transparent)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--primary)" }}>M</span>ulfai
            </span>
          </div>
          {/* Subscription indicator / Login button */}
          {mounted ? (isLoggedIn && profile ? (
            <button onClick={() => setShowAccountMenu(true)}
              className="absolute right-4 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:opacity-80"
              style={{
                backgroundColor: (profile.subscription_weeks ?? 0) > 0 || (profile.subscription_weeks ?? 0) < 0
                  ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "rgba(239,68,68,0.15)",
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
          ) : (
            <button onClick={() => setShowAuthPrompt(true)}
              className="absolute right-4 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
              Iniciar sesion
            </button>
          )) : null}
        </header>

        {/* Messages */}
        <main className="flex-1 min-h-0 overflow-y-auto">
          {(isLoadingMsgs && activeConv?.id) ? (
            <div className="max-w-4xl mx-auto px-4 py-5">
              {/* Skeleton while loading direct URL conversation */}
              <div className="flex justify-end mb-4">
                <div className="rounded-2xl rounded-br-4px px-5 py-3 max-w-xs" style={{ backgroundColor: "var(--user-bubble)", animation: "pulse 1.5s ease-in-out infinite" }}>
                  <div className="h-4 rounded" style={{ backgroundColor: "color-mix(in srgb, var(--text-primary) 25%, transparent)", width: "120px" }} />
                </div>
              </div>
              <div className="flex justify-start mb-4">
                <div className="rounded-2xl rounded-bl-4px px-5 py-3 max-w-sm" style={{ backgroundColor: "var(--surface)", animation: "pulse 1.5s ease-in-out infinite 0.2s" }}>
                  <div className="h-4 rounded mb-2" style={{ backgroundColor: "var(--border)", width: "200px" }} />
                  <div className="h-4 rounded mb-2" style={{ backgroundColor: "var(--border)", width: "160px" }} />
                  <div className="h-4 rounded" style={{ backgroundColor: "var(--border)", width: "100px" }} />
                </div>
              </div>
              <div className="flex justify-end mb-4">
                <div className="rounded-2xl rounded-br-4px px-5 py-3 max-w-xs" style={{ backgroundColor: "var(--primary)", animation: "pulse 1.5s ease-in-out infinite 0.4s" }}>
                  <div className="h-4 rounded" style={{ backgroundColor: "rgba(255,255,255,0.3)", width: "80px" }} />
                </div>
              </div>
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-4px px-5 py-3 max-w-md" style={{ backgroundColor: "var(--surface)", animation: "pulse 1.5s ease-in-out infinite 0.6s" }}>
                  <div className="h-4 rounded mb-2" style={{ backgroundColor: "var(--border)", width: "240px" }} />
                  <div className="h-4 rounded" style={{ backgroundColor: "var(--border)", width: "180px" }} />
                </div>
              </div>
            </div>
          ) : (!activeConv?.id && !loadingConvId && messages.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-full px-4">
              <div className="w-full max-w-md">
                {/* Hero */}
                <div className="text-center mb-8">
                  {/* Gradient logo */}
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>VeChat</h1>
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>
                    Tu asistente de IA personal
                  </p>
                </div>

                {!isLoggedIn && (
                  <div className="text-center mt-2 mb-6">
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-6 sm:px-10 py-3 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
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
                            <p className="text-xs mb-4" style={{ color: "rgba(255,255,255,0.8)" }}>
                              {block.reason}
                            </p>
                            <button onClick={() => setShowAccountMenu(true)}
                              className="px-6 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
                              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
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
                              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "rgba(255,255,255,0.8)" }}>
                              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                style={{ backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }}>
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
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-5">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-4 animate-fade-in group`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2.5 mt-0.5 shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    </div>
                  )}
                  <div className="relative max-w-[90%] lg:max-w-[78%]">
                    {/* Sender label */}
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                        {msg.role === "user" ? "Tú" : "VeChat"}
                      </span>
                      {msg.role === "assistant" && msg._isDeep && (
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#a78bfa" }}>
                          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                          <path d="M9 18h6"/>
                          <path d="M10 21h4"/>
                        </svg>
                      )}
                    </div>
                    <div
                      className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        backgroundColor: msg.role === "user" ? "var(--user-bubble)" : "var(--surface)",
                        color: msg.role === "user" ? "white" : "var(--text-primary)",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        border: msg.role === "assistant" && msg._isDeep ? "1px solid #a78bfa" : "1px solid transparent",
                        borderLeft: msg.role === "assistant" && msg._isDeep ? "3px solid #7c3aed" : "none",
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
                      ) : (msg._loading || msg.id === streamingMsgId || retryMode === msg.id) ? (
                        <div className="flex items-center gap-2 py-1 min-h-[24px]">
                          {msg.content ? (
                            <span className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.8)", wordBreak: "break-word" }}>
                              {msg.content}
                              <span className="typing-cursor ml-0.5" />
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5">
                              <span className="typing-dot" />
                              <span className="typing-dot" />
                              <span className="typing-dot" />
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
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ className, children }) {
                                const match = /language-(\w+)/.exec(className || "");
                                const code = String(children).replace(/\n$/, "");
                                if (!match) {
                                  return <code className="px-1.5 py-0.5 rounded-md text-xs font-mono" style={{ backgroundColor: "var(--code-bg)", color: "var(--primary)" }}>{code}</code>;
                                }
                                return (
                                  <div className="relative group rounded-xl overflow-hidden my-2" style={{ maxWidth: "100%" }}>
                                    <div className="flex items-center justify-between px-4 py-2"
                                      style={{ backgroundColor: "color-mix(in srgb, var(--surface) 80%, transparent)", borderBottom: "1px solid var(--border)" }}>
                                      <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
                                        {match[1]}
                                      </span>
                                      <button onClick={() => navigator.clipboard.writeText(code)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-colors"
                                        style={{ backgroundColor: "var(--code-bg)", color: "rgba(255,255,255,0.8)" }}>
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
                              setRetryMode(msg.id);
                              // Wobble + spin animations — wait for them to play before resetting
                              const el2 = retryRef.current;
                              if (el2) {
                                el2.classList.remove("icon-wobble");
                                void (el2 as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect();
                                el2.classList.add("icon-wobble");
                              }
                              setRetryingId(null);
                              setTimeout(() => setRetryingId(msg.id), 10);
                              setTimeout(() => setRetryingId(null), 510);
                              // Wait for animations to complete before resetting
                              await new Promise(r => setTimeout(r, 550));
                              // Clear DB message and mark in_progress for new response
                              await supabase.from("messages").update({ content: "", in_progress: true }).eq("id", msg.id);
                              const res = await fetch("/api/chat", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ message: prevMsg.content, conversation_id: activeConv?.id, resume_message_id: msg.id, message_id: msg.id }),
                              });
                              if (!res.ok) {
                                const result = await res.json();
                                const errorMsg = result.error || "Error. Intenta de nuevo.";
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: errorMsg, _loading: false } : m));
                                setRetryMode(null);
                                supabase.from("messages").update({ content: errorMsg, in_progress: false }).eq("id", msg.id);
                              } else {
                                const reader = res.body!.getReader();
                                const decoder = new TextDecoder();
                                let buffer = "";
                                let fullText = "";
                                const updateStream = (text: string) => {
                                  smoothReveal(msg.id, text);
                                };
                                const processStream = async () => {
                                  try {
                                    while (true) {
                                      const { done, value } = await reader.read();
                                      if (done) break;
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
                                    }
                                    console.log("[retry] saving msg.id:", msg.id, "conv:", activeConv?.id, "content length:", fullText.length);
                                    const { data: updResult, error: updError } = await supabase.from("messages").upsert({
                                      id: msg.id,
                                      conversation_id: activeConv?.id,
                                      role: "assistant",
                                      content: fullText,
                                      in_progress: false,
                                    });
                                    console.log("[retry] upsert result:", JSON.stringify(updResult), "error:", updError);
                                    flushReveal(msg.id, fullText);
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: fullText, _loading: false } : m));
                                    setRetryMode(null);
                                  } catch (err) {
                                    console.error("[retry] stream error:", err);
                                    console.log("[retry] on error, msg.id:", msg.id, "content:", fullText.slice(0, 100));
                                    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: "Error. Intenta de nuevo.", _loading: false } : m));
                                    setRetryMode(null);
                                  }
                                };
                                processStream();
                              }
                            }}
                              className="p-1.5 rounded-lg transition-all hover:scale-110 cursor-pointer"
                              style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
                              onMouseEnter={e => {
                                const svg = e.currentTarget.querySelector("svg");
                                if (svg) { (svg as SVGElement).style.color = "var(--primary)"; (svg as SVGElement).style.filter = "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 60%, transparent))"; }
                              }}
                              onMouseLeave={e => {
                                const svg = e.currentTarget.querySelector("svg");
                                if (svg) { (svg as SVGElement).style.color = "var(--text-tertiary)"; (svg as SVGElement).style.filter = "none"; }
                              }}
                              title="Reintentar">
                              <svg
                                ref={retryRef}
                                className={`w-3.5 h-3.5 ${retryingId === msg.id ? "spin-once" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={1.5}
                                viewBox="0 0 24 24"
                                style={{ color: "var(--text-tertiary)", cursor: "pointer" }}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                            </button>
                          )}
                          <button onClick={() => copyMessage(msg.content, msg.id)}
                            className="p-1.5 rounded-lg transition-all hover:scale-110 group cursor-pointer"
                            style={{ color: copiedId === msg.id ? "var(--primary)" : "var(--text-tertiary)", backgroundColor: "transparent" }}
                            onMouseEnter={e => {
                              const svg = e.currentTarget.querySelector("svg");
                              if (svg) { (svg as SVGElement).style.color = "var(--primary)"; (svg as SVGElement).style.filter = "drop-shadow(0 0 6px color-mix(in srgb, var(--primary) 60%, transparent))"; }
                            }}
                            onMouseLeave={e => {
                              const svg = e.currentTarget.querySelector("svg");
                              if (svg) {
                                (svg as SVGElement).style.color = copiedId === msg.id ? "var(--primary)" : "var(--text-tertiary)";
                                (svg as SVGElement).style.filter = "none";
                              }
                            }}
                            title={copiedId === msg.id ? "Copiado" : "Copiar"}>
                            {copiedId === msg.id ? (
                              <svg className={`w-3.5 h-3.5 ${copiedAnimId === msg.id ? "pop-check" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--primary)", cursor: "pointer" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)", cursor: "pointer" }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                          {(() => {
                            const showFeedback = parseInt((msg as any).id?.slice(-8) || "0", 16) % 10 < 3 && !(msg as any)._feedbackGiven && (msg as any).feedback_vote == null;
                            if (!showFeedback) return null;
                            return <div className="inline-flex items-center gap-0.5">
                              <button onClick={async () => {
                                if ((msg as any)._feedbackGiven) return;
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, _feedbackGiven: true } : m));
                                const prevMsg = messages.find((m, i) => i > 0 && messages[i - 1].id === msg.id && messages[i - 1].role === "user") || messages.filter(m => m.role === "user").at(-1);
                                await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prevMsg?.content || "", response: msg.content, rating: true }) });
                                await supabase.from("messages").update({ feedback_vote: true }).eq("id", msg.id);
                                setNotification("Gracias por tu feedback");
                                if (notifTimer.current) clearTimeout(notifTimer.current);
                                notifTimer.current = setTimeout(() => setNotification(null), 2500);
                              }}
                                className="p-1 rounded transition-all cursor-pointer text-base leading-none"
                                style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#22c55e"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                                title="Util">
                                👍
                              </button>
                              <button onClick={async () => {
                                if ((msg as any)._feedbackGiven) return;
                                setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, _feedbackGiven: true } : m));
                                const prevMsg = messages.find((m, i) => i > 0 && messages[i - 1].id === msg.id && messages[i - 1].role === "user") || messages.filter(m => m.role === "user").at(-1);
                                await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: prevMsg?.content || "", response: msg.content, rating: false }) });
                                await supabase.from("messages").update({ feedback_vote: false }).eq("id", msg.id);
                                setNotification("Entendido, lo mejoraremos");
                                if (notifTimer.current) clearTimeout(notifTimer.current);
                                notifTimer.current = setTimeout(() => setNotification(null), 2500);
                              }}
                                className="p-1 rounded transition-all cursor-pointer text-base leading-none"
                                style={{ color: "var(--text-tertiary)", backgroundColor: "transparent" }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--danger)"; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
                                title="No util">
                                👎
                              </button>
                            </div>;
                          })()}
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
          <div className="max-w-4xl mx-auto">
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
                    className="relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all"
                    style={{ color: responseMode === "normal" ? "var(--primary)" : "var(--text-tertiary)" }}>
                    {responseMode === "normal" && (
                      <span className="absolute inset-0 rounded-full border" style={{ borderColor: "var(--primary)", opacity: 0.3 }} />
                    )}
                    <span className="relative flex items-center gap-1.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Normal
                    </span>
                  </button>
                  <button onClick={() => setResponseMode("deep")}
                    className="relative px-3 py-1.5 text-xs font-semibold rounded-full transition-all"
                    style={{ color: responseMode === "deep" ? "#a78bfa" : "var(--text-tertiary)" }}>
                    {responseMode === "deep" && (
                      <span className="absolute inset-0 rounded-full border" style={{ borderColor: "#a78bfa", opacity: 0.4 }} />
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
                    style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white", boxShadow: "0 2px 12px color-mix(in srgb, var(--primary) 40%, transparent)" }}>
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
        userContext={userContext}
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
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <span className="text-white font-semibold text-sm">Tour rápido de VeChat</span>
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
                    style={{ color: "rgba(255,255,255,0.8)", backgroundColor: "var(--background)" }}>
                    ← Anterior
                  </button>
                ) : (
                  <span />
                )}
                {onboardingStep < 3 ? (
                  <button onClick={() => setOnboardingStep(s => s + 1)}
                    className="px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
                    Siguiente →
                  </button>
                ) : (
                  <button onClick={dismissOnboarding}
                    className="px-5 py-2 rounded-xl text-xs font-semibold transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))", color: "white" }}>
                    ¡Empezar! →
                  </button>
                )}
              </div>
            </div>

            {/* Skip + no mostrar */}
            <div className="px-5 pb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="no-mostrar"
                  className="w-4 h-4 rounded accent-[var(--primary)]" />
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
  const rowRef = React.useRef<HTMLDivElement>(null);
  const bgRef = React.useRef<HTMLDivElement>(null);
  const stateRef = React.useRef({ startX: 0, startY: 0, isDragging: false, currentX: 0, confirming: false, gone: false });
  const DELETE_THRESHOLD = 72;
  const MAX_SWIPE = 160;

  function setSwipe(x: number) {
    const s = stateRef.current;
    s.currentX = x;
    const row = rowRef.current;
    if (row) row.style.transform = `translateX(-${x}px)`;
    const bg = bgRef.current;
    if (bg) {
      const revealW = Math.max(x, 0);
      bg.style.width = `${revealW + 32}px`;
      bg.style.opacity = x > 0 ? "1" : "0";
      const past = x >= DELETE_THRESHOLD;
      bg.style.background = past
        ? "linear-gradient(90deg, #B91C1C 0%, #DC2626 100%)"
        : "linear-gradient(90deg, #7F1D1D 0%, #DC2626 100%)";
      // Progress bar
      const bar = bg.querySelector<HTMLDivElement>(".swipe-bar");
      if (bar) bar.style.width = `${Math.min(x / DELETE_THRESHOLD, 1) * 100}%`;
      // Icon
      const iconWrap = bg.querySelector<HTMLDivElement>(".swipe-icon");
      if (iconWrap) {
        iconWrap.style.backgroundColor = past ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)";
        iconWrap.style.width = past ? "36px" : "30px";
        iconWrap.style.height = past ? "36px" : "30px";
        iconWrap.style.boxShadow = past ? "0 0 12px rgba(255,255,255,0.3)" : "none";
      }
      const svg = bg.querySelector<SVGElement>(".swipe-svg");
      if (svg) {
        svg.style.width = past ? "16px" : "14px";
        svg.style.height = past ? "16px" : "14px";
        svg.style.filter = past ? "drop-shadow(0 0 4px rgba(255,255,255,0.5))" : "none";
        svg.innerHTML = past
          ? '<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>'
          : '<path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>';
      }
      // Label
      const label = bg.querySelector<HTMLSpanElement>(".swipe-label");
      if (label) {
        const progress = Math.min(x / DELETE_THRESHOLD, 1);
        label.textContent = past ? "Eliminar" : `Desliza +${Math.round(progress * 100)}%`;
      }
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const s = stateRef.current;
    if (s.confirming || s.gone) return;
    const t = e.touches[0];
    s.startX = t.clientX;
    s.startY = t.clientY;
    s.isDragging = true;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const s = stateRef.current;
    if (!s.isDragging || s.confirming || s.gone) return;
    const t = e.touches[0];
    const dy = Math.abs(t.clientY - s.startY);
    if (dy > 10 && dy > Math.abs(s.startX - t.clientX)) return;
    const dx = s.startX - t.clientX;
    const raw = Math.min(Math.max(dx, 0), MAX_SWIPE);
    // Gentle elastic — just cap, no resistance math
    const clamped = Math.min(raw, DELETE_THRESHOLD + 12);
    setSwipe(clamped);
  }

  function handleTouchEnd() {
    const s = stateRef.current;
    if (!s.isDragging || s.confirming || s.gone) return;
    s.isDragging = false;
    if (s.currentX >= DELETE_THRESHOLD - 4) {
      // Trigger confirmation
      s.confirming = true;
      setSwipe(DELETE_THRESHOLD + 12);
      setTimeout(() => {
        s.gone = true;
        const row = rowRef.current;
        if (row) row.style.transition = "transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease-in";
        if (row) row.style.transform = "translateX(-120%)";
        if (row) row.style.opacity = "0";
        setTimeout(() => onDelete(), 350);
      }, 180);
    } else {
      // Snap back
      const row = rowRef.current;
      if (row) row.style.transition = "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)";
      setSwipe(0);
      setTimeout(() => {
        if (row) row.style.transition = "";
      }, 400);
    }
  }

  function handleClick() {
    const s = stateRef.current;
    if (s.currentX > 8 || s.confirming || s.gone) { setSwipe(0); return; }
    onSelect();
  }

  if (stateRef.current.gone) return null;

  return (
    <div className="relative mb-0.5" style={{ height: 52, overflow: "hidden" }}>
      {/* Delete background — rendered always, opacity/width controlled via DOM */}
      <div
        ref={bgRef}
        className="absolute inset-y-0 right-0 overflow-hidden rounded-xl pointer-events-none"
        style={{ width: 32, opacity: 0, willChange: "width, opacity" }}
      >
        <div
          className="h-full flex flex-col items-end justify-center rounded-r-xl"
          style={{ width: "100%", height: "100%", background: "linear-gradient(90deg, #7F1D1D 0%, #DC2626 100%)" }}
        >
          <div className="flex items-center gap-2 pr-3">
            <span className="swipe-label text-xs font-semibold" style={{ color: "white", whiteSpace: "nowrap" }}>Desliza +0%</span>
            <div className="swipe-icon flex items-center justify-center rounded-full shrink-0"
              style={{ width: 30, height: 30, backgroundColor: "rgba(255,255,255,0.12)", transition: "all 0.15s" }}>
              <svg className="swipe-svg text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"
                style={{ width: 14, height: 14 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
          </div>
          {/* Progress bar */}
          <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, overflow: "hidden" }}>
            <div className="swipe-bar" style={{ height: "100%", width: "0%", background: "rgba(255,255,255,0.35)", willChange: "width" }} />
          </div>
        </div>
      </div>

      {/* Main row — transform driven by DOM, not state */}
      <div
        ref={rowRef}
        className="relative flex items-center gap-3 px-4 cursor-pointer select-none rounded-xl"
        style={{
          height: 52,
          backgroundColor: "transparent",
          willChange: "transform",
          WebkitTapHighlightColor: "transparent",
          touchAction: "pan-y",
          zIndex: 1,
          transition: "",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onMouseEnter={e => {
          if (!stateRef.current.isDragging && stateRef.current.currentX === 0) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "var(--surface-hover)";
          }
        }}
        onMouseLeave={e => {
          if (!stateRef.current.isDragging && stateRef.current.currentX === 0) {
            (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent";
          }
          if (!stateRef.current.isDragging && stateRef.current.currentX > 0) setSwipe(0);
        }}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
        )}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: isActive ? "color-mix(in srgb, var(--primary) 15%, transparent)" : "var(--surface)" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
            style={{ color: isActive ? "var(--primary)" : "var(--text-tertiary)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="flex-1 text-sm font-medium truncate" style={{ color: isActive ? "var(--text-primary)" : "var(--text-secondary)" }}>
          {conv.title}
        </p>
        <span className="text-[11px] shrink-0" style={{ color: "var(--text-tertiary)" }}>{dateLabel}</span>
      </div>
    </div>
  );
}