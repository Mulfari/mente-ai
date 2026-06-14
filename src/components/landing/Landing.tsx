import Link from "next/link";
import Reveal from "./Reveal";
import HeroDemo from "./HeroDemo";
import type { AppConfig } from "@/lib/appConfig";

// ── Página de venta para el visitante deslogueado. Reemplaza al chat en la
// home: muestra el producto y empuja a crear cuenta. Usa los tokens del tema
// (papel cálido + verde) → hereda claro/oscuro y la marca. Su propio contenedor
// de scroll porque el <body> global está bloqueado (height:100dvh; overflow).

function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
      <path d="M4 5l8 14L20 5" />
    </svg>
  );
}

function Check() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--primary)" }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// Íconos en línea (convención del proyecto: SVG a mano, trazo 1.7).
const ICONS: Record<string, React.ReactNode> = {
  money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.4-5 3.8 0 1 1.1 1.6 2.5 1.6s2.5-.5 2.5-1.5" /></>,
  doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  pot: <><path d="M5 9h14l-1 8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9z" /><path d="M3 9h18M9 9V6a3 3 0 0 1 6 0v3" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 5v14" /></>,
  store: <><path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9l1 11h14l1-11M9 13h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></>,
};

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {ICONS[name]}
    </svg>
  );
}

const MARQUEE_A = [
  "¿A cuánto está el dólar BCV hoy?",
  "Cómo sacar el RIF en el SENIAT",
  "Receta de hallacas paso a paso",
  "¿Qué documentos pide el SAIME?",
  "Ideas para emprender con poco capital",
  "Conjuga este verbo en inglés",
];
const MARQUEE_B = [
  "Hazme un resumen de este texto",
  "¿Cómo configuro un router Wi-Fi?",
  "Precio sugerido para vender tequeños",
  "Arma mi presupuesto del mes en dólares",
  "Explícame esto como si tuviera 10 años",
  "Corrige la ortografía de este mensaje",
];

