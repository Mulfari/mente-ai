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


export default function ChatInterface({ userId, initialConversationId }: { userId: string; initialConversationId?: string }) {
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
  const [profile, setProfile] = useState<{status?: string; subscription_weeks?: number; subscription_start?: string; subscription_end?: string; weekly_limit?: number; messages_used?: number; used_coupon_label?: string; used_coupon_color?: string; last_message_at?: string; weekly_reset_at?: string} | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const notifTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [streamingMsgId, setStreamingMsgId] = useState<string | null>(null);
  const [isSendDisabled, setIsSendDisabled] = useState(false);
  const [responseMode, setResponseMode] = useState<"normal" | "deep">("normal");
  const [streamError, setStreamError] = useState<string | null>(null);
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
      .select("subscription_weeks, subscription_start, subscription_end, weekly_limit, messages_used, used_coupon_label, used_coupon_color, last_message_at, weekly_reset_at, status")
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
    // Clean up orphaned in_progress messages in this conversation first
    await supabase
      .from("messages")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .eq("content", "")
      .eq("in_progress", true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      setStreamingMsgId(null);
      lastErrorRef.current = null;
    }
    setLoading(false);
  }

  useEffect(() => {
    loadConversations();
  }, [userId, isLoggedIn]);

  // Load initial conversation from URL
  useEffect(() => {
    if (!initialConversationId || !isLoggedIn || activeConv) return;
    const conv = conversations.find(c => c.id === initialConversationId);
    if (conv) {
      selectConv(conv);
    }
  }, [initialConversationId, isLoggedIn, activeConv, conversations]);

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

  // Show onboarding on first login (check localStorage)
  useEffect(() => {
    if (isLoggedIn) {
      const seen = localStorage.getItem("mulfai_onboarding_seen");
      if (!seen) {
        setTimeout(() => setShowOnboarding(true), 800);
      }
    }
  }, [isLoggedIn]);

  function dismissOnboarding() {
    localStorage.setItem("mulfai_onboarding_seen", "1");
    setShowOnboarding(false);
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
    const messagesUsed = profile?.messages_used ?? 0;
    const weeklyLimit = profile?.weekly_limit ?? 100;
    if (weeklyLimit > 0 && messagesUsed >= weeklyLimit) return { canSend: false, canWrite: false, reason: `Has alcanzado el limite semanal (${messagesUsed}/${weeklyLimit}). Añade semanas para continuar.` };
    return { canSend: true, canWrite: true, reason: "" };
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
    // Recargar sugerencias al iniciar nuevo chat
    loadSuggestions();
  }

  async function selectConv(conv: Conversation) {
    if (!isLoggedIn) { setShowAuthPrompt(true); return; }
    setActiveConv(conv);
    await loadMessages(conv.id);
    setShowSidebar(false);
    window.history.pushState(null, "", `/chat/${conv.id}`);
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
      if (data) { setConversations([data, ...conversations]); conv = data; setActiveConv(data); } else { setSending(false); return; }
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
          _retryReq: { message: s, conversationId: convId, contentParts: [], mode: responseMode },
        }]);
        setSending(false);
        setStreamingMsgId(null);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      const updateStreamText = (text: string) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text } : m));
        supabase.from("messages").update({ content: text }).eq("id", msgId);
      };

      const processStream = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            supabase.from("messages").update({ content: fullText, in_progress: false }).eq("id", msgId);
            setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText, _loading: false } : m));
            currentStreamReqRef.current = null;
            setSending(false);
            setStreamingMsgId(null);
            const title = s.slice(0, 40) + (s.length > 40 ? "..." : "");
            supabase.from("conversations").update({ title, updated_at: new Date().toISOString() }).eq("id", convId);
            setActiveConv({ ...conv!, title });
            if (queuedMsgRef.current) {
              const q = queuedMsgRef.current as QueuedMsg;
              queuedMsgRef.current = null;
              setTimeout(() => { setInput(q.text); setAttachments(q.files); setPreviewUrls(q.previews); autoResize(); sendMessage(); }, 100);
            }
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
                if (json.type === "chunk" && json.text) { fullText += json.text; updateStreamText(fullText); }
              } catch {}
            }
          }
          processStream();
        }).catch(() => {
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
                const updateStreamText2 = (text: string) => {
                  setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: text } : m));
                  supabase.from("messages").update({ content: text }).eq("id", msgId);
                };
                const processStream2 = () => {
                  reader2.read().then(({ done, value }) => {
                    if (done) {
                      supabase.from("messages").update({ content: fullText2, in_progress: false }).eq("id", msgId);
                      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: fullText2, _loading: false } : m));
                      currentStreamReqRef.current = null;
                      setSending(false);
                      setStreamingMsgId(null);
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
                          if (json.type === "chunk" && json.text) { fullText2 += json.text; updateStreamText2(fullText2); }
                        } catch {}
                      }
                    }
                    processStream2();
                  }).catch(() => {
                    supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
                    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error. Intenta de nuevo.", _loading: false, _retryReq: req } : m));
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
          supabase.from("messages").update({ in_progress: false }).eq("id", msgId);
          setMessages(prev => prev.map(m => m.id === msgId ? { ...m, content: "Error de conexion. Intenta de nuevo.", _loading: false } : m));
          setSending(false);
          setStreamingMsgId(null);
            });
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

    const queuedMsg = queuedMsgRef.current;
    queuedMsgRef.current = null;

    const userMsg = queuedMsg ? queuedMsg.text : input.trim();
    const filesToSend = queuedMsg ? queuedMsg.files : [...attachments];

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
        body: JSON.stringify({ message: userMsg, conversation_id: convId, attachments: contentParts, mode: responseMode }),
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
          _retryReq: { message: userMsg, conversationId: convId, contentParts, mode: responseMode },
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

        const updateStreamText = (text: string) => {
          // Update both local state and DB in_progress message
          setMessages(prev => prev.map(m =>
            m.id === msgId ? { ...m, content: text } : m
          ));
          supabase.from("messages").update({ content: text }).eq("id", msgId);
        };

        const processStream = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              // Save message to Supabase and clear in_progress
              supabase.from("messages").update({ content: fullText, in_progress: false }).eq("id", msgId);
              setMessages(prev => prev.map(m =>
                m.id === msgId ? { ...m, content: fullText, _loading: false } : m
              ));
              currentStreamReqRef.current = null;
              setSending(false);
              setStreamingMsgId(null);
                      // Flush queued message if any
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
                  if (json.type === "chunk" && json.text) {
                    fullText += json.text;
                    updateStreamText(fullText);
                  }
                } catch {}
              }
            }
            processStream();
          }).catch(() => {
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
                    m.id === msgId ? { ...m, content: result.error || "Error. Intenta de nuevo.", _loading: false, _retryReq: req } : m
                  ));
                } else {
                  const reader2 = res2.body!.getReader();
                  const decoder2 = new TextDecoder();
                  let buffer2 = "";
                  let fullText2 = "";
                  const updateStreamText2 = (text: string) => {
                    setMessages(prev => prev.map(m =>
                      m.id === msgId ? { ...m, content: text } : m
                    ));
                  };
                  const processStream2 = () => {
                    reader2.read().then(({ done, value }) => {
                      if (done) {
                        supabase.from("messages").insert({ conversation_id: req.conversationId, role: "assistant", content: fullText2 }).then(() => {});
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
                        m.id === msgId ? { ...m, content: "Error. Intenta de nuevo.", _loading: false, _retryReq: req } : m
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
                });
        };

        processStream();
      }

      lastErrorRef.current = null;

      // Generate title if new conversation
      if (conv.title === "Nueva conversación") {
        const title = userMsg.slice(0, 40) + (userMsg.length > 40 ? "..." : "");
        await supabase.from("conversations")
          .update({ title, updated_at: new Date().toISOString() })
          .eq("id", convId);
        setActiveConv({ ...conv, title });
      }
    } catch {
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
        className={`${showSidebar ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 w-[260px] max-sm:w-[88vw] flex flex-col md:translate-x-0 md:relative ${!isLoggedIn ? "opacity-50 pointer-events-none select-none" : ""}`}
        style={{
          backgroundColor: "rgba(22,22,22,0.96)",
          backdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
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
                // Use created_at as fallback; only show dateLabel if we have a valid date
                const d = new Date(conv.created_at || "");
                const now = new Date();
                const isValidDate = !isNaN(d.getTime());
                const isToday = isValidDate && d.toDateString() === now.toDateString();
                const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
                const isYesterday = isValidDate && d.toDateString() === yesterday.toDateString();
                const dateLabel = isValidDate
                  ? isToday ? "Hoy" : isYesterday ? "Ayer" : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })
                  : "";

                return (
                  <div key={conv.id}
                    onClick={() => selectConv(conv)}
                    className="group w-full text-left rounded-xl flex items-start gap-2.5 cursor-pointer transition-all duration-150 px-2 py-2.5 relative"
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.backgroundColor = "transparent"; }}>
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
                    )}
                    {/* Icon */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{
                        backgroundColor: isActive ? "rgba(16,163,127,0.15)" : "rgba(255,255,255,0.04)",
                      }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
                        style={{ color: isActive ? "#10A37F" : "rgba(255,255,255,0.3)" }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate leading-tight" style={{ color: isActive ? "var(--text-primary)" : "rgba(255,255,255,0.55)" }}>
                        {conv.title}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {dateLabel}
                      </p>
                    </div>
                    {/* Delete */}
                    <button onClick={(e) => deleteConv(conv.id, e)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
                      style={{ color: "rgba(255,255,255,0.2)" }}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="px-3 pb-6 pt-3 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <button onClick={() => setShowAccountMenu(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer group"
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,255,255,0.04)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
              style={{ background: "linear-gradient(135deg, #10A37F, #0d8b6a)" }}>
              {userEmail ? userEmail.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="flex-1 text-left overflow-hidden">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium truncate" style={{ color: "rgba(255,255,255,0.7)" }}>Mi cuenta</p>
                {profile && (
                  <div className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: profile.subscription_weeks && (profile.subscription_weeks > 0 || profile.subscription_weeks < 0) ? "#10A37F" : "#EF4444" }} />
                )}
              </div>
              <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.3)" }}>{userEmail}</p>
            </div>
            <svg className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24"
              style={{ color: "rgba(255,255,255,0.2)" }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sidebar backdrop */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden" onClick={() => setShowSidebar(false)} />
      )}

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
                  <div className="relative max-w-[85%] sm:max-w-[78%]">
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
                      ) : msg.content && msg.content.includes("Error") && !msg._retryReq ? (
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

                              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, _loading: true } : m));
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
                                const updateStreamText = (text: string) => {
                                  setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, content: text } : m));
                                };
                                const processStream = () => {
                                  reader.read().then(({ done, value }) => {
                                    if (done) {
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
                                          if (json.type === "chunk" && json.text) { fullText += json.text; updateStreamText(fullText); }
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
          <div className="max-w-2xl mx-auto">
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
          <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 25px 50px rgba(0,0,0,0.6)" }}>
            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", boxShadow: "0 4px 20px rgba(16,163,127,0.4)" }}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>¡Bienvenido a Mulfai!</h2>
              <p className="text-xs" style={{ color: "var(--text-secondary)" }}>Así funciona tu asistente de IA</p>
            </div>

            {/* Feature steps */}
            <div className="space-y-3 mb-6">
              {[
                { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", text: "Chatea de forma natural", sub: "Escribe lo que necesites, como hablar con una persona" },
                { icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", text: "Ayuda con código", sub: "Genera, explica y corrige código en segundos" },
                { icon: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13", text: "Adjunta imágenes", sub: "Envía fotos y la IA las analiza" },
                { icon: "M13 10V3L4 14h7v7l9-11h-7z", text: "Modo Pensar", sub: "Para respuestas más detalladas y analíticas" },
              ].map(({ icon, text, sub }, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: "var(--background)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "rgba(16,163,127,0.12)" }}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{text}</p>
                    <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button onClick={dismissOnboarding}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)", color: "white", boxShadow: "0 4px 20px rgba(16,163,127,0.35)" }}>
              ¡Entendido, empezar!
            </button>

          </div>
        </div>
      )}
    </div>
  );
}