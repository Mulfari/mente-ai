"use client";

import { useState, useEffect, useRef } from "react";
import type { AppConfig } from "@/lib/appConfig";

// Flujo de suscripción — diseño "Plans" + "Checkout" (adaptado del flujo de
// upgrade/checkout de ChatGPT). Dos pantallas: Planes (Gratis vs Plus, selector
// Semanal/Mensual) → Checkout de 2 columnas (método de pago LOCAL con datos
// copiables + comprobante, y resumen del pedido). El pago es MANUAL: el canal
// real de activación es WhatsApp; el admin activa al confirmar (o cupón).

type Props = {
  appConfig: AppConfig;
  initialTab?: "plans" | "coupon";
  onClose: () => void;
  onActivated: () => void;
};

type Screen = "plans" | "checkout" | "coupon";
type Method = "pagomovil" | "zelle" | "binance" | "whatsapp";

// Datos de pago — PLACEHOLDERS (pendientes de configurar antes de cobrar).
const PAY_DATA: Record<Exclude<Method, "whatsapp">, { k: string; v: string }[]> = {
  pagomovil: [
    { k: "Banco", v: "0102 · Banco de Venezuela" },
    { k: "Teléfono", v: "0412-1234567" },
    { k: "Cédula / RIF", v: "J-41234567-8" },
    { k: "Titular", v: "Mulfex, C.A." },
  ],
  zelle: [
    { k: "Correo Zelle", v: "pagos@mulfex.com" },
    { k: "Titular", v: "Mulfex LLC" },
  ],
  binance: [
    { k: "Wallet USDT", v: "TXk9aQ2…7fHpZ" },
    { k: "Red", v: "TRON (TRC20)" },
  ],
};

const METHOD_LABEL: Record<Method, string> = {
  pagomovil: "Pago Móvil",
  zelle: "Zelle",
  binance: "Binance USDT",
  whatsapp: "WhatsApp",
};

function MethodIcon({ id }: { id: Method }) {
  if (id === "pagomovil")
    return <svg className="w-[17px] h-[17px]" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><circle cx="12" cy="18.3" r="1" fill="var(--surface)" /></svg>;
  if (id === "zelle")
    return <svg className="w-[17px] h-[17px]" fill="currentColor" viewBox="0 0 24 24"><path d="M3 10l9-6 9 6v1H3v-1zm1.5 3H7v5H4.5v-5zm4.25 0h2.5v5h-2.5v-5zm4.25 0h2.5v5h-2.5v-5zM4 20h16v2H4v-2z" /></svg>;
  if (id === "binance")
    return <svg className="w-[17px] h-[17px]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3 3-3 3-3-3 3-3zm-5 5l3 3-3 3-3-3 3-3zm10 0l3 3-3 3-3-3 3-3zm-5 5l3 3-3 3-3-3 3-3z" /></svg>;
  return <svg className="w-[17px] h-[17px]" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.747 5.634l-.999 3.648 3.741-.981z" /></svg>;
}

