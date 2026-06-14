import Link from "next/link";
import Image from "next/image";
import Reveal from "./Reveal";
import LivePhone from "./LivePhone";
import type { AppConfig } from "@/lib/appConfig";

// ── Landing OSCURA para el visitante deslogueado (su propia identidad, libre del
// tema claro del producto). Construida con la skill design-taste-frontend:
// concepto con punto de vista, mockups REALES del app (screenshots en public/
// landing), ritmo roto (sin "3 pasos" ni marquee de relleno), una sola estética
// bloqueada en oscuro. Contenedor de scroll propio (el body global está
// bloqueado). Acento: verde de marca, que sobre el oscuro brilla.

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--lp-accent)" }}>
      <path d="M4 5l8 14L20 5" />
    </svg>
  );
}
function ArrowRight() {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
function Spark() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--lp-accent)" }}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18" /></svg>;
}
function Check() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--lp-accent)" }}><path d="M20 6L9 17l-5-5" /></svg>;
}

const LP_STYLE = {
  "--lp-bg": "#0E110F",
  "--lp-surface": "#171C18",
  "--lp-surface-2": "#1E241F",
  "--lp-line": "rgba(244,243,238,0.10)",
  "--lp-accent": "#1EC98A",
  "--lp-accent-soft": "rgba(30,201,138,0.13)",
  "--lp-text": "#F3F3EE",
  "--lp-text-2": "#A6ABA2",
  "--lp-text-3": "#6E726B",
  backgroundColor: "var(--lp-bg)",
  color: "var(--lp-text)",
} as React.CSSProperties;

