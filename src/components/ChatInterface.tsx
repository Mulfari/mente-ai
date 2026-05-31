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
const MessageList = dynamic(() => import("./chat/MessageList"));
const EmptyState = dynamic(() => import("./chat/EmptyState"));
const SwipeableConversation = dynamic(() => import("./chat/SwipeableConversation"));
const ConversationSidebar = dynamic(() => import("./chat/ConversationSidebar"));
const ChatInput = dynamic(() => import("./chat/ChatInput"));

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
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
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
    revealCancelled.current[msgId] = true;

    // Show immediately — no animation, no delays. Chunks arrive as fast as
    // the model generates them and we display them instantly.
    setDisplayedText(prev => ({ ...prev, [msgId]: text }));
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text, ...(_isDeep !== undefined ? { _isDeep } : {}) } : m));
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
  const messagesChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const conversationsChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentConvIdRef = useRef<string | null>(null); // tracks active conversation ID
  const fastPollRef = useRef<ReturnType<typeof setTimeout> | null>(null); // fast polling when remote stream detected

  // Auth init — getSession returns cached session synchronously
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { setIsLoggedIn(false); setMounted(true); return; }
      setIsLoggedIn(true);
      setUserEmail(session.user.email || "");
      loadConversations(session.user.id);
      supabase.from("profiles").select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at").eq("id", session.user.id).single()
        .then(({ data: p }) => { if (p) setProfile(p); });
      supabase.from("user_context").select("full_name, city, interests, custom_notes").eq("user_id", session.user.id).maybeSingle()
        .then(({ data: uc }) => { if (uc) setUserContext(uc); });
      setMounted(true);
      const seen = localStorage.getItem("mulfai_onboarding_seen");
      const never = localStorage.getItem("mulfai_onboarding_never");
      if (!seen && !never) setTimeout(() => setShowOnboarding(true), 1500);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setIsLoggedIn(false); return; }
      setIsLoggedIn(true);
      setUserEmail(session.user.email || "");
      loadConversations(session.user.id);
      supabase.from("user_context").select("full_name, city, interests, custom_notes").eq("user_id", session.user.id).maybeSingle()
        .then(({ data: uc }) => { if (uc) setUserContext(uc); });
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load conversation from URL when userId or convIdFromUrl changes
  useEffect(() => {
    if (!userId) return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const urlId = parts[parts.length - 1];
    const effectiveId = urlId || convIdFromUrl;
    if (!effectiveId || effectiveId === "chat") return;

    supabase.from("conversations").select("id, title, created_at, updated_at")
      .eq("id", effectiveId).eq("user_id", userId).single()
      .then(({ data: conv }) => {
        if (!conv) return;
        currentConvIdRef.current = conv.id;
        setActiveConv(conv);
        setConversations(prev => prev.some(c => c.id === conv.id) ? prev : [conv, ...prev]);
        loadMessages(conv.id);
      });
  }, [userId, convIdFromUrl]);

  // Listen for popstate (browser back/forward) to reload conversation
  useEffect(() => {
    const onPop = () => {
      const parts = window.location.pathname.split("/").filter(Boolean);
      const urlId = parts[parts.length - 1];
      const effectiveId = urlId || convIdFromUrl;
      if (!effectiveId || effectiveId === "chat") {
        currentConvIdRef.current = null;
        setActiveConv(null);
        setMessages([]);
        return;
      }
      if (effectiveId === activeConv?.id) return;
      currentConvIdRef.current = effectiveId;
      loadMessages(effectiveId);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [activeConv?.id, convIdFromUrl]);

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
    if (!isLoggedIn || !userId) return;
    supabase
      .from("profiles")
      .select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });

    // Ensure user_context exists for this user (insert or update)
    supabase
      .from("user_context")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .then(({ error }) => {
        if (error) console.error("user_context update error:", error);
        // If no row to update, insert one
        if (error && error.code === "PGRST116") {
          supabase.from("user_context").insert({
            user_id: userId, full_name: "", city: "", interests: "", custom_notes: "",
          }).then(({ error: insertErr }) => {
            if (insertErr) console.error("user_context insert error:", insertErr);
          });
        }
        // Fetch the row
        supabase
          .from("user_context")
          .select("full_name, city, interests, custom_notes")
          .eq("user_id", userId)
          .maybeSingle()
          .then(({ data }) => { if (data) setUserContext(data); });
      });
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
    const loadId = conversationId; // capture for stale-check
    setMessages([]); // clear stale messages immediately
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
    // Ignore stale results (race condition: user switched conv while loading)
    if (loadId !== currentConvIdRef.current) {
      setLoadingMessages(false);
      setLoadingConvId(null);
      setIsLoadingMsgs(false);
      return;
    }
    // Filter out messages still actively streaming with no content.
    // If message has content (from progressive save), show it even if in_progress=true
    // Keep assistant messages with in_progress=true even if empty — they're active streaming from another device
    const valid = (data ?? [])
      .filter(m => !(m.role === "assistant" && !m.in_progress && !m.content?.trim()))
      .map(m => ({ ...m, _isDeep: m.role === "assistant" && m.mode === "deep" })) as Message[];
    // Clear streaming state — these were saved from a previous session
    setStreamingMsgId(null);
    setMessages(valid);
    lastErrorRef.current = null;
    setLoadingMessages(false);
    setConvLoaded(true);
    setLoadingConvId(null);
    setIsLoadingMsgs(false);

    // Setup realtime subscription for this conversation
    setupRealtimeSubscription(conversationId);
  }

  // Fetch new messages from DB and merge with local state
  async function fetchNewMessages(convId: string) {
    if (!isLoggedIn || !convId) return;
    if (convId !== currentConvIdRef.current) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (!data || convId !== currentConvIdRef.current) return;

    console.log(`[fetchNewMessages] conv=${convId} total=${data.length} msgs:`, data.map(m => ({ id: m.id.slice(0,8), role: m.role, in_progress: m.in_progress, content_len: (m.content || "").length })));

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newMsgs = data.filter(m => !existingIds.has(m.id));
      // ALWAYS preserve all existing messages — never return only new ones
      // This prevents fetchNewMessages from wiping streaming messages
      const merged = [...prev];
      for (const m of newMsgs) {
        // Don't add assistant messages that are being streamed locally
        if (m.role === "assistant" && m.id === streamingMsgId) continue;
        merged.push({ ...m, _isDeep: m.role === "assistant" && m.mode === "deep" });
      }
      // Update existing messages from DB only if they have more content
      return merged.map(m => {
        if (m.id === streamingMsgId) return m;
        const dbMsg = data.find(d => d.id === m.id);
        if (dbMsg && (dbMsg.content?.length ?? 0) > (m.content?.length ?? 0)) {
          return { ...m, content: dbMsg.content, in_progress: dbMsg.in_progress ?? m.in_progress };
        }
        return m;
      });
    });

    // Check if there's an in_progress assistant message from another device
    // → start fast polling (1s) until response is done
    const remoteStreaming = data.find(m =>
      m.role === "assistant" &&
      m.in_progress === true
    );
    if (remoteStreaming) {
      scheduleFastPoll(convId);
    }
  }

  // Stop fast polling
  function stopFastPoll() {
    if (fastPollRef.current) {
      clearTimeout(fastPollRef.current);
      fastPollRef.current = null;
    }
  }

  // Recursive fast poll — stops when in_progress becomes false
  async function fastPollOnce(convId: string) {
    if (convId !== currentConvIdRef.current) return;
    const { data } = await supabase
      .from("messages")
      .select("id, content, in_progress")
      .eq("conversation_id", convId)
      .eq("role", "assistant")
      .eq("in_progress", "false")
      .order("created_at", { ascending: false })
      .limit(1);
    // Also fetch any new messages
    const { data: allData } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    if (!allData || convId !== currentConvIdRef.current) return;

    setMessages(prev => {
      const existingIds = new Set(prev.map(m => m.id));
      const newMsgs = allData.filter(m => !existingIds.has(m.id));
      // Preserve all existing messages, only add truly new ones
      const merged = [...prev];
      for (const m of newMsgs) {
        if (m.role === "assistant" && m.id === streamingMsgId) continue;
        merged.push({ ...m, _isDeep: m.role === "assistant" && m.mode === "deep" });
      }
      return merged.map(m => {
        if (m.id === streamingMsgId) return m;
        const dbMsg = allData.find(d => d.id === m.id);
        if (dbMsg && (dbMsg.content?.length ?? 0) > (m.content?.length ?? 0)) {
          return { ...m, content: dbMsg.content, in_progress: dbMsg.in_progress ?? m.in_progress };
        }
        return m;
      });
    });

    // Continue fast polling if response still in progress
    if (convId === currentConvIdRef.current && isLoggedIn) {
      fastPollRef.current = setTimeout(() => fastPollOnce(convId), 1000);
    }
  }

  function scheduleFastPoll(convId: string) {
    stopFastPoll();
    fastPollOnce(convId);
  }

  function setupRealtimeSubscription(convId: string) {
    if (messagesChannelRef.current) {
      messagesChannelRef.current.unsubscribe();
      messagesChannelRef.current = null;
    }
    if (!convId || !isLoggedIn) return;

    stopFastPoll();
    fetchNewMessages(convId);

    // Visibility change — fetch when user comes back to the tab
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchNewMessages(convId);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopFastPoll();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }

  useEffect(() => {
    loadConversations();
  }, [userId, isLoggedIn]);

  // Load initial conversation from URL (works for both /chat and /chat/[id])
  // Runs whenever auth is ready, userId changes, OR URL changes.