export default function Landing({ appConfig }: { appConfig: AppConfig }) {
  const { freeDailyLimit, priceWeeklyUsd, priceMonthlyUsd } = appConfig;

  return (
    <div
      className="h-[100dvh] overflow-y-auto"
      style={{ backgroundColor: "var(--background)", color: "var(--text-primary)", overscrollBehavior: "contain" }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-30 h-16 flex items-center"
        style={{
          backgroundColor: "color-mix(in srgb, var(--background) 86%, transparent)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
        }}
      >
        <nav className="w-full max-w-[1180px] mx-auto px-5 sm:px-8 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-[17px]">
            <Mark size={19} /> VeChat
          </span>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <Link href="/sign-in" className="hidden sm:inline-flex text-[14px] font-medium px-3 py-2 rounded-lg transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-secondary)" }}>
              Iniciar sesión
            </Link>
            <Link href="/sign-up" className="inline-flex items-center text-[14px] font-semibold text-white px-4 py-2.5 rounded-full transition-transform active:scale-[0.98]" style={{ backgroundColor: "var(--primary)" }}>
              Crear cuenta
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero (split asimétrico) ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="lp-halo absolute inset-0 pointer-events-none" aria-hidden />
        <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 pt-12 sm:pt-16 pb-16 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-[12.5px] font-medium px-3 py-1.5 rounded-full mb-6" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
              Hecho para Venezuela
            </p>
            <h1 className="lp-display text-[2.6rem] leading-[1.04] sm:text-[3.4rem] lg:text-[3.7rem] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>
              La IA que sí entiende
              <br />
              a <span style={{ color: "var(--primary)" }}>Venezuela</span>.
            </h1>
            <p className="mt-5 text-[16.5px] leading-relaxed max-w-[30ch] sm:max-w-[40ch]" style={{ color: "var(--text-secondary)" }}>
              Del dólar al SAIME, recetas criollas o tu negocio. Pregunta como hablas y responde al instante.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/sign-up" className="inline-flex items-center justify-center text-[15px] font-semibold text-white px-6 py-3.5 rounded-full transition-transform active:scale-[0.98]" style={{ backgroundColor: "var(--primary)" }}>
                Crear cuenta gratis
              </Link>
              <Link href="/sign-in" className="inline-flex items-center justify-center text-[15px] font-semibold px-6 py-3.5 rounded-full transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                Iniciar sesión
              </Link>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <HeroDemo />
          </Reveal>
        </div>
      </section>

      {/* ── Casos de uso (bento) ────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <Reveal>
          <h2 className="lp-display text-[2rem] sm:text-[2.6rem] font-bold tracking-tight max-w-[18ch]" style={{ color: "var(--text-primary)" }}>
            Lo que otras IA no saben, VeChat sí.
          </h2>
          <p className="mt-3 text-[16px] leading-relaxed max-w-[52ch]" style={{ color: "var(--text-secondary)" }}>
            No es un chatbot genérico. Conoce los trámites, la jerga y el día a día de aquí.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-6 gap-4">
          {/* Tile grande, relleno verde */}
          <Reveal className="md:col-span-4">
            <div className="h-full rounded-3xl p-7 sm:p-9 text-white" style={{ background: "linear-gradient(140deg, var(--primary), #0c7d60)" }}>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "rgba(255,255,255,0.16)" }}>
                <Icon name="money" />
              </div>
              <h3 className="lp-display text-[1.5rem] font-semibold">Cosas de Venezuela</h3>
              <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.85)" }}>
                Dólar y bolívares, trámites del SAIME y el SENIAT, gasolina, feriados, servicios. Lo que necesitas resolver, sin vueltas.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Dólar BCV", "Cita SAIME", "RIF", "Pasaporte", "Feriados"].map((t) => (
                  <span key={t} className="text-[12.5px] font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>{t}</span>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Recetas */}
          <Reveal className="md:col-span-2" delay={80}>
            <div className="h-full rounded-3xl p-7" style={{ backgroundColor: "var(--user-bubble)", border: "1px solid color-mix(in srgb, var(--primary) 12%, transparent)" }}>
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "var(--surface)", color: "var(--primary)" }}>
                <Icon name="pot" />
              </div>
              <h3 className="lp-display text-[1.25rem] font-semibold" style={{ color: "var(--text-primary)" }}>Recetas criollas</h3>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Tequeños, hallacas, cachapas o pabellón, con cantidades y trucos para que salgan buenos.
              </p>
            </div>
          </Reveal>

          {/* Estudia / trabaja */}
          <Reveal className="md:col-span-2" delay={40}>
            <Tile icon="book" title="Estudia y trabaja" body="Resume, redacta, traduce y hasta te ayuda con código. Tu copiloto para entregar más rápido." />
          </Reveal>
          {/* Negocio */}
          <Reveal className="md:col-span-2" delay={100}>
            <Tile icon="store" title="Tu negocio" body="Calcula precios y costos, arma cuentas y saca ideas para vender más, desde tu teléfono." />
          </Reveal>
          {/* Traduce / explica */}
          <Reveal className="md:col-span-2" delay={160}>
            <Tile icon="globe" title="Traduce y explica" body="Te lo explica fácil, en tu idioma, las veces que haga falta. Pregunta sin pena." />
          </Reveal>
        </div>
      </section>

      {/* ── Cómo funciona (3 pasos) ─────────────────────────────────────── */}
      <section className="py-16 sm:py-20" style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <Reveal>
            <h2 className="lp-display text-[2rem] sm:text-[2.6rem] font-bold tracking-tight text-center" style={{ color: "var(--text-primary)" }}>
              Empezar toma 10 segundos.
            </h2>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-3 gap-8 md:gap-6">
            {[
              { n: "1", t: "Crea tu cuenta gratis", b: "Con tu correo o con Google. Sin tarjeta, sin enredos." },
              { n: "2", t: "Pregunta lo que sea", b: "Escríbele como le hablas a un pana. Entiende el criollo." },
              { n: "3", t: "Responde al instante", b: "Y guarda tu historial para volver cuando quieras." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center lp-display text-[19px] font-bold text-white" style={{ backgroundColor: "var(--primary)" }}>
                    {s.n}
                  </div>
                  <h3 className="lp-display text-[1.2rem] font-semibold mt-5" style={{ color: "var(--text-primary)" }}>{s.t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed max-w-[34ch]" style={{ color: "var(--text-secondary)" }}>{s.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tendencias (marquee, una sola por página) ───────────────────── */}
      <section className="py-16 sm:py-24 overflow-hidden">
        <Reveal>
          <h2 className="lp-display text-[2rem] sm:text-[2.6rem] font-bold tracking-tight text-center px-5 max-w-[20ch] mx-auto" style={{ color: "var(--text-primary)" }}>
            Lo que le preguntan todos los días.
          </h2>
        </Reveal>
        <div className="mt-10 space-y-3" aria-hidden>
          {[MARQUEE_A, MARQUEE_B].map((row, ri) => (
            <div key={ri} className="relative">
              <div className={`lp-marquee ${ri === 1 ? "lp-marquee-rev" : ""}`}>
                {[...row, ...row].map((q, i) => (
                  <span
                    key={i}
                    className="mx-1.5 whitespace-nowrap text-[14px] px-4 py-2.5 rounded-full"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                  >
                    {q}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Precios ─────────────────────────────────────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-16 sm:py-20">
        <Reveal>
          <h2 className="lp-display text-[2rem] sm:text-[2.6rem] font-bold tracking-tight text-center" style={{ color: "var(--text-primary)" }}>
            Empieza gratis. Mejora cuando quieras.
          </h2>
          <p className="mt-3 text-[15.5px] text-center" style={{ color: "var(--text-secondary)" }}>
            Pagas con Pago Móvil, Zelle o un cupón. Sin contratos.
          </p>
        </Reveal>

        <div className="mt-12 grid md:grid-cols-3 gap-5 items-stretch">
          <Reveal>
            <PlanCard
              name="Gratis"
              price="$0"
              cadence="para siempre"
              features={[`${freeDailyLimit} mensajes al día`, "Conoce a Venezuela", "Tu historial guardado"]}
            />
          </Reveal>
          <Reveal delay={70}>
            <PlanCard
              name="Semanal"
              price={`$${priceWeeklyUsd}`}
              cadence="por semana"
              features={["Mensajes ilimitados", "Respuestas más largas", "Ideal para una semana fuerte"]}
            />
          </Reveal>
          <Reveal delay={140}>
            <PlanCard
              name="Mensual"
              price={`$${priceMonthlyUsd}`}
              cadence="por mes"
              featured
              features={["Mensajes ilimitados", "El mejor precio por día", "Para los que lo usan a diario"]}
            />
          </Reveal>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 pb-16 sm:pb-24">
        <Reveal>
          <div className="relative overflow-hidden max-w-[1180px] mx-auto rounded-[32px] px-8 py-16 sm:py-20 text-center text-white" style={{ background: "linear-gradient(140deg, var(--primary), #0a6f55)" }}>
            <h2 className="lp-display text-[2.1rem] sm:text-[3rem] font-bold tracking-tight leading-[1.05]">
              Tu asistente venezolano
              <br />te está esperando.
            </h2>
            <p className="mt-4 text-[16px]" style={{ color: "rgba(255,255,255,0.88)" }}>
              Gratis para empezar. Crea tu cuenta en 10 segundos.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/sign-up" className="inline-flex items-center justify-center text-[15px] font-semibold px-7 py-3.5 rounded-full transition-transform active:scale-[0.98]" style={{ backgroundColor: "#fff", color: "var(--primary)" }}>
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-5 sm:px-8 pb-10" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1180px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight">
            <Mark size={17} /> VeChat
          </span>
          <div className="flex items-center gap-5 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            <Link href="/sign-in" className="hover:underline">Iniciar sesión</Link>
            <Link href="/sign-up" className="hover:underline">Crear cuenta</Link>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>
            VeChat. La IA que sí sabe de Venezuela.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Tile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="h-full rounded-3xl p-7" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)", color: "var(--primary)" }}>
        <Icon name={icon} />
      </div>
      <h3 className="lp-display text-[1.25rem] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
    </div>
  );
}

function PlanCard({
  name, price, cadence, features, featured = false,
}: { name: string; price: string; cadence: string; features: string[]; featured?: boolean }) {
  return (
    <div
      className="h-full rounded-3xl p-7 flex flex-col"
      style={{
        backgroundColor: "var(--surface)",
        border: featured ? "2px solid var(--primary)" : "1px solid var(--border)",
        boxShadow: featured ? "0 30px 60px -34px color-mix(in srgb, var(--primary) 55%, transparent)" : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="lp-display text-[1.3rem] font-semibold" style={{ color: "var(--text-primary)" }}>{name}</h3>
        {featured && (
          <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "var(--primary)" }}>
            Recomendado
          </span>
        )}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="lp-display text-[2.4rem] font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{price}</span>
        <span className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>{cadence}</span>
      </div>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: "var(--text-secondary)" }}>
            <Check /> <span>{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/sign-up"
        className="mt-7 inline-flex items-center justify-center text-[14.5px] font-semibold py-3 rounded-full transition-transform active:scale-[0.98]"
        style={
          featured
            ? { backgroundColor: "var(--primary)", color: "#fff" }
            : { border: "1px solid var(--border)", color: "var(--text-primary)" }
        }
      >
        Crear cuenta
      </Link>
    </div>
  );
}
