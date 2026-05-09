"use client";

import { useState, useEffect, useRef } from "react";
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [profile, setProfile] = useState<{status?: string; subscription_weeks?: number; subscription_start?: string; weekly_limit?: number; messages_used?: number; used_coupon_label?: string; used_coupon_color?: string; last_message_at?: string; weekly_reset_at?: string} | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [streamText, setStreamText] = useState("");
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [isSendDisabled, setIsSendDisabled] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const lastErrorRef = useRef<{ message: string; conversationId: string | null; attachments: any[] } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: d }) => {
      setIsLoggedIn(!!d.session);
      if (d.session?.user?.email) setUserEmail(d.session.user.email);
      if (d.session) loadConversations();
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session;
      setIsLoggedIn(loggedIn);
      if (session?.user?.email) setUserEmail(session.user.email);
      if (loggedIn && session?.user?.id) loadConversations();
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load daily suggestions
  useEffect(() => {
    if (!isLoggedIn) return;
    setSuggestionsLoading(true);
    fetch("/api/suggestions")
      .then(r => r.json())
      .then(d => { if (d.suggestions) setSuggestions(d.suggestions); setSuggestionsLoading(false); })
      .catch(() => setSuggestionsLoading(false));
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    supabase
      .from("profiles")
      .select("subscription_weeks, subscription_start, weekly_limit, messages_used, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at, status")
      .eq("id", userId)
      .single()
      .then(({ data }) => { if (data) setProfile(data); });
  }, [userId, isLoggedIn]);

  async function loadConversations() {
    if (!isLoggedIn) return;
    const { data } = await supabase
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
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
            // Ocultar conversaciones que quedaron vacías (sin mensajes y título original)
            return updated.filter(c => c.title !== "Nueva conversación");
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
            // Ignore if already streaming or already in state (prevents duplicate on DB insert after streaming)
            if (msg.id === streamingMsgId) return prev;
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Keep textarea focused after sending
  useEffect(() => {
    if (!sending && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [sending]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  function autoResize() {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + " · " +
      d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  }

  function getBlockReason(): { canSend: boolean; canWrite: boolean; reason: string; cooldownSecs: number } {
    if (!isLoggedIn) return { canSend: false, canWrite: false, reason: "Inicia sesion para chatear", cooldownSecs: 0 };
    if (profile?.status === "inactive") return { canSend: false, canWrite: false, reason: "Tu suscripcion esta inactiva", cooldownSecs: 0 };
    const weeks = profile?.subscription_weeks ?? 0;
    if (weeks <= 0 && weeks !== -1) return { canSend: false, canWrite: false, reason: "Tu suscripcion ha expirado. Añade tiempo para continuar.", cooldownSecs: 0 };
    const messagesUsed = profile?.messages_used ?? 0;
    const weeklyLimit = profile?.weekly_limit ?? 100;
    if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) return { canSend: false, canWrite: false, reason: `Has alcanzado el limite semanal (${messagesUsed}/${weeklyLimit}). Añade semanas para continuar.`, cooldownSecs: 0 };
    if (cooldownRemaining > 0) return { canSend: false, canWrite: true, reason: `Espera ${cooldownRemaining}s`, cooldownSecs: cooldownRemaining };
    return { canSend: true, canWrite: true, reason: "", cooldownSecs: 0 };
  }

  
  async function newConversation() {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    // Limpiar conversaciones vacías antes de crear nueva
    const { data: convs } = await supabase
      .from("conversations")
      .select("id, title, messages(count)")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    if (convs) {
      // Eliminar conversaciones sin mensajes (vacías)
      const toDelete = convs.filter((c: any) => {
        const msgs = c.messages as any[];
        return !msgs || msgs.length === 0 || (msgs.length > 0 && msgs[0].count === 0);
      });
      for (const c of toDelete) {
        await supabase.from("conversations").delete().eq("id", c.id);
      }
      // Mantener solo conversaciones con mensajes o título personalizado
      const filtered = convs.filter((c: any) => {
        const msgs = c.messages as any[];
        return (msgs && msgs.length > 0 && (msgs[0].count ?? 0) > 0) || c.title !== "Nueva conversación";
      });
      setConversations((filtered as unknown) as Conversation[]);
    }
    // No crear registro en DB — solo resetear estado local
    setActiveConv(null);
    setMessages([]);
    setShowSidebar(false);
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
      const { data } = await supabase.from("conversations").insert({ user_id: userId, title: "Nueva conversación" }).select().single();
      if (data) { setConversations([data, ...conversations]); conv = data; setActiveConv(data); loadConversations(); } else { setSending(false); return; }
    } else {
      loadConversations();
    }

    const convId = conv!.id;
    const { data: inserted } = await supabase
      .from("messages")
      .insert({ conversation_id: convId, role: "user", content: s, attachments: [] })
      .select().single();
    if (inserted) setMessages(prev => [...prev, inserted]);

    try {
      const contentParts: any[] = [{ type: "text", text: s }];

      // Streaming message placeholder
      const msgId = Date.now().toString() + "-suggest";
      const streamCreatedAt = new Date().toISOString();
      setMessages(prev => [...prev, {
        id: msgId, role: "assistant", content: "", created_at: streamCreatedAt,
      }]);
      setStreamingMsgId(msgId);
      setStreamText("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: s, conversation_id: convId, attachments: contentParts }),
      });

      if (!res.ok) {
        const result = await res.json();
        const errorCode = result.code || res.status;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: `Error ${errorCode}. Por favor intente nuevamente.` } : m));
        lastErrorRef.current = { message: s, conversationId: convId, attachments: contentParts };
        setStreamingMsgId(null);
      } else {
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        if (!reader) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo." } : m));
          lastErrorRef.current = { message: s, conversationId: convId, attachments: contentParts };
          setStreamingMsgId(null);
        } else {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const dataStr = line.slice(6);
                  if (dataStr === "[DONE]" || dataStr === "") continue;
                  try {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.delta) {
                      fullText += parsed.delta;
                      setStreamText(fullText);
                      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText } : m));
                    }
                  } catch { /* ignore */ }
                }
              }
            }
          } catch {
            if (fullText === "") {
              setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo." } : m));
              lastErrorRef.current = { message: s, conversationId: convId, attachments: contentParts };
            }
          } finally {
            reader.releaseLock();
          }
        }

        setStreamingMsgId(null);
        lastErrorRef.current = null;

        if (fullText) {
          await supabase.from("messages").insert({
            conversation_id: convId, role: "assistant", content: fullText,
          });
        }

        const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
        await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", convId);
        setActiveConv({ ...conv!, title });
        loadConversations();
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Error de conexion. Intenta de nuevo.", created_at: new Date().toISOString() }]);
    }

    setSending(false);
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  async function sendMessage() {
    if ((!input.trim() && attachments.length === 0) || sending) return;
    const block = getBlockReason();
    if (!block.canSend) return;
    setCooldownRemaining(30);

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
    const filesToSend = [...attachments];
    setInput("");
    setAttachments([]);
    setPreviewUrls({});
    setSending(true);
    autoResize();

    // Keep previews for display in chat bubble
    const savedPreviews = { ...previewUrls };

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

      // Create streaming message placeholder
      const msgId = Date.now().toString();
      const streamCreatedAt = new Date().toISOString();
      setMessages(prev => [...prev, {
        id: msgId, role: "assistant", content: "", created_at: streamCreatedAt,
      }]);
      setStreamingMsgId(msgId);
      setStreamText("");

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: convId, attachments: contentParts }),
      });

      if (!res.ok) {
        const result = await res.json();
        const errorCode = result.code || res.status;
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: `Error ${errorCode}. Por favor intente nuevamente.` } : m));
        lastErrorRef.current = { message: userMsg, conversationId: convId, attachments: contentParts };
        setStreamingMsgId(null);
        textareaRef.current?.focus();
      } else {
        // Read streaming response
        const reader = res.body?.getReader();

        if (!reader) {
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo." } : m));
          lastErrorRef.current = { message: userMsg, conversationId: convId, attachments: contentParts };
          setStreamingMsgId(null);
          setSending(false);
          textareaRef.current?.focus();
          return;
        }

        const decoder = new TextDecoder();
        let fullText = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6);
                if (dataStr === "[DONE]" || dataStr === "") continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.delta) {
                    fullText += parsed.delta;
                    setStreamText(fullText);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText } : m));
                  }
                } catch { /* ignore parse errors */ }
              }
            }
          }
        } catch {
          if (fullText === "") {
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo." } : m));
            lastErrorRef.current = { message: userMsg, conversationId: convId, attachments: contentParts };
          }
        } finally {
          reader.releaseLock();
        }

        setStreamingMsgId(null);
        lastErrorRef.current = null;

        // Save complete message to DB
        if (fullText) {
          await supabase.from("messages").insert({
            conversation_id: convId, role: "assistant", content: fullText,
          });
        }

        // Update message with DB id
        const finalMsg = messages.find(m => m.id === msgId);
        if (finalMsg && !finalMsg.id.includes("-")) {
          // it was a temp id, that's fine
        }

        // Generate title if new conversation
        if (conv.title === "Nueva conversación" && fullText) {
          const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : "");
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
        content: "Error de conexion. Intenta de nuevo.", created_at: new Date().toISOString(),
      }]);
    }

    setSending(false);
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  const isDisabled = !isLoggedIn;

  return (
    <div className="flex h-screen relative" style={{ backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <div
        className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-[280px] flex flex-col transition-transform duration-200 md:translate-x-0 md:relative ${!isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
        style={{ backgroundColor: "var(--surface)", borderRight: "1px solid var(--border)" }}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between px-5 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              <span style={{ color: "var(--primary)" }}>M</span>ulfai
            </span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New chat button */}
        <div className="px-4 shrink-0">
          <button onClick={newConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: "var(--primary)", color: "white" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Nuevo chat
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto px-3 pt-3 pb-4">
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-3 opacity-30"
                style={{ backgroundColor: "var(--border)" }}>
                <svg className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Sin conversaciones</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {conversations.map(conv => (
                <div key={conv.id} onClick={() => selectConv(conv)}
                  className={`group w-full text-left px-3 py-2.5 rounded-lg text-sm flex items-center gap-2.5 cursor-pointer transition-all ${
                    activeConv?.id === conv.id ? "" : "hover:bg-[var(--surface-hover)]"
                  }`}
                  style={{
                    color: activeConv?.id === conv.id ? "var(--text-primary)" : "var(--text-secondary)",
                    backgroundColor: activeConv?.id === conv.id ? "var(--surface-hover)" : "transparent",
                    fontWeight: activeConv?.id === conv.id ? 500 : 400,
                  }}>
                  <svg className="w-3.5 h-3.5 shrink-0 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="flex-1 truncate">{conv.title}</span>
                  <button onClick={(e) => deleteConv(conv.id, e)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded transition-all hover:bg-[var(--danger)]/10"
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
        <div className="px-3 pb-4 shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={() => setShowAccountMenu(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 mt-3 rounded-lg text-sm transition-colors hover:bg-[var(--surface-hover)]"
            style={{ color: "var(--text-secondary)" }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>Mi cuenta</p>
              <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{userEmail}</p>
            </div>
            {profile && (
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: profile.subscription_weeks && (profile.subscription_weeks > 0 || profile.subscription_weeks < 0) ? "var(--primary)" : "var(--danger)" }} />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar backdrop */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setShowSidebar(false)} />
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-center px-4 shrink-0 md:hidden"
          style={{ backgroundColor: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
          <button onClick={() => setShowSidebar(true)}
            className="absolute left-4 p-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors" style={{ color: "var(--text-secondary)" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Mulfai</span>
          </div>
        </header>

        {/* Messages */}
        <main className="flex-1 overflow-y-auto relative">
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
                  <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Mulfai</h1>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Tu asistente de IA personal
                  </p>
                </div>

                {!isLoggedIn && (
                  <div className="text-center mt-2 mb-6">
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-10 py-3.5 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
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
                              {block.cooldownSecs > 0
                                ? `Espera ${block.cooldownSecs}s para enviar`
                                : "Suscripcion bloqueada"}
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
          ) : (
            <div className="max-w-2xl mx-auto px-4 py-5">
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
                  <div className="relative max-w-[78%]">
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
                          {lastErrorRef.current && msg.content.includes("Error") && (
                            <button onClick={async () => {
                              if (!lastErrorRef.current) return;
                              setLoading(true);
                              setMessages(prev => prev.filter(m => m.id !== msg.id));
                              const res = await fetch("/api/chat", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  message: lastErrorRef.current.message,
                                  conversation_id: lastErrorRef.current.conversationId,
                                  attachments: lastErrorRef.current.attachments,
                                }),
                              });
                              const result = await res.json();
                              setLoading(false);
                              if (result.error) {
                                setMessages(prev => [...prev, {
                                  id: Date.now().toString(), role: "assistant",
                                  content: `Error ${result.code || 500}. Por favor intente nuevamente.`, created_at: new Date().toISOString(),
                                }]);
                              } else if (result.message) {
                                const { data: aiMsg } = await supabase.from("messages").insert({
                                  conversation_id: lastErrorRef.current.conversationId,
                                  role: "assistant", content: result.message,
                                }).select().single();
                                if (aiMsg) setMessages(prev => [...prev, aiMsg]);
                                else setMessages(prev => [...prev, {
                                  id: Date.now().toString(), role: "assistant",
                                  content: result.message, created_at: new Date().toISOString(),
                                }]);
                                lastErrorRef.current = null;
                              }
                            }}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-all"
                              style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "var(--warning)" }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Reintentar
                            </button>
                          )}
                          <button onClick={() => copyMessage(msg.content, msg.id)}
                            className="p-1.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors opacity-0 group-hover:opacity-100"
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

              {sending && (
                <div className="flex justify-start mb-4 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-2.5 mt-0.5 shrink-0"
                    style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl text-sm"
                    style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", borderRadius: "16px 16px 16px 4px" }}>
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
        <div className="px-4 pb-5 pt-2 shrink-0">
          <div className="max-w-2xl mx-auto">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((file, i) => {
                  const key = file.name + file.size;
                  const isImage = file.type.startsWith("image/");
                  return (
                    <div key={i} className="relative group">
                      {isImage ? (
                        <img src={previewUrls[key]} alt={file.name}
                          className="w-12 h-12 rounded-lg object-cover"
                          style={{ backgroundColor: "var(--surface)" }} />
                      ) : (
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: "var(--surface)" }}>
                          <svg className="w-3.5 h-3.5" style={{ color: "var(--text-tertiary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                      )}
                      <button onClick={() => removeAttachment(file.name, file.size)}
                        className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center text-xs"
                        style={{ backgroundColor: "var(--danger)", color: "white" }}>
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-end gap-1.5 px-3 py-2.5 rounded-xl transition-all"
              style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
              {/* Attachment button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={attachments.length >= 3 || isDisabled || sending}
                className="shrink-0 p-2 rounded-lg transition-all hover:bg-[var(--surface-hover)] disabled:opacity-30"
                style={{ color: "var(--text-tertiary)" }}
                title="Adjuntar">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf,.doc,.docx,.txt" multiple
                onChange={handleFileSelect} className="hidden" />

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
                  if (cooldownRemaining > 0) return `Espera ${cooldownRemaining}s...`;
                  if (!isLoggedIn) return "Inicia sesion para chatear...";
                  if (!block.canWrite) return "Sin suscripcion activa...";
                  return "Escribe un mensaje...";
                })()}
                disabled={sending || !getBlockReason().canWrite}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent leading-relaxed"
                style={{ color: getBlockReason().canWrite ? "var(--text-primary)" : "var(--text-tertiary)", maxHeight: "200px" }}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || sending || isDisabled || cooldownRemaining > 0}
                className="shrink-0 p-2 rounded-lg transition-all hover:opacity-90 active:scale-90 disabled:opacity-30 relative"
                style={{ backgroundColor: cooldownRemaining > 0 ? "var(--warning)" : "var(--primary)", color: "white" }}>
                {cooldownRemaining > 0 ? (
                  <div className="w-3.5 h-3.5 flex items-center justify-center">
                    <span className="text-[9px] font-bold">{cooldownRemaining}</span>
                  </div>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                )}
              </button>
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
    </div>
  );
}