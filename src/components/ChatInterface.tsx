"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import ReactMarkdown from "react-markdown";
import dynamic from "next/dynamic";
const AuthModal = dynamic(() => import("./AuthModal"));

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
  const [showMenu, setShowMenu] = useState(false);
  const [menuView, setMenuView] = useState<"main" | "account">("main");
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [profile, setProfile] = useState<{subscription_weeks?: number; subscription_start?: string; weekly_limit?: number; messages_used?: number} | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

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
      .select("subscription_weeks, subscription_start, weekly_limit, messages_used")
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

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handler(e: MouseEvent) {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        menuBtnRef.current && !menuBtnRef.current.contains(e.target as Node)
      ) {
        setShowMenu(false);
        setMenuView("main");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

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

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: s, conversation_id: conv!.id, attachments: contentParts }),
      });
      const result = await res.json();

      if (result.error) {
        const errorCode = result.code || 500;
        setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: `Error ${errorCode}. Por favor intente nuevamente.`, created_at: new Date().toISOString() }]);
      } else if (result.message) {
        const { data: aiMsg } = await supabase.from("messages").insert({ conversation_id: conv!.id, role: "assistant", content: result.message }).select().single();
        if (aiMsg) setMessages(prev => [...prev, aiMsg]);
        else setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: result.message, created_at: new Date().toISOString() }]);

        const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
        await supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", conv!.id);
        setActiveConv({ ...conv!, title });
        loadConversations();
      }
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "Error de conexión. Intenta de nuevo.", created_at: new Date().toISOString() }]);
    }

    setSending(false);
    setTimeout(() => { autoResize(); textareaRef.current?.focus(); }, 0);
  }

  async function sendMessage() {
    if ((!input.trim() && attachments.length === 0) || sending) return;
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

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: convId, attachments: contentParts }),
      });
      const result = await res.json();

      if (result.error) {
        const errorCode = result.code || 500;
        setMessages(prev => [...prev, {
          id: Date.now().toString(), role: "assistant",
          content: `Error ${errorCode}. Por favor intente nuevamente.`, created_at: new Date().toISOString(),
        }]);
        textareaRef.current?.focus();
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
        content: "Error de conexión. Intenta de nuevo.", created_at: new Date().toISOString(),
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
          <div className="relative mt-3" ref={menuRef}>
            <button ref={menuBtnRef} onClick={() => setShowMenu(!showMenu)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-[var(--surface-hover)]"
              style={{ color: "var(--text-secondary)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
                {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="flex-1 text-left overflow-hidden">
                <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>Mi cuenta</p>
                <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{userEmail}</p>
              </div>
              <svg className="w-3.5 h-3.5 opacity-40 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1.5 rounded-lg overflow-hidden"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
                {menuView === "main" ? (
                  <>
                    <button onClick={() => setMenuView("account")}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: "var(--text-primary)" }}>
                      <svg className="w-3.5 h-3.5 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Límite de cuenta
                    </button>
                    <button onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--danger)]/10"
                      style={{ color: "var(--danger)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setMenuView("main")}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-hover)]"
                      style={{ color: "var(--text-tertiary)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                      Volver
                    </button>
                    <div className="px-3 py-3">
                      <p className="text-[11px] mb-2" style={{ color: "var(--text-tertiary)" }}>Límite semanal</p>
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border)" }}>
                          <div className="h-full rounded-full transition-all" style={{ background: "var(--primary)", width: (profile?.weekly_limit && profile?.messages_used != null) ? Math.min(100, Math.round((profile.messages_used / profile.weekly_limit) * 100)) + "%" : "0%" }} />
                        </div>
                        <span className="text-[11px] font-medium shrink-0" style={{ color: "var(--primary)" }}>
                          {profile?.weekly_limit && profile?.messages_used != null ? `${profile.messages_used}/${profile.weekly_limit}` : "0/100"}
                        </span>
                      </div>
                      {profile?.subscription_weeks != null && (
                        <p className="text-[11px] mt-1.5" style={{ color: "var(--text-tertiary)" }}>
                          {profile.subscription_weeks} semana{profile.subscription_weeks !== 1 ? "s" : ""} restante{profile.subscription_weeks !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
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

                
                {/* Suggestions */}
                {isLoggedIn && !isDisabled && (
                  <div className="mt-4">
                    {suggestionsLoading ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} className="h-14 rounded-lg animate-pulse" style={{ backgroundColor: "var(--surface)" }} />
                        ))}
                      </div>
                    ) : (
                      <>
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
                      </>
                    )}
                  </div>
                )}

                {!isLoggedIn && (
                  <div className="mt-6 text-center">
                    <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                      Inicia sesión para comenzar a chatear
                    </p>
                    <button onClick={() => setShowAuthPrompt(true)}
                      className="px-10 py-3.5 rounded-xl text-sm font-semibold shadow-lg transition-all hover:opacity-90 active:scale-95"
                      style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white" }}>
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
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {/* Timestamp + copy */}
                    <div className={`flex items-center gap-1.5 mt-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      {msg.role === "assistant" && (
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
                placeholder={isLoggedIn ? "Escribe un mensaje..." : "Inicia sesión para chatear..."}
                disabled={isDisabled || sending}
                rows={1}
                className="flex-1 text-sm outline-none resize-none bg-transparent leading-relaxed"
                style={{ color: "var(--text-primary)", maxHeight: "200px" }}
              />
              <button
                onClick={sendMessage}
                disabled={(!input.trim() && attachments.length === 0) || sending || isDisabled}
                className="shrink-0 p-2 rounded-lg transition-all hover:opacity-90 active:scale-90 disabled:opacity-30"
                style={{ backgroundColor: "var(--primary)", color: "white" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {showAuthPrompt && <AuthModal onSuccess={() => {
          setShowAuthPrompt(false);
          window.location.reload();
        }} onClose={() => setShowAuthPrompt(false)} />}
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