export default function PlansModal({ appConfig, initialTab = "plans", onClose, onActivated }: Props) {
  const [screen, setScreen] = useState<Screen>(initialTab === "coupon" ? "coupon" : "plans");
  const [bill, setBill] = useState<"week" | "month">("month");
  const [couponOpen, setCouponOpen] = useState(false); // cupón inline en la pantalla de planes

  // checkout
  const [method, setMethod] = useState<Method | null>(null);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [review, setReview] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // coupon
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const couponRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => { if (screen === "coupon") couponRef.current?.focus(); }, [screen]);

  const price = bill === "week" ? appConfig.priceWeeklyUsd : appConfig.priceMonthlyUsd;
  const amount = `$${price}`;
  const planName = bill === "week" ? "Semanal" : "Mensual";
  const days = bill === "week" ? appConfig.planWeeklyDays : appConfig.planMonthlyDays;

  const waText = encodeURIComponent(
    `Hola, quiero activar el plan ${planName} de VeChat (${amount}).` +
    (method && method !== "whatsapp" ? ` Pagué por ${METHOD_LABEL[method]} y les envío el comprobante.` : "")
  );
  const waUrl = appConfig.whatsappNumber ? `https://wa.me/${appConfig.whatsappNumber}?text=${waText}` : null;

  function copy(id: string, value: string) {
    navigator.clipboard.writeText(value).then(() => { setCopied(id); setTimeout(() => setCopied(null), 1500); }).catch(() => {});
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) setUploaded(f.name);
  }

  function submitCheckout() {
    if (waUrl) window.open(waUrl, "_blank", "noopener");
    setReview(true);
  }

  async function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/coupons/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      setLoading(false);
      if (!res.ok || data.error) { setError(data.error || "Error al aplicar el cupón"); return; }
      const added = data.weeks_added;
      setSuccess(added ? `+${added} días añadidos` : "Cupón aplicado");
      setCode("");
      setTimeout(() => onActivated(), 2000);
    } catch {
      setLoading(false); setError("Error de conexión. Intenta de nuevo.");
    }
  }

  const tint = "color-mix(in srgb, var(--primary) 8%, transparent)";
  const tint2 = "color-mix(in srgb, var(--primary) 16%, transparent)";

  const FREE_FEATS = ["Hasta 10 mensajes al día", "Respuestas estándar", "Sin historial extendido"];
  const PLUS_FEATS = ["Mensajes ilimitados", "Respuestas más rápidas", "Info local en vivo: dólar, trámites, negocios cerca", "Memoria extendida de tus chats", "Soporte por WhatsApp"];
  const TOP_FEATS = ["Mensajes ilimitados", "Respuestas más rápidas", "Info local en vivo"];

  const METHODS: Method[] = ["pagomovil", "zelle", "binance", "whatsapp"];
  const METHOD_TAG: Record<Method, string> = { pagomovil: "Bancos nacionales", zelle: "Transferencia USD", binance: "Cripto estable", whatsapp: "Con un asesor" };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto animate-modal-in" style={{ backgroundColor: "var(--background)" }}>
      {/* Barra superior full-screen (estilo ChatGPT): marca + cerrar. */}
      <div className="sticky top-0 z-20 flex items-center justify-between h-16 px-5 sm:px-8" style={{ backgroundColor: "var(--background)" }}>
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2z" /></svg>
          </span>
          <span className="text-[16px] font-bold" style={{ color: "var(--text-primary)" }}>Ve<span style={{ color: "var(--primary)" }}>Chat</span></span>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-secondary)" }} aria-label="Cerrar">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

        {/* ===================== PLANES ===================== */}
        {screen === "plans" && (
          <div className="min-h-[calc(100dvh-64px)] flex flex-col items-center justify-center px-5 sm:px-8 py-8">
            <div className="text-center max-w-[560px] mx-auto mb-7">
              <h1 className="text-[28px] sm:text-[32px] font-bold leading-tight" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Hazte VeChat Plus</h1>
              <p className="text-[15px] mt-2.5" style={{ color: "var(--text-secondary)" }}>Desbloquea la IA venezolana sin límites. Paga local, fácil y sin tarjetas.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:items-stretch w-full max-w-[760px] mx-auto">
              {/* Gratis */}
              <div className="flex-1 sm:basis-0 min-w-0 rounded-[22px] p-6 flex flex-col" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                <div className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>Gratis</div>
                <div className="text-[13px] mt-0.5 mb-4" style={{ color: "var(--text-tertiary)" }}>Lo básico para empezar</div>
                <div className="flex items-baseline gap-1 mb-5">
                  <span className="text-[42px] font-bold leading-none" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>$0</span>
                  <span className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>/ siempre</span>
                </div>
                <button disabled className="w-full h-[46px] rounded-[13px] text-[14.5px] font-semibold mb-5 cursor-default" style={{ border: "1px solid var(--border)", background: "transparent", color: "var(--text-tertiary)" }}>Tu plan actual</button>
                <div className="flex flex-col gap-3">
                  {FREE_FEATS.map((f) => (
                    <div key={f} className="flex items-start gap-3">
                      <svg className="w-[17px] h-[17px] shrink-0 mt-px" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      <span className="text-[14px] leading-snug" style={{ color: "var(--text-secondary)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plus */}
              <div className="relative flex-1 sm:basis-0 min-w-0">
                <div className="pl-glow absolute -inset-0.5 rounded-[24px] z-0" style={{ background: "var(--primary)", filter: "blur(16px)" }} />
                <div className="relative z-[1] w-full rounded-[22px] p-6 flex flex-col" style={{ backgroundColor: "var(--surface)", border: "1.5px solid var(--primary)", boxShadow: "0 14px 40px color-mix(in srgb, var(--primary) 16%, transparent)" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-semibold" style={{ color: "var(--primary)" }}>Plus</div>
                    <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-wide text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--primary)" }}>
                      <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>Popular
                    </span>
                  </div>
                  <div className="text-[13px] mt-0.5 mb-4" style={{ color: "var(--text-tertiary)" }}>Sin límites, hecho para Venezuela</div>

                  {/* selector semanal/mensual */}
                  <div className="flex gap-1 rounded-[12px] p-1 mb-4" style={{ backgroundColor: "var(--surface-hover)" }}>
                    <button onClick={() => setBill("week")} className="relative flex-1 h-[38px] rounded-[9px] flex items-center justify-center text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {bill === "week" && <span className="absolute inset-0 rounded-[9px]" style={{ backgroundColor: "var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />}
                      <span className="relative">Semanal</span>
                    </button>
                    <button onClick={() => setBill("month")} className="relative flex-1 h-[38px] rounded-[9px] flex items-center justify-center gap-2 text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
                      {bill === "month" && <span className="absolute inset-0 rounded-[9px]" style={{ backgroundColor: "var(--surface)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }} />}
                      <span className="relative">Mensual</span>
                      <span className="relative whitespace-nowrap text-[8.5px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ color: "var(--primary)", backgroundColor: tint }}>Mejor precio</span>
                    </button>
                  </div>

                  <div className="flex items-baseline gap-1.5 mb-1.5">
                    <span className="text-[42px] font-bold leading-none" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>{amount}</span>
                    <span className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>/ {bill === "week" ? "semana" : "mes"}</span>
                  </div>
                  <div className="text-[12.5px] mb-4" style={{ color: "var(--text-tertiary)" }}>{days} días · pago único, sin cobros automáticos</div>

                  <button onClick={() => setScreen("checkout")} className="w-full h-[46px] rounded-[13px] text-[15px] font-semibold text-white flex items-center justify-center gap-2 mb-5 transition-transform active:scale-[.985]" style={{ backgroundColor: "var(--primary)", boxShadow: "0 5px 16px color-mix(in srgb, var(--primary) 28%, transparent)" }}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M13 2L4.5 13H11l-1 9 8.5-11H12l1-9z" /></svg>Hazte Plus
                  </button>

                  <div className="flex flex-col gap-3">
                    {PLUS_FEATS.map((f) => (
                      <div key={f} className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-px" style={{ backgroundColor: tint }}>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </span>
                        <span className="text-[14px] leading-snug font-medium" style={{ color: "var(--text-primary)" }}>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-center">
              <button onClick={() => setCouponOpen((v) => !v)} className="inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:text-[var(--primary)]" style={{ color: couponOpen ? "var(--primary)" : "var(--text-secondary)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" /></svg>
                ¿Tienes un cupón? Canjéalo
              </button>
              {couponOpen && (
                <div className="w-full max-w-[360px] mt-3 animate-fade-in">
                  <form onSubmit={applyCoupon} className="flex gap-2">
                    <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MLF-XXXXXX" autoFocus
                      className="flex-1 h-11 rounded-[12px] px-4 text-[14px] font-semibold tracking-wider uppercase outline-none"
                      style={{ backgroundColor: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }} />
                    <button type="submit" disabled={loading || !code.trim()} className="h-11 px-5 rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}>
                      {loading ? "…" : "Canjear"}
                    </button>
                  </form>
                  {error && <div className="text-[12.5px] mt-2 text-center" style={{ color: "var(--danger)" }}>{error}</div>}
                  {success && <div className="text-[12.5px] mt-2 text-center font-semibold" style={{ color: "var(--primary)" }}>{success}</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================== CHECKOUT ===================== */}
        {screen === "checkout" && (
          <div className="max-w-[940px] mx-auto px-5 sm:px-8 pt-4 pb-16">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => { setScreen("plans"); setReview(false); }} className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--surface-hover)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div>
                <h2 className="text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Completar tu pago</h2>
                <p className="text-[13px] mt-0.5" style={{ color: "var(--text-secondary)" }}>Pago local y manual — activamos tu cuenta apenas lo confirmemos.</p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-5 items-start">
              {/* IZQUIERDA — método */}
              <div className="flex-1 min-w-0 w-full">
                <div>
                  <div className="text-[15px] font-semibold mb-4" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Método de pago</div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
                    {METHODS.map((id) => {
                      const active = method === id;
                      return (
                        <button key={id} onClick={() => setMethod(id)} className="flex items-center gap-2.5 p-3 rounded-[13px] text-left transition-all" style={{ backgroundColor: active ? tint : "var(--surface)", border: `1.5px solid ${active ? "var(--primary)" : "var(--border)"}` }}>
                          <span className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: active ? tint2 : "var(--surface-hover)", color: active ? "var(--primary)" : "var(--text-secondary)" }}><MethodIcon id={id} /></span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13.5px] font-semibold" style={{ color: "var(--text-primary)" }}>{METHOD_LABEL[id]}</span>
                            <span className="block text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>{METHOD_TAG[id]}</span>
                          </span>
                          {active && <svg className="w-[18px] h-[18px] shrink-0" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.2l-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6z" /></svg>}
                        </button>
                      );
                    })}
                  </div>

                  {/* datos del método */}
                  {!method && (
                    <div className="flex items-center gap-2.5 rounded-[13px] p-4 mb-4" style={{ backgroundColor: "var(--surface-hover)" }}>
                      <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" style={{ color: "var(--text-tertiary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 11l3 3 8-8M5 12a7 7 0 1014 0" /></svg>
                      <span className="text-[13.5px]" style={{ color: "var(--text-secondary)" }}>Elige un método arriba para ver los datos de pago.</span>
                    </div>
                  )}
                  {method === "whatsapp" && (
                    <div className="rounded-[15px] px-3.5 py-4 mb-4 text-center" style={{ backgroundColor: "var(--surface-hover)" }}>
                      <div className="text-[13.5px] leading-relaxed mb-3.5" style={{ color: "var(--text-secondary)" }}>Te ayudamos a completar el pago paso a paso por WhatsApp.</div>
                      <a href={waUrl ?? "#"} target="_blank" rel="noopener noreferrer" className="w-full h-[46px] rounded-[13px] flex items-center justify-center gap-2 text-[14.5px] font-semibold text-white" style={{ backgroundColor: "#25D366" }}>
                        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.747 5.634l-.999 3.648 3.741-.981z" /></svg>
                        Coordinar con un asesor
                      </a>
                    </div>
                  )}
                  {method && method !== "whatsapp" && (
                    <div className="rounded-[15px] px-1 py-1.5 mb-4" style={{ backgroundColor: "var(--surface-hover)" }}>
                      {PAY_DATA[method].map((d, i, arr) => (
                        <div key={d.k} className="flex items-center gap-3 px-3 py-2.5" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}>
                          <div className="flex-1 min-w-0">
                            <div className="text-[10.5px] uppercase tracking-wide font-medium" style={{ color: "var(--text-tertiary)" }}>{d.k}</div>
                            <div className="text-[14px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{d.v}</div>
                          </div>
                          <button onClick={() => copy(d.k, d.v)} className="flex items-center gap-1.5 h-8 px-3 rounded-[9px] text-[12px] font-semibold shrink-0 transition-colors" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: copied === d.k ? "var(--primary)" : "var(--text-secondary)" }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={copied === d.k ? "M5 13l4 4L19 7" : "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"} /></svg>
                            {copied === d.k ? "Listo" : "Copiar"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="h-px my-4" style={{ backgroundColor: "var(--border)" }} />

                  <div className="flex items-center gap-2 text-[13px] font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>2</span>
                    Ya pagué — envía tu comprobante
                  </div>

                  {!uploaded ? (
                    <>
                      <div onClick={() => fileRef.current?.click()} className="rounded-[14px] p-5 text-center cursor-pointer" style={{ border: "2px dashed var(--border)", backgroundColor: "var(--surface)" }}>
                        <svg className="w-6 h-6 mx-auto" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" /></svg>
                        <div className="text-[13.5px] font-semibold mt-2 mb-0.5" style={{ color: "var(--text-primary)" }}>Arrastra la captura aquí</div>
                        <div className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>o <span className="font-semibold underline" style={{ color: "var(--primary)" }}>selecciona un archivo</span></div>
                      </div>
                      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={pickFile} />
                      {waUrl && (
                        <div className="text-center mt-2 text-[12px]" style={{ color: "var(--text-tertiary)" }}>
                          o <a href={waUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: "var(--text-secondary)" }}>envíalo por WhatsApp</a>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-3 rounded-[13px] p-3.5" style={{ border: "1px solid var(--primary)", backgroundColor: tint }}>
                      <span className="w-[38px] h-[38px] rounded-[9px] flex items-center justify-center shrink-0" style={{ backgroundColor: tint2, color: "var(--primary)" }}>
                        <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24"><path d="M21 5H3a1 1 0 00-1 1v12a1 1 0 001 1h18a1 1 0 001-1V6a1 1 0 00-1-1zM8 8a2 2 0 110 4 2 2 0 010-4zm-3 9l4-4 2 2 4-5 5 7H5z" /></svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>{uploaded}</div>
                        <div className="text-[11.5px]" style={{ color: "var(--primary)" }}>Listo para enviar</div>
                      </div>
                      <button onClick={() => setUploaded(null)} className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-tertiary)" }}>
                        <svg className="w-[15px] h-[15px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}

                  <div className="flex items-start gap-2 mt-4 p-3 rounded-[12px]" style={{ backgroundColor: tint }}>
                    <svg className="w-[17px] h-[17px] shrink-0 mt-px" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3zm-1 13l6-6-1.4-1.4L11 12.2 8.4 9.6 7 11l4 4z" /></svg>
                    <span className="text-[12.5px] leading-snug" style={{ color: "var(--text-secondary)" }}>Revisamos tu pago y activamos tu cuenta en <b style={{ color: "var(--text-primary)" }}>menos de 24h</b>.</span>
                  </div>
                </div>
              </div>

              {/* DERECHA — resumen */}
              <div className="w-full md:w-[312px] shrink-0">
                <div className="rounded-[20px] p-5 md:sticky md:top-[84px]" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
                  {review ? (
                    <>
                      <div className="text-center pt-1.5 pb-3.5">
                        <div className="relative w-[54px] h-[54px] rounded-full flex items-center justify-center mx-auto mb-3.5" style={{ backgroundColor: tint }}>
                          <span className="co-rev absolute inset-0 rounded-full" style={{ border: "2px solid var(--primary)" }} />
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path d="M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4V2zm2 2v3.2l4 4 4-4V4H8z" /></svg>
                        </div>
                        <div className="text-[17px] font-semibold mb-1.5" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>En revisión</div>
                        <div className="text-[13px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>Recibimos tu comprobante. Te avisamos por correo y en la app apenas activemos tu cuenta.</div>
                      </div>
                      <div className="h-px my-2.5" style={{ backgroundColor: "var(--border)" }} />
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium" style={{ color: "var(--text-secondary)" }}>Plan {planName}</span>
                        <span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>{amount}</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2.5 mb-4">
                        <span className="w-8 h-8 rounded-[9px] flex items-center justify-center text-white shrink-0" style={{ backgroundColor: "var(--primary)" }}>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l1.8 4.6L18 8.4l-4.2 1.8L12 15l-1.8-4.8L6 8.4l4.2-1.8L12 2z" /></svg>
                        </span>
                        <span className="text-[16px] font-semibold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Plan Plus</span>
                      </div>
                      <div className="flex flex-col gap-2.5 mb-4">
                        {TOP_FEATS.map((t) => (
                          <div key={t} className="flex items-center gap-2.5">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24" style={{ color: "var(--primary)" }}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span className="text-[13px]" style={{ color: "var(--text-secondary)" }}>{t}</span>
                          </div>
                        ))}
                      </div>
                      <div className="h-px mb-3.5" style={{ backgroundColor: "var(--border)" }} />
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[13.5px] font-medium" style={{ color: "var(--text-secondary)" }}>Plan {planName}</span>
                        <span className="text-[13.5px]" style={{ color: "var(--text-primary)" }}>{amount} · {days} días</span>
                      </div>
                      <div className="flex items-baseline justify-between mb-4">
                        <span className="text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>A pagar hoy</span>
                        <span className="text-[30px] font-bold" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>{amount}</span>
                      </div>
                      <button onClick={submitCheckout} className="w-full h-12 rounded-[13px] text-[15px] font-semibold text-white flex items-center justify-center gap-2 transition-transform active:scale-[.985]" style={{ backgroundColor: "var(--primary)", boxShadow: "0 5px 16px color-mix(in srgb, var(--primary) 28%, transparent)" }}>
                        {uploaded ? (
                          <><svg className="w-[17px] h-[17px]" fill="currentColor" viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z" /></svg>Enviar comprobante</>
                        ) : (
                          <><svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Ya pagué</>
                        )}
                      </button>
                      <div className="text-[11.5px] leading-relaxed mt-3 text-center" style={{ color: "var(--text-tertiary)" }}>Activación manual en &lt;24h. Pago único por el período elegido — sin cobros automáticos. Al continuar aceptas los términos.</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================== CUPÓN ===================== */}
        {screen === "coupon" && (
          <div className="max-w-[460px] mx-auto px-5 sm:px-8 pt-14 pb-16">
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setScreen("plans")} className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--surface-hover)]" style={{ border: "1px solid var(--border)", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h2 className="text-[22px] font-bold leading-tight" style={{ color: "var(--text-primary)", fontFamily: "'Bricolage Grotesque', Inter, sans-serif" }}>Añadir cupón</h2>
            </div>
            <p className="text-[14px] leading-relaxed mb-4" style={{ color: "var(--text-secondary)" }}>¿Tienes un código? Canjéalo para activar tu beneficio al instante.</p>
            <form onSubmit={applyCoupon} className="flex gap-2">
              <input ref={couponRef} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MLF-XXXXXX"
                className="flex-1 h-12 rounded-[12px] px-4 text-[14px] font-semibold tracking-wider uppercase outline-none"
                style={{ backgroundColor: "var(--surface-hover)", border: "1.5px solid var(--border)", color: "var(--text-primary)" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }} />
              <button type="submit" disabled={loading || !code.trim()} className="h-12 px-5 rounded-[12px] text-[14px] font-semibold text-white disabled:opacity-50" style={{ backgroundColor: "var(--primary)" }}>
                {loading ? "…" : "Canjear"}
              </button>
            </form>
            {error && <div className="text-[12.5px] mt-3" style={{ color: "var(--danger)" }}>{error}</div>}
            {success && <div className="text-[12.5px] mt-3 font-semibold" style={{ color: "var(--primary)" }}>{success}</div>}
          </div>
        )}
    </div>
  );
}