// Needed because navigating from /chat/[id] to /chat via pushState
// keeps the same ChatInterface mounted, so we must re-check the URL.
  useEffect(() => {
    async function loadFromUrl() {
      // Run when auth is ready (isLoggedIn) or when we have a direct URL conv ID
      if (!isLoggedIn && !convIdFromUrl) return;

      const currentPath = window.location.pathname;

      const parts = currentPath.split("/").filter(Boolean);
      const urlId = parts[parts.length - 1];

      const effectiveId = urlId || convIdFromUrl;
      if (!effectiveId || effectiveId === "chat") {
        currentConvIdRef.current = null;
        setActiveConv(null);
        setMessages([]);
        setConvLoaded(false);
        setLoadingConvId(null);
        setStreamingMsgId(null);
        setDisplayedText({});
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

      if (!data || error) {
        // Conversation not found — reset to home
        setActiveConv(null);
        setMessages([]);
        return;
      }

      currentConvIdRef.current = data.id;
      setActiveConv(data);
      setConversations(prev => prev.some(c => c.id === data.id) ? prev : [data, ...prev]);

      // Skip loadMessages if we're already on this conversation
      // (selectConv already called loadMessages — URL effect shouldn't duplicate)
      if (activeConv?.id === data.id) return;

      await loadMessages(data.id);

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

  // Realtime subscription for conversations (stable — runs once per login)
  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    if (conversationsChannelRef.current) {
      conversationsChannelRef.current.unsubscribe();
      conversationsChannelRef.current = null;
    }

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
          setConversations(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c));
        }
      })
      .subscribe();

    conversationsChannelRef.current = channel;
    return () => { supabase.removeChannel(channel); conversationsChannelRef.current = null; };
  }, [isLoggedIn, userId]);

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
    currentConvIdRef.current = null;
    setActiveConv(null);
    setMessages([]);
    setConvLoaded(false);
    setLoadingConvId(null);
    setIsLoadingMsgs(false);
    setShowSidebar(false);
    loadConversations();
    window.history.pushState(null, "", "/");
    loadSuggestions();
  }

  async function selectConv(conv: Conversation) {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    currentConvIdRef.current = conv.id;
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
        currentConvIdRef.current = data.id;
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

      // Create assistant message row in DB NOW — before fetching token.
      // Other devices (same user, same conversation) see it immediately via Realtime INSERT.
      const msgId = crypto.randomUUID();
      await supabase
        .from("messages")
        .upsert({ id: msgId, conversation_id: convId, role: "assistant", content: "", in_progress: true })
        .eq("id", msgId);

      // Add to local state immediately so the user sees it without waiting
      setMessages(prev => [...prev, {
        id: msgId, role: "assistant", content: "", created_at: new Date().toISOString(),
        conversation_id: convId, _loading: true
      }]);
      setStreamingMsgId(msgId);

      // Now get VPS token — other devices already see the "AI thinking" message
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        await supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }
      const { token: vpsToken, vpsUrl } = await tokenRes.json();

      const userContextPayload = userContext ? { name: userContext.full_name || '', city: userContext.city || '', interests: userContext.interests || '', notes: userContext.custom_notes || '' } : null;

      // Build conversation history text - use summary + recent messages
      const historyMessages = messages.filter(m => m.role === "user" || m.role === "assistant").slice(-30);
      const recentText = historyMessages.map(m => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content || ""}`).join("\n");
      const { data: convData } = await supabase
        .from("conversations").select("summary")
        .eq("id", convId).single();
      let historyText = recentText;
      if (convData?.summary) {
        historyText = `[Resumen de conversacion anterior]\n${convData.summary}\n\n[Mensajes recientes]\n${recentText.slice(-4000)}`;
      }

      const payload = {
        token: vpsToken,
        message_id: msgId,
        conversation_id: convId,
        mode: responseMode,
        question: s,
        attachments: JSON.stringify([]),
        user_context: JSON.stringify(userContextPayload),
        conversation_history: historyText,
      };

      const streamRes = await fetch(`${vpsUrl}/api/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        const status = streamRes.status;
        await supabase.from('messages').update({ in_progress: false, content: errData.error || `Error de conexion (${status})` }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errData.error || `Error de conexion (${status})`, created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentData = '';
      let isDeep = false;
      let accumulatedText = '';

      const flushEvent = () => {
        if (!currentEvent || !currentData) return;
        let data: any;
        try { data = JSON.parse(currentData); } catch { currentEvent = ''; currentData = ''; return; }
        if (currentEvent === 'chunk' && data.type === 'chunk') {
          isDeep = data.is_deep ?? false;
          accumulatedText += data.text;
          setDisplayedText(prev => ({ ...prev, [msgId]: accumulatedText }));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _isDeep: isDeep } : m));
          supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: true });
        } else if (currentEvent === 'done' && data.type === 'done') {
          isDeep = data.is_deep ?? isDeep;
        } else if (currentEvent === 'error') {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
        }
        currentEvent = '';
        currentData = '';
      };

      const processVPSStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1] ?? '';
            for (const line of lines) {
              if (line === '') { flushEvent(); continue; }
              const eventMatch = line.match(/^event: (.+)/);
              const dataMatch = line.match(/^data: (.+)/);
              if (eventMatch) { flushEvent(); currentEvent = eventMatch[1]; }
              else if (dataMatch) { currentData = dataMatch[1]; }
            }
            result = await reader.read();
          }
          flushEvent();
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _loading: false, _isDeep: isDeep } : m));
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
    const inputVal = input.trim();
    const hasAttachments = attachments.length > 0;
    // Early returns before any async
    if (!inputVal && !hasAttachments) return;
    const block = getBlockReason();
    if (!block.canSend) return;
    // Prevent double-submit: capture sending state BEFORE any state change
    const sendingNow = sending;
    if (sendingNow) return;

    // Now set sending — this is what disables the button
    setSending(true);

    console.log("[sendMessage] input:", inputVal.length, "attachments:", hasAttachments, "activeConv:", activeConv?.id, "block:", block);

    let conv = activeConv;
    const queuedMsg = queuedMsgRef.current;
    queuedMsgRef.current = null;
    const userMsg = queuedMsg ? queuedMsg.text : inputVal;

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

    // Fetch new messages from other devices — respond after a short delay
    setTimeout(() => fetchNewMessages(conv.id), 2000);

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

      // Create assistant message row in DB NOW — before fetching token.
      // This allows other devices (same user, same conversation) to see the
      // "AI is thinking" state immediately via Supabase Realtime INSERT.
      const msgId = crypto.randomUUID();
      await supabase
        .from("messages")
        .upsert({ id: msgId, conversation_id: convId, role: "assistant", content: "", in_progress: true })
        .eq("id", msgId);

      // Add to local state immediately so the user sees it without waiting
      setMessages(prev => [...prev, {
        id: msgId, role: "assistant", content: "", created_at: new Date().toISOString(),
        conversation_id: convId, _loading: true
      }]);
      setStreamingMsgId(msgId);

      // Now get VPS token and stream — other devices already see the message
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        await supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        setMessages(prev => prev.filter(m => m.id !== msgId));
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }
      const { token: vpsToken, vpsUrl } = await tokenRes.json();

      const userContextPayload = userContext ? { name: userContext.full_name || '', city: userContext.city || '', interests: userContext.interests || '', notes: userContext.custom_notes || '' } : null;
      

      // Build conversation history text for VPS - use summary + recent messages
      const historyMessages = messages.filter(m => m.role === "user" || m.role === "assistant").slice(-30);
      const recentText = historyMessages.map(m => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content || ""}`).join("\n");
      const { data: convData } = await supabase
        .from("conversations").select("summary")
        .eq("id", convId).single();
      let historyText = recentText;
      if (convData?.summary) {
        historyText = `[Resumen de conversacion anterior]\n${convData.summary}\n\n[Mensajes recientes]\n${recentText.slice(-4000)}`;
      }

      const payload = {
        token: vpsToken,
        message_id: msgId,
        conversation_id: convId,
        mode: responseMode,
        question: userMsg,
        attachments: contentParts,
        user_context: userContextPayload,
        conversation_history: historyText,
      };

      const streamRes = await fetch(`${vpsUrl}/api/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify(payload),
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        await supabase.from('messages').update({ in_progress: false, content: errData.error || 'Error de conexion' }).eq('id', msgId);
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
      let currentEvent = '';
      let currentData = '';
      let isDeep = false;
      let accumulatedText = '';
      let contextDelta: { add_notes?: string } | null = null;

      const flushEvent = () => {
        if (!currentEvent || !currentData) return;
        let data: any;
        try { data = JSON.parse(currentData); } catch { currentEvent = ''; currentData = ''; return; }
        if (currentEvent === 'chunk' && data.type === 'chunk') {
          isDeep = data.is_deep ?? false;
          accumulatedText += data.text;
          setDisplayedText(prev => ({ ...prev, [msgId]: accumulatedText }));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _isDeep: isDeep } : m));
          supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: true });
        } else if (currentEvent === 'done' && data.type === 'done') {
          isDeep = data.is_deep ?? isDeep;
          contextDelta = data.context_delta ?? null;
        } else if (currentEvent === 'error') {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
        }
        currentEvent = '';
        currentData = '';
      };

      const processVPSStream = async () => {
        try {
          let result = await reader.read();
          while (!result.done) {
            buffer += decoder.decode(result.value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines[lines.length - 1] ?? '';
            for (const line of lines) {
              if (line === '') { flushEvent(); continue; }
              const eventMatch = line.match(/^event: (.+)/);
              const dataMatch = line.match(/^data: (.+)/);
              if (eventMatch) { flushEvent(); currentEvent = eventMatch[1]; }
              else if (dataMatch) { currentData = dataMatch[1]; }
            }
            result = await reader.read();
          }
          flushEvent();
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _loading: false, _isDeep: isDeep } : m));
          setSending(false);
          setStreamingMsgId(null);
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          setActiveConv(prev => prev ? { ...prev, updated_at: now } : prev);
          // Update user context with notes from the AI
          if (contextDelta?.add_notes && userContext) {
            const existing = userContext.custom_notes || '';
            const newNote = contextDelta.add_notes.trim();
            if (newNote && !existing.includes(newNote)) {
              const updated = existing ? `${existing}. ${newNote}` : newNote;
              supabase.from('user_context').update({ custom_notes: updated }).eq('user_id', userId);
              setUserContext(prev => prev ? { ...prev, custom_notes: updated } : prev);
            }
          }
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
      <ConversationSidebar
        showSidebar={showSidebar}
        conversations={conversations}
        activeConv={activeConv}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        userEmail={userEmail}
        profile={profile}
        supabase={supabase}
        onSelectConv={selectConv}
        onDeleteConv={deleteConv}
        onNewConversation={newConversation}
        onShowAccountMenu={() => setShowAccountMenu(true)}
        onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
        onCloseSidebar={() => setShowSidebar(false)}
      />
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" style={{ transition: "opacity 0.3s cubic-bezier(0.32, 0.72, 0, 1)", opacity: showSidebar ? 1 : 0, pointerEvents: showSidebar ? "auto" : "none" }} onClick={() => setShowSidebar(false)} />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
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
            <span className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>VeChat</span>
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
        <main className="flex-1 overflow-y-auto py-6">
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
            <EmptyState
              isLoggedIn={isLoggedIn}
              suggestions={suggestions}
              suggestionsLoading={suggestionsLoading}
              getBlockReason={getBlockReason}
              submitSuggestion={submitSuggestion}
              onShowAuthPrompt={() => setShowAuthPrompt(true)}
              onShowAccountMenu={() => setShowAccountMenu(true)}
            />
          ) : (<MessageList
              messages={messages}
              streamingMsgId={streamingMsgId}
              retryMode={retryMode}
              formatTime={formatTime}
            />
          )}
        </main>
      </div>

      {/* Input area */}
      <div className="w-full flex-none flex justify-center pb-4 pt-2">
        <ChatInput
              input={input}
              setInput={setInput}
              sending={sending}
              attachments={attachments}
              previewUrls={previewUrls}
              responseMode={responseMode}
              setResponseMode={setResponseMode}
              getBlockReason={getBlockReason}
              isLoggedIn={isLoggedIn}
              onSend={sendMessage}
              onFileSelect={(files) => handleFileSelect({ target: { files } } as any)}
              onRemoveAttachment={removeAttachment}
            />
      </div>
      {showAuthPrompt && <AuthModal onSuccess={() => {
          setShowAuthPrompt(false);
          window.location.reload();
        }} onClose={() => setShowAuthPrompt(false)} />}
      {showAccountMenu && (
        <AccountMenu
          email={userEmail}
          profile={profile}
          userContext={userContext}
          userId={userId}
          onSave={(data) => { setUserContext(prev => prev ? { ...prev, ...data } : prev); }}
          onSignOut={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
          onClose={() => setShowAccountMenu(false)}
        />
      )}
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