// Botón primario: pill verde brillante con texto casi negro (contraste alto).
function Primary({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-2 rounded-full font-semibold text-[15px] px-6 py-3.5 lp-ease transition-transform duration-300 active:scale-[0.97] ${className}`} style={{ backgroundColor: "var(--lp-accent)", color: "#06140D", boxShadow: "0 18px 50px -16px rgba(30,201,138,0.5)" }}>
      {children}
      <span className="lp-ease transition-transform duration-300 group-hover:translate-x-0.5"><ArrowRight /></span>
    </Link>
  );
}

export default function Landing({ appConfig }: { appConfig: AppConfig }) {
  const { freeDailyLimit, priceWeeklyUsd, priceMonthlyUsd } = appConfig;

  return (
    <div className="lp-body h-[100dvh] overflow-y-auto" style={{ ...LP_STYLE, overscrollBehavior: "contain" }}>
      <div className="lp-grain-dark" aria-hidden />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 px-4 pt-4">
        <nav className="mx-auto w-full max-w-[1080px] flex items-center justify-between rounded-full pl-5 pr-2 py-2.5" style={{ backgroundColor: "color-mix(in srgb, var(--lp-surface) 72%, transparent)", backdropFilter: "blur(20px) saturate(1.4)", WebkitBackdropFilter: "blur(20px) saturate(1.4)", border: "1px solid var(--lp-line)" }}>
        <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-[16px]"><Mark size={19} /> VeChat</span>
        <div className="flex items-center gap-1 sm:gap-3">
          <Link href="/sign-in" className="hidden sm:inline-flex text-[14px] font-medium px-3 py-2 rounded-full lp-ease transition-colors" style={{ color: "var(--lp-text-2)" }}>Iniciar sesión</Link>
          <Link href="/sign-up" className="inline-flex items-center text-[14px] font-semibold px-4 py-2.5 rounded-full lp-ease transition-transform active:scale-[0.97]" style={{ backgroundColor: "var(--lp-accent)", color: "#06140D" }}>Empieza gratis</Link>
        </div>
        </nav>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute pointer-events-none" aria-hidden style={{ top: "-10%", right: "-5%", width: "70%", height: "120%", background: "radial-gradient(50% 50% at 70% 30%, var(--lp-accent-soft), transparent 70%)", filter: "blur(20px)" }} />
        <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[12.5px] font-medium px-3.5 py-1.5 rounded-full mb-7" style={{ backgroundColor: "var(--lp-surface)", border: "1px solid var(--lp-line)", color: "var(--lp-text-2)" }}>
              <Spark /> La IA hecha para Venezuela
            </p>
            <h1 className="lp-display font-bold text-[2.8rem] leading-[1.02] sm:text-[3.7rem] lg:text-[4.1rem]">
              Por fin, una IA<br />que es <span style={{ color: "var(--lp-accent)" }}>de aquí</span>.
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed max-w-[40ch]" style={{ color: "var(--lp-text-2)" }}>
              Pregúntale del dólar, los trámites o las hallacas. Te responde como un pana, al instante.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Primary href="/sign-up">Crea tu cuenta gratis</Primary>
              <Link href="/sign-in" className="inline-flex items-center text-[15px] font-semibold px-5 py-3.5 rounded-full lp-ease transition-colors" style={{ color: "var(--lp-text)", border: "1px solid var(--lp-line)" }}>Iniciar sesión</Link>
            </div>
          </Reveal>

          {/* Mockup REAL del teléfono */}
          <Reveal delay={140}>
            <div className="relative mx-auto" style={{ width: 290 }}>
              <div className="absolute -inset-12 rounded-full" aria-hidden style={{ background: "radial-gradient(circle, var(--lp-accent-soft), transparent 70%)", filter: "blur(34px)" }} />
              <div className="relative rounded-[46px] p-2.5" style={{ backgroundColor: "#0A0D0B", border: "1px solid var(--lp-line)", boxShadow: "0 50px 90px -28px rgba(0,0,0,0.75)" }}>
                <LivePhone />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── El concepto: la diferencia (versus) ─────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <Reveal>
          <h2 className="lp-display font-bold text-[2.1rem] sm:text-[2.9rem] max-w-[20ch]">
            No es lo mismo preguntarle a cualquiera.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed max-w-[52ch]" style={{ color: "var(--lp-text-2)" }}>
            Las IA del mundo te mandan a "consultar una fuente oficial". VeChat te resuelve, con lo de aquí.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5">
          {[
            { q: "¿Qué papeles pide el SAIME para el pasaporte?", bad: "Los requisitos varían según el país. Te recomiendo revisar el sitio oficial de inmigración.", good: "Cédula vigente, la planilla del sistema y el pago del arancel. Te guío para sacar la cita en saime.gob.ve." },
            { q: "¿A cuánto está el dólar hoy?", bad: "No tengo acceso a datos financieros en tiempo real. Consulta una fuente actualizada.", good: "Te traigo el BCV y el paralelo del día y te lo convierto a la cantidad que necesites." },
          ].map((row, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="rounded-[24px] p-6 sm:p-8" style={{ backgroundColor: "var(--lp-surface)", border: "1px solid var(--lp-line)" }}>
                <p className="text-[15px] font-semibold mb-5" style={{ color: "var(--lp-text)" }}>
                  Tú: <span style={{ color: "var(--lp-text-2)" }}>{row.q}</span>
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-2xl p-5" style={{ backgroundColor: "color-mix(in srgb, var(--lp-bg) 60%, transparent)", border: "1px solid var(--lp-line)" }}>
                    <span className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--lp-text-3)" }}>Una IA cualquiera</span>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--lp-text-3)" }}>{row.bad}</p>
                  </div>
                  <div className="rounded-2xl p-5" style={{ backgroundColor: "var(--lp-accent-soft)", border: "1px solid color-mix(in srgb, var(--lp-accent) 35%, transparent)" }}>
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--lp-accent)" }}><Mark size={13} /> VeChat</span>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "var(--lp-text)" }}>{row.good}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Showcase de producto: mockup REAL de escritorio ─────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-24" style={{ borderTop: "1px solid var(--lp-line)", borderBottom: "1px solid var(--lp-line)", backgroundColor: "color-mix(in srgb, var(--lp-surface) 35%, transparent)" }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8 text-center">
          <Reveal>
            <h2 className="lp-display font-bold text-[2.1rem] sm:text-[2.9rem] max-w-[22ch] mx-auto">
              Tus conversaciones, todas en un solo lugar.
            </h2>
            <p className="mt-4 text-[16px] leading-relaxed max-w-[50ch] mx-auto" style={{ color: "var(--lp-text-2)" }}>
              Tu historial guardado y a la mano, en el teléfono o en la computadora.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative mt-12 max-w-[980px] mx-auto">
              <div className="absolute -inset-8 sm:-inset-16 rounded-full" aria-hidden style={{ background: "radial-gradient(circle, var(--lp-accent-soft), transparent 68%)", filter: "blur(40px)" }} />
              <div className="relative rounded-[18px] overflow-hidden" style={{ border: "1px solid var(--lp-line)", boxShadow: "0 70px 130px -45px rgba(0,0,0,0.85)" }}>
                <Image src="/landing/app-desktop.png" alt="VeChat en el escritorio" width={1340} height={840} className="w-full h-auto block" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Lo que sabe (lista editorial, no cards genéricas) ───────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-12 lg:gap-16 items-start">
          <Reveal>
            <h2 className="lp-display font-bold text-[2.1rem] sm:text-[2.9rem] leading-[1.05]">
              Sabe de lo que aquí importa.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed max-w-[40ch]" style={{ color: "var(--lp-text-2)" }}>
              No un chatbot genérico: conoce los trámites, la jerga, los precios y el día a día.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <div className="grid sm:grid-cols-2 gap-x-10">
              {[
                { t: "Dólar y bolívares", d: "Tasas del día y conversiones al toque." },
                { t: "Trámites del Estado", d: "SAIME, SENIAT, RIF, pasaporte, citas." },
                { t: "Recetas criollas", d: "Tequeños, hallacas, cachapas, pabellón." },
                { t: "Estudio y trabajo", d: "Resume, redacta, traduce, hasta código." },
                { t: "Tu negocio", d: "Precios, costos, cuentas e ideas para vender." },
                { t: "Te lo explica fácil", d: "En tu idioma, las veces que haga falta." },
              ].map((it) => (
                <div key={it.t} className="flex gap-3 py-4" style={{ borderBottom: "1px solid var(--lp-line)" }}>
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: "var(--lp-accent)" }} />
                  <div>
                    <h3 className="text-[15.5px] font-semibold" style={{ color: "var(--lp-text)" }}>{it.t}</h3>
                    <p className="text-[13.5px] mt-0.5 leading-relaxed" style={{ color: "var(--lp-text-2)" }}>{it.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Precios ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <Reveal>
          <h2 className="lp-display font-bold text-[2.1rem] sm:text-[2.9rem] text-center">
            Empieza gratis. Mejora cuando quieras.
          </h2>
          <p className="mt-4 text-[15.5px] text-center" style={{ color: "var(--lp-text-2)" }}>
            Pagas con Pago Móvil, Zelle o un cupón. Sin contratos.
          </p>
        </Reveal>
        <div className="mt-14 grid md:grid-cols-3 gap-5 items-stretch">
          <Reveal><PlanCard name="Gratis" price="$0" cadence="para siempre" features={[`${freeDailyLimit} mensajes al día`, "Conoce a Venezuela", "Tu historial guardado"]} /></Reveal>
          <Reveal delay={70}><PlanCard name="Semanal" price={`$${priceWeeklyUsd}`} cadence="por semana" features={["Mensajes ilimitados", "Respuestas más largas", "Para una semana fuerte"]} /></Reveal>
          <Reveal delay={140}><PlanCard name="Mensual" price={`$${priceMonthlyUsd}`} cadence="por mes" featured features={["Mensajes ilimitados", "El mejor precio por día", "Para usarlo a diario"]} /></Reveal>
        </div>
      </section>

      {/* ── Cierre ──────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-5 sm:px-8 pb-20 sm:pb-28">
        <div className="relative max-w-[1180px] mx-auto rounded-[32px] px-8 py-20 sm:py-28 text-center overflow-hidden" style={{ backgroundColor: "var(--lp-surface)", border: "1px solid var(--lp-line)" }}>
          <div className="absolute pointer-events-none inset-0" aria-hidden style={{ background: "radial-gradient(60% 80% at 50% 0%, var(--lp-accent-soft), transparent 70%)" }} />
          <Reveal>
            <h2 className="lp-display font-bold text-[2.3rem] sm:text-[3.2rem] leading-[1.05] relative">
              Tu pana digital<br />te está esperando.
            </h2>
            <div className="mt-9 flex justify-center relative">
              <Primary href="/sign-up">Crea tu cuenta gratis</Primary>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-5 sm:px-8 pb-10" style={{ borderTop: "1px solid var(--lp-line)" }}>
        <div className="max-w-[1180px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight"><Mark size={17} /> VeChat</span>
          <div className="flex items-center gap-5 text-[13.5px]" style={{ color: "var(--lp-text-2)" }}>
            <Link href="/sign-in" className="hover:opacity-80">Iniciar sesión</Link>
            <Link href="/sign-up" className="hover:opacity-80">Crear cuenta</Link>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--lp-text-3)" }}>VeChat. La IA que sí sabe de Venezuela.</p>
        </div>
      </footer>
    </div>
  );
}

function PlanCard({ name, price, cadence, features, featured = false }: { name: string; price: string; cadence: string; features: string[]; featured?: boolean }) {
  return (
    <div className="h-full rounded-[24px] p-7 flex flex-col" style={{ backgroundColor: featured ? "var(--lp-surface-2)" : "var(--lp-surface)", border: featured ? "1.5px solid var(--lp-accent)" : "1px solid var(--lp-line)", boxShadow: featured ? "0 40px 80px -40px rgba(30,201,138,0.35)" : "none" }}>
      <div className="flex items-center justify-between">
        <h3 className="lp-display text-[1.3rem] font-semibold">{name}</h3>
        {featured && <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: "var(--lp-accent)", color: "#06140D" }}>Recomendado</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="lp-display text-[2.5rem] font-bold">{price}</span>
        <span className="text-[14px]" style={{ color: "var(--lp-text-3)" }}>{cadence}</span>
      </div>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: "var(--lp-text-2)" }}><Check /> <span>{f}</span></li>
        ))}
      </ul>
      <Link href="/sign-up" className="mt-7 inline-flex w-full items-center justify-center text-[14.5px] font-semibold py-3 rounded-full lp-ease transition-transform active:scale-[0.98]" style={featured ? { backgroundColor: "var(--lp-accent)", color: "#06140D" } : { border: "1px solid var(--lp-line)", color: "var(--lp-text)" }}>
        Crear cuenta
      </Link>
    </div>
  );
}
