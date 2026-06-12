"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClerk, useAuth } from "@clerk/nextjs";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AccountMenu from "./AccountMenu";
import MessageList from "./chat/MessageList";
import EmptyState from "./chat/EmptyState";
import ConversationSidebar from "./chat/ConversationSidebar";
import ChatInput from "./chat/ChatInput";
import { OnboardingTour } from "./OnboardingTour";
import type { PublicFeed } from "@/lib/feed";

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

export default function ChatInterface({
  userId,
  convIdFromUrl,
  initialIsLoggedIn = false,
  initialUserEmail = "",
  initialFullName = null,
  initialProfile = null,
}: {
  userId: string;
  convIdFromUrl?: string;
  initialIsLoggedIn?: boolean;
  initialUserEmail?: string;
  initialFullName?: string | null;
  initialProfile?: {
    status?: string;
    subscription_weeks?: number;
    subscription_start?: string;
    subscription_end?: string;
    used_coupon_label?: string;
    used_coupon_color?: string;
    last_message_at?: string;
    weekly_reset_at?: string;
  } | null;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  // false hasta que la primera carga del historial resuelve — el sidebar
  // muestra skeleton mientras tanto (evita el flash de "sin conversaciones").
  const [convsLoaded, setConvsLoaded] = useState(false);
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
  const [convJustStarted, setConvJustStarted] = useState(false);
  // True desde que la primera pregunta despega hasta que existe la
  // conversación: EmptyState desvanece hero/feed (el input queda visible
  // esperando su vuelo al dock inferior).
  const [leavingEmpty, setLeavingEmpty] = useState(false);
  // FLIP del input: top de la pastilla centrada capturado justo antes de
  // crear la conversación; el efecto de abajo mide la posición final y anima.
  const inputFlipFromRef = useRef<number | null>(null);
  const bottomInputRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<SVGSVGElement>(null);

  // Reset convJustStarted after animation completes
  useEffect(() => {
    if (convJustStarted) {
      const timer = setTimeout(() => {
        setConvJustStarted(false);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [convJustStarted]);

  // Captura la posición de la pastilla del input centrado (EmptyState)
  // ANTES del await que crea la conversación — después ya no existe.
  function captureInputTakeoff() {
    const pill = document.querySelector("[data-chat-input-pill]");
    if (pill) inputFlipFromRef.current = pill.getBoundingClientRect().top;
    setLeavingEmpty(true);
  }

  // Vuelo del input centro → dock inferior (FLIP). Corre en el commit en
  // que la conversación nueva monta el input de abajo: medimos dónde quedó,
  // lo arrancamos desde donde estaba y lo soltamos con un ease suave.
  useLayoutEffect(() => {
    if (!activeConv?.id) return;
    const fromTop = inputFlipFromRef.current;
    if (fromTop === null) return;
    inputFlipFromRef.current = null;
    setLeavingEmpty(false);
    const el = bottomInputRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pill = el.querySelector("[data-chat-input-pill]");
    const toTop = (pill ?? el).getBoundingClientRect().top;
    const dy = fromTop - toTop;
    if (Math.abs(dy) < 8) return;
    const anim = el.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" }
    );
    // Al aterrizar, devolver el foco al textarea (solo desktop — en móvil
    // levantaría el teclado sin que el usuario lo pida).
    anim.finished
      .then(() => {
        if (window.innerWidth >= 768) {
          el.querySelector("textarea")?.focus();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id]);

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAnimId, setCopiedAnimId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(initialIsLoggedIn);
  const [isLoggedIn, setIsLoggedIn] = useState(initialIsLoggedIn);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState(initialUserEmail);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  // Clerk hooks
  const { signOut: clerkSignOut, openSignIn, openSignUp } = useClerk();
  const { isSignedIn } = useAuth();

  // Deslogueado: cualquier intento de interactuar guarda la pregunta (si la
  // hay) y abre el MODAL de registro de Clerk encima del chat — el visitante
  // no pierde la página ni su pregunta. Al autenticarse (modal u OAuth) la
  // home recarga y la pregunta pendiente se envía sola.
  const requireSignIn = useCallback((pendingPrompt?: string) => {
    try {
      const q = (pendingPrompt ?? "").trim();
      if (q) localStorage.setItem("vechat-pending-question", q);
    } catch { /* storage bloqueado — el registro sigue valiendo */ }
    openSignUp({ forceRedirectUrl: "/", signInForceRedirectUrl: "/" });
  }, [openSignUp]);

  // El modal de auth no navega: con email/contraseña la sesión nace
  // client-side y el SDK hace router.refresh() — la prop initialIsLoggedIn
  // llega true del server pero TODOS los useState sembrados con ella
  // conservan el valor de visitante, así que la UI se queda deslogueada.
  // Por eso la condición es contra el ESTADO de la UI (isLoggedIn), no
  // contra la prop: UI de visitante + sesión de Clerk = recargar para que
  // el server resuelva el perfil y la pregunta pendiente se envíe sola.
  // El OAuth (Google) no pasa por aquí: recarga al volver del redirect.
  useEffect(() => {
    if (isLoggedIn || !isSignedIn) {
      if (isLoggedIn) {
        try { sessionStorage.removeItem("vechat-auth-reloaded"); } catch {}
      }
      return;
    }
    try {
      // Guard anti-loop: si tras recargar el server SIGUE sin ver la sesión
      // (cookies rotas), no recargamos infinito — una sola vez por sesión.
      if (sessionStorage.getItem("vechat-auth-reloaded") === "1") return;
      sessionStorage.setItem("vechat-auth-reloaded", "1");
    } catch { /* sin sessionStorage igual recargamos una vez */ }
    window.location.reload();
  }, [isSignedIn, isLoggedIn]);
  const [profile, setProfile] = useState<{status?: string; subscription_weeks?: number; subscription_start?: string; subscription_end?: string; used_coupon_label?: string; used_coupon_color?: string; last_message_at?: string; weekly_reset_at?: string} | null>(initialProfile);
  const [userContext, setUserContext] = useState<{full_name: string; city: string; interests: string; custom_notes: string} | null>(
    initialFullName ? { full_name: initialFullName, city: "", interests: "", custom_notes: "" } : null
  );
  const [attachments, setAttachments] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Feed de tendencias compartido (mismo para deslogueado y logueado).
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [retryMode, setRetryMode] = useState<string | null>(null);
  const [isSendDisabled, setIsSendDisabled] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  // Theme disabled - only dark mode
  void theme; void setTheme;

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
  // Controls the in-flight VPS stream request. ChatInput's Stop button calls
  // `stopStream()` which invokes `controller.abort()` — the fetch's signal
  // propagates down to the reader's `read()` promise, the catch in
  // `processVPSStream` distinguishes the AbortError from a network error,
  // and we mark the message as `in_progress: false` with a "(detenido)" tag
  // so other devices see the partial response immediately.
  const streamAbortRef = useRef<AbortController | null>(null);
  // Identidad del stream activo. Cada envío incrementa la secuencia y captura
  // su valor; al abandonar la conversación (nuevo chat / cambiar de chat) se
  // incrementa SIN abortar: el stream viejo sigue persistiendo su respuesta a
  // la DB en background, pero sus callbacks de fin/error ya no tocan el estado
  // global de UI (sending, streamingMsgId), que pertenece al contexto nuevo.
  // Sin esto, "Nuevo chat" a mitad de una respuesta heredaba sending=true y
  // dejaba el input deshabilitado hasta que el stream invisible terminara.
  const streamSeqRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Throttle the per-chunk Supabase upsert — a long stream fires hundreds of
  // upserts otherwise. We coalesce to at most one per UPSERT_THROTTLE_MS.
  const UPSERT_THROTTLE_MS = 300;
  const lastUpsertAtRef = useRef(0);
  const pendingUpsertRef = useRef<{ id: string; conversation_id: string; content: string; in_progress: boolean } | null>(null);
  const upsertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const initialScrollPendingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const lastErrorRef = useRef<{ message: string; conversationId: string | null; attachments: any[] } | null>(null);
  const convSyncCleanupRef = useRef<(() => void) | null>(null); // desmonta el sync (fast poll + visibilidad) de la conversación anterior
  const currentConvIdRef = useRef<string | null>(null); // tracks active conversation ID
  const loadingConvRef = useRef<string | null>(null); // dedup: skip concurrent loadMessages() for the same conv
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // reveal-on-load timer (must survive effect re-runs)
  const fastPollRef = useRef<ReturnType<typeof setTimeout> | null>(null); // fast polling when remote stream detected

  // Auth init — if the server already provided the auth state (via initial
  // props), trust it and skip the getSession() round-trip. Calling
  // getSession() unconditionally caused a brief "isLoggedIn → false" flash
  // when the client-side Supabase client hadn't finished restoring the
  // session from cookies yet (common on first paint after a hard reload).
  useEffect(() => {
    if (initialIsLoggedIn && userId) {
      // Server says we're logged in. Re-fetch profile + userContext to
      // pick up any changes since SSR, but do NOT touch isLoggedIn /
      // userEmail — they were already seeded from the server.
      loadConversations(userId);
      supabase.from("profiles").select("status, subscription_weeks, subscription_start, subscription_end, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at").eq("id", userId).maybeSingle()
        .then(({ data: p }) => { if (p) setProfile(p); });
      supabase.from("user_context").select("full_name, city, interests, custom_notes").eq("user_id", userId).maybeSingle()
        .then(({ data: uc }) => { if (uc) setUserContext(uc); });
      // Pregunta pendiente de la home pública: el visitante la escribió antes
      // de registrarse. Si la cuenta puede chatear, se envía sola; si está
      // bloqueada (0 semanas), queda puesta en el input para cuando active.
      const pending = localStorage.getItem("vechat-pending-question");
      if (pending) {
        localStorage.removeItem("vechat-pending-question");
        const weeks = initialProfile?.subscription_weeks ?? 0;
        const canSendPending = initialProfile?.status !== "inactive" && weeks !== 0;
        if (canSendPending) {
          // typeAndSubmit: la pregunta se teclea sola en el input y despega.
          setTimeout(() => typeAndSubmit(pending, { source: "typed" }), 600);
        } else {
          setInput(pending);
        }
      } else {
        const seenV2 = localStorage.getItem("mulfai_tour_v2_seen");
        if (!seenV2) setTimeout(() => setShowOnboarding(true), 300);
      }
    } else if (!initialIsLoggedIn) {
      // With Clerk, if the server says we're logged out, we are. Clerk's
      // middleware handles the post-sign-in redirect. Nothing to re-check.
      setMounted(true);
    }
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

  // Feed de tendencias compartido — un solo endpoint para toda la app.
  // Silencioso ante fallos (el componente muestra skeleton). Se refresca al
  // cambiar de conversación para que el empty state esté al día.
  function loadFeed() {
    fetch("/api/feed")
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setFeed(d); })
      .catch(() => {});
  }
  useEffect(() => {
    loadFeed();
  }, [activeConv?.id]);

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
    // Marcar como cargado incluso en error: mejor lista vacía que skeleton eterno.
    setConvsLoaded(true);
    if (!data) return;
    // Filter out empty "Nueva conversación" placeholders (never had a message)
    const filtered = data.filter((c: any) => {
      const msgs = c.messages as any[];
      return (msgs && msgs.length > 0 && (msgs[0]?.count ?? 0) > 0) || c.title !== "Nueva conversación";
    });
    setConversations(filtered);
  }

  async function loadMessages(conversationId: string) {
    // Dedup: two useEffects (URL-load + auth-ready) can both fire on initial
    // mount for the same conv. Without this guard the second call would clear
    // the first's pending scroll-reveal timer via effect cleanup, leaving the
    // conversation stuck at the top.
    if (loadingConvRef.current === conversationId) return;
    loadingConvRef.current = conversationId;
    const loadId = conversationId; // capture for stale-check
    // Skeleton takes over the screen while we load (controlled by
    // isLoadingMsgs in the JSX) — no need to blank the messages array,
    // which caused a visual flash and double-firing of the scroll effect.
    setLoadingMessages(true);
    setLoadingConvId(conversationId);
    setIsLoadingMsgs(true);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) console.error("loadMessages error:", error);
      // Ignore stale results (race condition: user switched conv while loading)
      if (loadId !== currentConvIdRef.current) return;
      // Filter out messages still actively streaming with no content.
      // If message has content (from progressive save), show it even if in_progress=true
      // Keep assistant messages with in_progress=true even if empty — they're active streaming from another device
      const valid = (data ?? [])
        .filter(m => !(m.role === "assistant" && !m.in_progress && !m.content?.trim()))
        .map(m => ({ ...m, _isDeep: m.role === "assistant" && m.mode === "deep" })) as Message[];
      // Clear streaming state — these were saved from a previous session
      setStreamingMsgId(null);
      // Reveal-on-load: scroll-to-top → wait → smooth-scroll-to-bottom.
      // (Previously gated on `length > 4`, which left short convs stuck
      // near the top. Now triggered for any conversation with history.)
      if (valid.length > 0) initialScrollPendingRef.current = true;
      setMessages(valid);
      lastErrorRef.current = null;
      setLoadingMessages(false);
      setConvLoaded(true);
      setLoadingConvId(null);
      setIsLoadingMsgs(false);

      // Setup polling/visibility sync for this conversation
      setupConversationSync(conversationId);
    } finally {
      loadingConvRef.current = null;
    }
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

  // Sync multi-dispositivo por polling: fetch inicial + fast poll si hay un
  // stream remoto en curso + re-fetch al volver a la pestaña. (Antes había
  // además un canal de Supabase Realtime, pero nunca llegó a funcionar en
  // producción y el polling cubre el caso — se eliminó.)
  function setupConversationSync(convId: string) {
    // Desmonta el sync de la conversación anterior — sin esto el listener
    // de visibilitychange se acumula con cada conversación cargada.
    convSyncCleanupRef.current?.();
    convSyncCleanupRef.current = null;
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

    convSyncCleanupRef.current = () => {
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

      // userId is the internal profile UUID resolved server-side —
      // conversations.user_id references it, NOT the Clerk user id.
      const currentUserId = userId;
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

  // Browser tab title — "VeChat" by default, "VeChat - <title>" once the
  // user is inside a conversation. Truncated at 50 chars so long titles
  // don't blow up the tab. Falls back to "Conversacion" if the title is
  // empty (defensive — shouldn't happen).
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!activeConv) {
      document.title = "VeChat";
      return;
    }
    const raw = activeConv.title?.trim() || "Conversacion";
    const trimmed = raw.length > 50 ? raw.slice(0, 50) + "…" : raw;
    document.title = `VeChat - ${trimmed}`;
  }, [activeConv?.id, activeConv?.title]);

  useEffect(() => {
    if (isLoggedIn && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [isLoggedIn]);

  
  function dismissOnboarding() {
    setShowOnboarding(false);
  }

  // Onboarding tour steps are now defined in <OnboardingTour /> component.

  // Smart auto-scroll: only scroll if the user is near the bottom of the
  // conversation. If they've scrolled up to read something, we don't yank
  // them back down when a new response arrives.
  //
  // On initial load of a conversation (initialScrollPendingRef = true set
  // inside loadMessages), do a "reveal" instead of jumping straight to
  // the bottom: show the top of the conversation first, then after a
  // short delay smoothly slide down to the latest message. The delay
  // gives the user a moment to register the start of the thread before
  // the scroll takes them to the end.
  //
  // The reveal timer is held in a ref (not in this effect's local scope)
  // because setupConversationSync → fetchNewMessages fires a second
  // messages-state update right after loadMessages, which re-runs this
  // effect. If the timer lived in this effect's closure, the first run's
  // cleanup would clear it before it ever fires. The ref outlives every
  // re-run of this effect; only a new reveal or a conv change cancels it.
  useLayoutEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const force = initialScrollPendingRef.current;
    if (force) initialScrollPendingRef.current = false;
    if (!force) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      const NEAR_BOTTOM_PX = 120;
      if (distanceFromBottom > NEAR_BOTTOM_PX) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      return;
    }
    // Forced initial scroll: show top → wait → slide to bottom.
    // Skip the reveal when the content already fits in the viewport
    // (no scroll distance to animate over — the top IS the bottom).
    const fitsViewport = el.scrollHeight <= el.clientHeight;
    if (fitsViewport) {
      el.scrollTop = 0;
      return;
    }
    // 1) Show the top of the conversation immediately.
    el.scrollTop = 0;
    // 2) Wait briefly so the user registers the start of the thread.
    // 3) Smooth-scroll to the bottom. The browser's smooth-scroll
    //    re-measures scrollHeight each frame, so late layout
    //    (markdown tables, syntax-highlighted code, images) is fine.
    // Cancel any in-flight reveal from a previous conv load.
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      revealTimerRef.current = null;
    }, 600);
  }, [messages, sending]);

  // Cancel any pending reveal when the user navigates to a different conv.
  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        clearTimeout(revealTimerRef.current);
        revealTimerRef.current = null;
      }
    };
  }, [activeConv?.id]);

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
    // Deslogueado: escribir está permitido — al enviar, la pregunta se guarda
    // y el flujo sigue en /sign-up (ver requireSignIn).
    if (!isLoggedIn) return { canSend: true, canWrite: true, reason: "" };
    if (profile && profile.status === "inactive") return { canSend: false, canWrite: false, reason: "Tu suscripcion esta inactiva" };
    const weeks = profile?.subscription_weeks ?? -1;
    if (weeks === 0) return { canSend: false, canWrite: false, reason: "Tu suscripcion ha expirado. Añade tiempo para continuar." };
    return { canSend: true, canWrite: true, reason: "" };
  }

  

  // Suelta el lock de UI del stream en curso sin abortarlo: la respuesta
  // sigue guardándose en su conversación vieja (diseño multi-dispositivo),
  // pero el input del contexto nuevo queda libre de inmediato.
  function orphanActiveStream() {
    streamSeqRef.current++;
    setSending(false);
    setStreamingMsgId(null);
  }

  async function newConversation() {
    if (!isLoggedIn) { requireSignIn(); return; }
    orphanActiveStream();
    currentConvIdRef.current = null;
    setActiveConv(null);
    setMessages([]);
    setConvLoaded(false);
    setLoadingConvId(null);
    setIsLoadingMsgs(false);
    setShowSidebar(false);
    loadConversations();
    window.history.pushState(null, "", "/");
  }

  async function selectConv(conv: Conversation) {
    if (!isLoggedIn) { requireSignIn(); return; }
    orphanActiveStream();
    currentConvIdRef.current = conv.id;
    // OJO: NO tocar updated_at aquí — solo abrir una conversación no debe
    // moverla al grupo "Hoy" del sidebar; eso pasa al enviar un mensaje.
    setActiveConv(conv);
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
      // Reset completo: si la URL apuntaba a la conversación borrada,
      // volver a la home para que un reload no caiga en un 404 lógico.
      currentConvIdRef.current = null;
      setActiveConv(null);
      setMessages([]);
      setConvLoaded(false);
      window.history.pushState(null, "", "/");
    }
  }

  async function renameConv(convId: string, title: string) {
    const trimmed = title.trim().slice(0, 80);
    if (!trimmed) return;
    // Optimista: actualizar la UI primero, persistir después.
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, title: trimmed } : c));
    if (activeConv?.id === convId) {
      setActiveConv(prev => prev ? { ...prev, title: trimmed } : prev);
    }
    await supabase.from("conversations").update({ title: trimmed }).eq("id", convId);
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

  // "Se escribe solo": al tocar una tarjeta del feed (o al volver del
  // registro con una pregunta pendiente), el texto se teclea en el input
  // centrado y la pregunta despega sola — así el usuario ve qué se va a
  // preguntar en vez de que la conversación arranque de la nada.
  const typeAnimRef = useRef(0);
  function typeAndSubmit(
    s: string,
    meta?: { categoryId?: string; subOptionId?: string; source?: "discover" | "typed" }
  ) {
    if (sending) return;
    // Deslogueado o cuenta bloqueada: mismos caminos que el envío directo
    // (registro / menú de cuenta) — ahí no hay nada que teclear.
    if (!isLoggedIn || !getBlockReason().canSend) {
      submitSuggestion(s, meta);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      submitSuggestion(s, meta);
      return;
    }
    const anim = ++typeAnimRef.current;
    // ~22ms por carácter, acotado a 280-650ms — rápido pero legible.
    const total = Math.min(650, Math.max(280, s.length * 22));
    const t0 = performance.now();
    setInput("");
    const step = (now: number) => {
      if (typeAnimRef.current !== anim) return; // cancelada: el usuario escribió o tocó otra tarjeta
      const p = Math.min(1, (now - t0) / total);
      setInput(s.slice(0, Math.max(1, Math.round(p * s.length))));
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        // Pausa breve para que se lea completa, después despega.
        setTimeout(() => {
          if (typeAnimRef.current !== anim) return;
          setInput("");
          submitSuggestion(s, meta);
        }, 200);
      }
    };
    requestAnimationFrame(step);
  }

  // setInput para escritura humana: invalida cualquier tecleo automático en
  // curso para no pelear con el teclado del usuario.
  const setInputFromUser = useCallback((v: string) => {
    typeAnimRef.current++;
    setInput(v);
  }, []);

  async function submitSuggestion(
    s: string,
    meta?: { categoryId?: string; subOptionId?: string; source?: "discover" | "typed" }
  ) {
    if (sending) return;
    if (!isLoggedIn) { requireSignIn(s); return; }
    // Cuenta bloqueada (0 semanas): en vez de fallar en el servidor, abrir
    // el menú de cuenta donde está el botón de añadir tiempo.
    if (!getBlockReason().canSend) {
      setInput(s);
      setShowAccountMenu(true);
      return;
    }
    setSending(true);
    const myStream = ++streamSeqRef.current;
    if (!activeConv) setConvLoaded(true);

    // Fire-and-forget trending tracking. Silent on failure — never block the
    // user flow on the tracking request.
    fetch("/api/track-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: meta?.categoryId ?? null,
        subOptionId: meta?.subOptionId ?? null,
        source: meta?.source ?? "discover",
        prompt: s,
      }),
    }).catch(() => {});

    let conv = activeConv;
    if (!conv) {
      captureInputTakeoff();
      const now = new Date().toISOString();
      const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
      const { data } = await supabase.from("conversations").insert({ user_id: userId, title, updated_at: now, created_at: now }).select().single();
      if (data) {
        currentConvIdRef.current = data.id;
        setConversations([data, ...conversations]);
        conv = data;
        setActiveConv(data);
        setConvJustStarted(true);
        setConvLoaded(true);
        window.history.pushState(null, "", `/chat/${data.id}`);
      } else { setLeavingEmpty(false); setSending(false); return; }
    }

    const convId = conv!.id;
    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, role: "user", content: s, attachments: [] })
      .select().single();
    if (inserted) setMessages(prev => [...prev, inserted]);

    try {
      const reqParams = { message: s, conversationId: convId, contentParts: [], mode: "deep" };
      currentStreamReqRef.current = reqParams;

      // Create assistant message row in DB NOW — before fetching token.
      // Other devices (same user, same conversation) pick it up via the
      // polling sync (fetchNewMessages) and start fast-polling while in_progress.
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
      // Install a fresh AbortController for this stream — ChatInput's Stop
      // button will call .abort() on it. Replaces any prior handle.
      streamAbortRef.current = new AbortController();

      // Now get VPS token — other devices already see the "AI thinking" message
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        await supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        if (streamSeqRef.current === myStream) {
          setMessages(prev => prev.filter(m => m.id !== msgId));
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
          setSending(false);
          setStreamingMsgId(null);
        }
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
        mode: "deep",
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
        signal: streamAbortRef.current?.signal,
      });

      if (!streamRes.ok) {
        const errData = await streamRes.json().catch(() => ({}));
        const status = streamRes.status;
        await supabase.from('messages').update({ in_progress: false, content: errData.error || `Error de conexion (${status})` }).eq('id', msgId);
        if (streamSeqRef.current === myStream) {
          setMessages(prev => prev.filter(m => m.id !== msgId));
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: errData.error || `Error de conexion (${status})`, created_at: new Date().toISOString() }]);
          setSending(false);
          setStreamingMsgId(null);
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

      // Throttled per-chunk upsert: at most one Supabase write per UPSERT_THROTTLE_MS.
      // The pending row always reflects the most recent state, so a delayed write
      // never overwrites a newer one.
      const scheduleChunkUpsert = (content: string) => {
        pendingUpsertRef.current = { id: msgId, conversation_id: convId, content, in_progress: true };
        const now = Date.now();
        const elapsed = now - lastUpsertAtRef.current;
        if (elapsed >= UPSERT_THROTTLE_MS) {
          lastUpsertAtRef.current = now;
          const p = pendingUpsertRef.current;
          pendingUpsertRef.current = null;
          if (upsertTimerRef.current) { clearTimeout(upsertTimerRef.current); upsertTimerRef.current = null; }
          supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: true });
        } else if (!upsertTimerRef.current) {
          upsertTimerRef.current = setTimeout(() => {
            upsertTimerRef.current = null;
            const p = pendingUpsertRef.current;
            if (!p) return;
            pendingUpsertRef.current = null;
            lastUpsertAtRef.current = Date.now();
            supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: true });
          }, UPSERT_THROTTLE_MS - elapsed);
        }
      };

      const flushChunkUpsert = () => {
        if (upsertTimerRef.current) { clearTimeout(upsertTimerRef.current); upsertTimerRef.current = null; }
        const p = pendingUpsertRef.current;
        if (!p) return;
        pendingUpsertRef.current = null;
        lastUpsertAtRef.current = Date.now();
        supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: p.content.length > 0 });
      };

      const flushEvent = () => {
        if (!currentEvent || !currentData) return;
        let data: any;
        try { data = JSON.parse(currentData); } catch { currentEvent = ''; currentData = ''; return; }
        if (currentEvent === 'chunk' && data.type === 'chunk') {
          isDeep = data.is_deep ?? false;
          accumulatedText += data.text;
          setDisplayedText(prev => ({ ...prev, [msgId]: accumulatedText }));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _isDeep: isDeep } : m));
          scheduleChunkUpsert(accumulatedText);
        } else if (currentEvent === 'done' && data.type === 'done') {
          isDeep = data.is_deep ?? isDeep;
        } else if (currentEvent === 'error') {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
          }
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
          flushChunkUpsert();
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _loading: false, _isDeep: isDeep } : m));
          currentStreamReqRef.current = null;
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
          // Solo si este stream sigue siendo el activo: si quedó huérfano
          // (el usuario se fue a otro chat) no toca el estado global de UI
          // ni regresa la vista a esta conversación.
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
            setActiveConv({ ...conv!, updated_at: now });
            if (queuedMsgRef.current) {
              const q = queuedMsgRef.current as QueuedMsg;
              queuedMsgRef.current = null;
              setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
            } else {
              textareaRef.current?.focus();
            }
          }
        } catch (e) {
          // AbortError = the user clicked Stop. Treat as a clean cancellation:
          // keep whatever the model already streamed, mark the message as
          // finished (in_progress=false) with a small visual marker, and
          // persist the partial content to Supabase so other devices see it.
          const isAbort = e instanceof DOMException && e.name === "AbortError";
          const finalContent = isAbort
            ? (accumulatedText ? `${accumulatedText}\n\n_[Generación detenida]_` : "_[Generación detenida]_")
            : (e instanceof Error ? e.message : String(e));
          const finalDisplay = isAbort
            ? finalContent
            : (finalContent.includes('fetch') ? 'Error de conexion. Intenta de nuevo.' : finalContent);
          try {
            await supabase.from('messages').upsert({
              id: msgId,
              conversation_id: convId,
              content: finalContent,
              role: 'assistant',
              in_progress: false,
            });
          } catch {}
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalDisplay, _loading: false } : m));
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
            textareaRef.current?.focus();
          }
        } finally {
          // Solo el stream dueño libera el handle: si quedó huérfano y otro
          // stream ya instaló su propio AbortController, no se lo pisamos
          // (romperíamos el botón Stop del stream nuevo).
          if (streamSeqRef.current === myStream) {
            streamAbortRef.current = null;
          }
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

  // Stop the in-flight stream when the user clicks Stop in ChatInput. The
  // AbortController's signal is wired into both the stream fetch and the
  // reader's `read()` promise, so the catch in processVPSStream fires
  // almost immediately and we mark the message as finished with a
  // "(detenido)" tag.
  const stopStream = useCallback(() => {
    if (streamAbortRef.current) {
      streamAbortRef.current.abort();
      // Don't null the ref here — the processVPSStream's `finally` block
      // is the single source of truth for releasing the handle, so the
      // abort + cleanup happen in a deterministic order.
    }
  }, []);

  async function sendMessage() {
    const inputVal = input.trim();
    const hasAttachments = attachments.length > 0;
    // Early returns before any async
    if (!inputVal && !hasAttachments) return;
    // Deslogueado: guardar la pregunta y mandar a crear cuenta — tras el
    // registro se envía sola (ver el efecto de vechat-pending-question).
    if (!isLoggedIn) { requireSignIn(inputVal); return; }
    const block = getBlockReason();
    if (!block.canSend) { setShowAccountMenu(true); return; }
    // Prevent double-submit: capture sending state BEFORE any state change
    const sendingNow = sending;
    if (sendingNow) return;

    // Now set sending — this is what disables the button
    setSending(true);
    const myStream = ++streamSeqRef.current;

    console.log("[sendMessage] input:", inputVal.length, "attachments:", hasAttachments, "activeConv:", activeConv?.id, "block:", block);

    let conv = activeConv;
    const queuedMsg = queuedMsgRef.current;
    queuedMsgRef.current = null;
    const userMsg = queuedMsg ? queuedMsg.text : inputVal;

    // Fire-and-forget trending tracking for typed/free-form prompts. The
    // trending API filters these out (no sub_option_id), but we keep the
    // rows for future personalization and analytics.
    fetch("/api/track-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: null,
        subOptionId: null,
        source: "typed",
        prompt: userMsg,
      }),
    }).catch(() => {});

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
      captureInputTakeoff();
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
        // Marca esta conversación como la activa para los polls/fetches
        // (submitSuggestion ya lo hacía; aquí faltaba).
        currentConvIdRef.current = data.id;
        setActiveConv(data);
        setConvJustStarted(true);
        window.history.pushState(null, "", `/chat/${data.id}`);
      } else { setLeavingEmpty(false); setSending(false); return; }
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
      // "AI is thinking" state via the polling sync (fetchNewMessages).
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
      // Install a fresh AbortController for this stream — ChatInput's Stop
      // button will call .abort() on it. Replaces any prior handle.
      streamAbortRef.current = new AbortController();

      // Now get VPS token and stream — other devices already see the message
      const tokenRes = await fetch('/api/auth/vps-token', { method: 'POST' });
      if (!tokenRes.ok) {
        const err = await tokenRes.json();
        await supabase.from('messages').update({ in_progress: false, content: err.error || 'Error de auth' }).eq('id', msgId);
        if (streamSeqRef.current === myStream) {
          setMessages(prev => prev.filter(m => m.id !== msgId));
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: err.error || 'Error de autenticacion', created_at: new Date().toISOString() }]);
          setSending(false);
          setStreamingMsgId(null);
        }
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
        mode: "deep",
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
        if (streamSeqRef.current === myStream) {
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

      // Throttled per-chunk upsert: at most one Supabase write per UPSERT_THROTTLE_MS.
      // The pending row always reflects the most recent state, so a delayed write
      // never overwrites a newer one.
      const scheduleChunkUpsert = (content: string) => {
        pendingUpsertRef.current = { id: msgId, conversation_id: convId, content, in_progress: true };
        const now = Date.now();
        const elapsed = now - lastUpsertAtRef.current;
        if (elapsed >= UPSERT_THROTTLE_MS) {
          lastUpsertAtRef.current = now;
          const p = pendingUpsertRef.current;
          pendingUpsertRef.current = null;
          if (upsertTimerRef.current) { clearTimeout(upsertTimerRef.current); upsertTimerRef.current = null; }
          supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: true });
        } else if (!upsertTimerRef.current) {
          upsertTimerRef.current = setTimeout(() => {
            upsertTimerRef.current = null;
            const p = pendingUpsertRef.current;
            if (!p) return;
            pendingUpsertRef.current = null;
            lastUpsertAtRef.current = Date.now();
            supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: true });
          }, UPSERT_THROTTLE_MS - elapsed);
        }
      };

      const flushChunkUpsert = () => {
        if (upsertTimerRef.current) { clearTimeout(upsertTimerRef.current); upsertTimerRef.current = null; }
        const p = pendingUpsertRef.current;
        if (!p) return;
        pendingUpsertRef.current = null;
        lastUpsertAtRef.current = Date.now();
        supabase.from('messages').upsert({ id: p.id, conversation_id: p.conversation_id, content: p.content, role: 'assistant', in_progress: p.content.length > 0 });
      };

      const flushEvent = () => {
        if (!currentEvent || !currentData) return;
        let data: any;
        try { data = JSON.parse(currentData); } catch { currentEvent = ''; currentData = ''; return; }
        if (currentEvent === 'chunk' && data.type === 'chunk') {
          isDeep = data.is_deep ?? false;
          accumulatedText += data.text;
          setDisplayedText(prev => ({ ...prev, [msgId]: accumulatedText }));
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _isDeep: isDeep } : m));
          scheduleChunkUpsert(accumulatedText);
        } else if (currentEvent === 'done' && data.type === 'done') {
          isDeep = data.is_deep ?? isDeep;
          contextDelta = data.context_delta ?? null;
        } else if (currentEvent === 'error') {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: data.message || 'Error', _loading: false } : m));
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
          }
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
          flushChunkUpsert();
          await supabase.from('messages').upsert({ id: msgId, conversation_id: convId, content: accumulatedText, role: 'assistant', in_progress: false });
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: accumulatedText, _loading: false, _isDeep: isDeep } : m));
          const now = new Date().toISOString();
          supabase.from('conversations').update({ updated_at: now }).eq('id', convId);
          setConversations(prev => prev.map(c => c.id === convId ? { ...c, updated_at: now } : c));
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
          // Solo si este stream sigue siendo el activo (no quedó huérfano por
          // un "Nuevo chat" o cambio de conversación) toca el estado de UI.
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
            setActiveConv(prev => prev ? { ...prev, updated_at: now } : prev);
            if (queuedMsgRef.current) {
              const q = queuedMsgRef.current as QueuedMsg;
              queuedMsgRef.current = null;
              setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
            } else {
              textareaRef.current?.focus();
            }
          }
        } catch (e) {
          // AbortError = the user clicked Stop. Treat as a clean cancellation:
          // keep whatever the model already streamed, mark the message as
          // finished (in_progress=false) with a small visual marker, and
          // persist the partial content to Supabase so other devices see it.
          const isAbort = e instanceof DOMException && e.name === "AbortError";
          const finalContent = isAbort
            ? (accumulatedText ? `${accumulatedText}\n\n_[Generación detenida]_` : "_[Generación detenida]_")
            : (e instanceof Error ? e.message : String(e));
          const finalDisplay = isAbort
            ? finalContent
            : (finalContent.includes('fetch') ? 'Error de conexion. Intenta de nuevo.' : finalContent);
          try {
            await supabase.from('messages').upsert({
              id: msgId,
              conversation_id: convId,
              content: finalContent,
              role: 'assistant',
              in_progress: false,
            });
          } catch {}
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: finalDisplay, _loading: false } : m));
          if (streamSeqRef.current === myStream) {
            setSending(false);
            setStreamingMsgId(null);
            // Re-focus the textarea so the user can immediately type a follow-up.
            textareaRef.current?.focus();
          }
        } finally {
          // Solo el stream dueño libera el handle: si quedó huérfano y otro
          // stream ya instaló su propio AbortController, no se lo pisamos
          // (romperíamos el botón Stop del stream nuevo).
          if (streamSeqRef.current === myStream) {
            streamAbortRef.current = null;
          }
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
    <div
      className="fixed top-0 left-0 right-0 flex bg-transparent"
      style={{ height: "calc(var(--vh, 1vh) * 100)" }}
    >
      {/* Chat root. Height comes from the --vh CSS variable (synced by
          the ViewportHeight client component) so the container shrinks
          with the on-screen keyboard instead of staying at the
          pre-keyboard height. */}
      {/* Sidebar — solo con sesión; el visitante ve el chat limpio */}
      {isLoggedIn && (
        <ConversationSidebar
          conversations={conversations}
          activeConv={activeConv}
          userEmail={userEmail}
          profile={profile}
          onSelectConv={selectConv}
          onDeleteConv={deleteConv}
          onRenameConv={renameConv}
          conversationsLoaded={convsLoaded}
          onNewConversation={newConversation}
          onShowAccountMenu={() => setShowAccountMenu(true)}
          showMobile={showSidebar}
          onCloseMobile={() => setShowSidebar(false)}
          disabled={isDisabled}
        />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {isLoggedIn ? (
          /* Top bar — mobile only (md:hidden). Hamburger left, wordmark
             centered, account chip right. */
          <header className="h-14 flex items-center justify-between px-4 shrink-0 md:hidden"
            style={{
              backgroundColor: "color-mix(in srgb, var(--surface) 92%, transparent)",
              backdropFilter: "blur(20px)",
              borderBottom: "1px solid var(--border)",
            }}>
            <button onClick={() => setShowSidebar(true)}
              aria-label="Abrir menu"
              className="p-2 rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-secondary)" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>VeChat</span>
            {mounted && userEmail ? (
              <button onClick={() => setShowAccountMenu(true)}
                aria-label="Cuenta"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white cursor-pointer transition-opacity hover:opacity-80"
                style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
                {userEmail.charAt(0).toUpperCase()}
              </button>
            ) : (
              <div className="w-8 h-8" />
            )}
          </header>
        ) : (
          /* Header público (deslogueado, todos los tamaños): marca + CTAs */
          <header className="h-14 flex items-center justify-between px-5 sm:px-7 shrink-0">
            <span className="text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--primary)" }}>V</span> VeChat
            </span>
            <div className="flex items-center gap-2.5">
              {/* Modales de Clerk en vez de navegar: el visitante no pierde
                  el feed ni lo que tenga escrito en el input. */}
              <button
                onClick={() => openSignIn({ forceRedirectUrl: "/", signUpForceRedirectUrl: "/" })}
                className="text-[13px] px-3 py-2 rounded-full cursor-pointer transition-colors hover:bg-[var(--surface-hover)]"
                style={{ color: "var(--text-secondary)" }}>
                Iniciar sesión
              </button>
              <button
                onClick={() => openSignUp({ forceRedirectUrl: "/", signInForceRedirectUrl: "/" })}
                className="text-[13px] font-medium text-white px-4 py-2 rounded-full cursor-pointer transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--primary)" }}>
                Crear cuenta
              </button>
            </div>
          </header>
        )}

        {/* Messages. OJO #1: sin máscara de fade inferior — el desvanecido
            de 48px "comía" el final del contenido contra el fondo.
            OJO #2: en la home (empty state) main NO lleva padding inferior:
            con py-6, el EmptyState (h-full + overflow-hidden) terminaba
            24px ANTES del borde de la página — el feed se recortaba ahí
            (tarjetas cortadas con el borde visible) y quedaba una franja
            de fondo pegada al borde inferior. */}
        <main ref={mainScrollRef} className={`flex-1 overflow-y-auto ${!activeConv?.id && !loadingConvId && messages.length === 0 ? "pt-6 flex flex-col" : "py-6"}`}>
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
              userName={userContext?.full_name}
              isLoggedIn={isLoggedIn}
              feed={feed}
              leaving={leavingEmpty}
              getBlockReason={getBlockReason}
              submitSuggestion={typeAndSubmit}
              input={input}
              setInput={setInputFromUser}
              sending={sending}
              attachments={attachments}
              previewUrls={previewUrls}
              onSend={sendMessage}
              onFileSelect={(files) => handleFileSelect({ target: { files } } as any)}
              onRemoveAttachment={removeAttachment}
            />
          ) : (
            /* gentle-fade: la conversación recién nacida aparece en fundido
               mientras el input planea hacia el dock (FLIP de arriba). */
            <div className={convJustStarted ? "gentle-fade" : ""}>
              <MessageList
                messages={messages}
                streamingMsgId={streamingMsgId}
                retryMode={retryMode}
                formatTime={formatTime}
              />
            </div>
          )}
        </main>

        {/* Input area — at bottom when conversation is active.

            The wrapper's bottom padding respects the device safe area (the
            chat-area wrapper above already handles the home indicator for
            the messages list; this is the input's own breathing room
            above that). La entrada de la primera vez NO es una clase CSS:
            el efecto FLIP de arriba lo hace volar desde el centro de la
            pantalla (donde estaba en EmptyState) hasta aquí. */}
        {activeConv?.id && (
        <div
          ref={bottomInputRef}
          className="w-full flex-none pt-2"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <ChatInput
            input={input}
            setInput={setInputFromUser}
            sending={sending}
            attachments={attachments}
            previewUrls={previewUrls}
            getBlockReason={getBlockReason}
            isLoggedIn={isLoggedIn}
            onSend={sendMessage}
            onFileSelect={(files) => handleFileSelect({ target: { files } } as any)}
            onRemoveAttachment={removeAttachment}
            isStreaming={!!streamingMsgId}
            onStop={stopStream}
            convId={activeConv?.id}
          />
        </div>
        )}
      </div>
      {showAccountMenu && (
        <AccountMenu
          email={userEmail}
          profile={profile}
          userContext={userContext}
          userId={userId}
          onSave={(data) => { setUserContext(prev => prev ? { ...prev, ...data } : prev); }}
          onSignOut={async () => { await clerkSignOut(); window.location.href = "/"; }}
          onClose={() => setShowAccountMenu(false)}
        />
      )}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2.5 rounded-lg flex items-center gap-2 animate-fade-in"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
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

      {/* Onboarding tour — self-contained, see ./OnboardingTour.tsx */}
      <OnboardingTour open={showOnboarding} onClose={dismissOnboarding} />
    </div>
  );
}

