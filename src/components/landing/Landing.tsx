import Link from "next/link";
import Reveal from "./Reveal";
import HeroDemo from "./HeroDemo";
import type { AppConfig } from "@/lib/appConfig";

// ── Landing de venta para el visitante deslogueado. Reemplaza al chat en la
// home. Construida con las skills design-taste-frontend + high-end-visual-design
// sobre la marca existente (papel cálido + esmeralda, tokens → claro/oscuro):
// doble bisel (Doppelrand) en las tarjetas protagonistas, nav flotante de
// vidrio, botón-dentro-de-botón, sombras ambientales tintadas, grano de
// película y revelado con masa. Su propio contenedor de scroll (el body global
// está bloqueado).

function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
      <path d="M4 5l8 14L20 5" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}

function Check() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: "var(--primary)" }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.6c0 2.4-5 1.4-5 3.8 0 1 1.1 1.6 2.5 1.6s2.5-.5 2.5-1.5" /></>,
  pot: <><path d="M5 9h14l-1 8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 9z" /><path d="M3 9h18M9 9V6a3 3 0 0 1 6 0v3" /></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z" /><path d="M4 5v14" /></>,
  store: <><path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M4 9h16M4 9l1 11h14l1-11M9 13h6" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></>,
};
function Icon({ name }: { name: string }) {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      {ICONS[name]}
    </svg>
  );
}

// Botón-dentro-de-botón (high-end): pill con la flecha en su propio círculo +
// física de hover (el círculo se desplaza en diagonal).
function CTA({ href, children, tone = "primary", size = "lg" }: { href: string; children: React.ReactNode; tone?: "primary" | "ghost" | "light"; size?: "lg" | "sm" }) {
  const pad = size === "lg" ? "pl-6 pr-2 py-2.5" : "pl-4 pr-1.5 py-1.5";
  const dot = size === "lg" ? "w-8 h-8" : "w-7 h-7";
  const base: React.CSSProperties =
    tone === "primary"
      ? { backgroundColor: "var(--primary)", color: "#fff", boxShadow: "0 20px 44px -20px color-mix(in srgb, var(--primary) 72%, transparent)" }
      : tone === "light"
      ? { backgroundColor: "#fff", color: "var(--primary)" }
      : { border: "1px solid var(--border)", color: "var(--text-primary)" };
  const dotStyle: React.CSSProperties =
    tone === "primary"
      ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
      : tone === "light"
      ? { backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" }
      : { backgroundColor: "color-mix(in srgb, var(--primary) 12%, transparent)", color: "var(--primary)" };
  return (
    <Link href={href} className={`group inline-flex items-center gap-2.5 rounded-full font-semibold lp-ease transition-transform duration-300 active:scale-[0.97] ${pad} ${size === "lg" ? "text-[15px]" : "text-[13.5px]"}`} style={base}>
      <span>{children}</span>
      <span className={`${dot} rounded-full flex items-center justify-center lp-ease transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5`} style={dotStyle}>
        <ArrowUpRight />
      </span>
    </Link>
  );
}

// Doble bisel (Doppelrand): cáscara exterior sutil + núcleo interior con su
// propio fondo y un brillo de borde superior. Sombra ambiental difusa tintada.
function Bezel({ children, radius = 30, shadow = true, innerStyle = {}, className = "" }: { children: React.ReactNode; radius?: number; shadow?: boolean; innerStyle?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={`relative h-full ${className}`}
      style={{
        borderRadius: radius,
        padding: 6,
        background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
        border: "1px solid color-mix(in srgb, var(--border) 55%, transparent)",
        boxShadow: shadow ? "0 50px 90px -55px color-mix(in srgb, var(--primary) 22%, rgba(42,37,33,0.6))" : undefined,
      }}
    >
      <div style={{ borderRadius: radius - 6, height: "100%", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4)", ...innerStyle }}>
        {children}
      </div>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--primary)" }} />
      {children}
    </span>
  );
}

const MARQUEE_A = ["¿A cuánto está el dólar BCV hoy?", "Cómo sacar el RIF en el SENIAT", "Receta de hallacas paso a paso", "¿Qué documentos pide el SAIME?", "Ideas para emprender con poco capital", "Conjuga este verbo en inglés"];
const MARQUEE_B = ["Hazme un resumen de este texto", "¿Cómo configuro un router Wi-Fi?", "Precio sugerido para vender tequeños", "Arma mi presupuesto del mes en dólares", "Explícame esto como si tuviera 10 años", "Corrige la ortografía de este mensaje"];

export default function Landing({ appConfig }: { appConfig: AppConfig }) {
  const { freeDailyLimit, priceWeeklyUsd, priceMonthlyUsd } = appConfig;

  return (
    <div className="lp-body h-[100dvh] overflow-y-auto" style={{ backgroundColor: "var(--background)", color: "var(--text-primary)", overscrollBehavior: "contain" }}>
      <div className="lp-grain" aria-hidden />

      {/* ── Nav flotante (isla de vidrio) ───────────────────────────────── */}
      <header className="sticky top-0 z-30 px-4 pt-4 sm:pt-5">
        <nav
          className="mx-auto w-full max-w-[980px] flex items-center justify-between rounded-full pl-5 pr-2.5 py-2.5"
          style={{
            backgroundColor: "color-mix(in srgb, var(--surface) 68%, transparent)",
            backdropFilter: "blur(20px) saturate(1.6)",
            WebkitBackdropFilter: "blur(20px) saturate(1.6)",
            border: "1px solid color-mix(in srgb, var(--border) 70%, transparent)",
            boxShadow: "0 16px 50px -28px rgba(42,37,33,0.5)",
          }}
        >
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-[16px] pl-1"><Mark size={18} /> VeChat</span>
          <div className="flex items-center gap-1 sm:gap-2.5">
            <Link href="/sign-in" className="hidden sm:inline-flex text-[14px] font-medium px-3 py-2 rounded-full lp-ease transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-secondary)" }}>
              Iniciar sesión
            </Link>
            <CTA href="/sign-up" size="sm">Crear cuenta</CTA>
          </div>
        </nav>
      </header>

      {/* ── Hero (editorial split) ──────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="lp-halo absolute inset-0 pointer-events-none" aria-hidden />
        <div className="relative max-w-[1180px] mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-20 sm:pb-28 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-12 items-center">
          <Reveal>
            <div className="mb-7"><Eyebrow>Hecho para Venezuela</Eyebrow></div>
            <h1 className="lp-display text-[2.7rem] leading-[1.02] sm:text-[3.6rem] lg:text-[4rem] font-bold" style={{ color: "var(--text-primary)" }}>
              La IA que sí entiende
              <br />a <span style={{ color: "var(--primary)" }}>Venezuela</span>.
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed max-w-[34ch] sm:max-w-[42ch]" style={{ color: "var(--text-secondary)" }}>
              Del dólar al SAIME, recetas criollas o tu negocio. Pregunta como hablas y responde al instante.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <CTA href="/sign-up">Crear cuenta gratis</CTA>
              <Link href="/sign-in" className="inline-flex items-center text-[15px] font-semibold px-5 py-3 rounded-full lp-ease transition-colors hover:bg-[var(--surface-hover)]" style={{ color: "var(--text-primary)" }}>
                Ya tengo cuenta
              </Link>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <Bezel radius={34}>
              <HeroDemo />
            </Bezel>
          </Reveal>
        </div>
      </section>

      {/* ── Casos de uso (bento, doble bisel en los protagonistas) ──────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <Reveal>
          <div className="mb-6"><Eyebrow>Casos de uso</Eyebrow></div>
          <h2 className="lp-display text-[2.1rem] sm:text-[2.9rem] font-bold max-w-[18ch]" style={{ color: "var(--text-primary)" }}>
            Lo que otras IA no saben, VeChat sí.
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed max-w-[54ch]" style={{ color: "var(--text-secondary)" }}>
            No es un chatbot genérico. Conoce los trámites, la jerga y el día a día de aquí.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-5">
          {/* Tile protagonista, doble bisel + núcleo verde */}
          <Reveal className="md:col-span-4">
            <Bezel radius={32}
              innerStyle={{ background: "linear-gradient(140deg, var(--primary), #0c7d60)", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" }}
            >
              <div className="p-7 sm:p-9 h-full">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "rgba(255,255,255,0.16)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                  <Icon name="money" />
                </div>
                <h3 className="lp-display text-[1.55rem] font-semibold">Cosas de Venezuela</h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed" style={{ color: "rgba(255,255,255,0.86)" }}>
                  Dólar y bolívares, trámites del SAIME y el SENIAT, gasolina, feriados, servicios. Lo que necesitas resolver, sin vueltas.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {["Dólar BCV", "Cita SAIME", "RIF", "Pasaporte", "Feriados"].map((t) => (
                    <span key={t} className="text-[12.5px] font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>{t}</span>
                  ))}
                </div>
              </div>
            </Bezel>
          </Reveal>

          {/* Recetas, doble bisel + núcleo mint */}
          <Reveal className="md:col-span-2" delay={80}>
            <Bezel radius={32}
              innerStyle={{ backgroundColor: "var(--user-bubble)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)" }}
            >
              <div className="p-7 h-full">
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "var(--surface)", color: "var(--primary)" }}>
                  <Icon name="pot" />
                </div>
                <h3 className="lp-display text-[1.3rem] font-semibold" style={{ color: "var(--text-primary)" }}>Recetas criollas</h3>
                <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  Tequeños, hallacas, cachapas o pabellón, con cantidades y trucos para que salgan buenos.
                </p>
              </div>
            </Bezel>
          </Reveal>

          {/* Tres tarjetas limpias con sombra ambiental difusa */}
          <Reveal className="md:col-span-2" delay={40}><SoftTile icon="book" title="Estudia y trabaja" body="Resume, redacta, traduce y hasta te ayuda con código. Tu copiloto para entregar más rápido." /></Reveal>
          <Reveal className="md:col-span-2" delay={100}><SoftTile icon="store" title="Tu negocio" body="Calcula precios y costos, arma cuentas y saca ideas para vender más, desde tu teléfono." /></Reveal>
          <Reveal className="md:col-span-2" delay={160}><SoftTile icon="globe" title="Traduce y explica" body="Te lo explica fácil, en tu idioma, las veces que haga falta. Pregunta sin pena." /></Reveal>
        </div>
      </section>

      {/* ── Cómo funciona ───────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28" style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
        <div className="max-w-[1180px] mx-auto px-5 sm:px-8">
          <Reveal>
            <h2 className="lp-display text-[2.1rem] sm:text-[2.9rem] font-bold text-center" style={{ color: "var(--text-primary)" }}>
              Empezar toma 10 segundos.
            </h2>
          </Reveal>
          <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-7">
            {[
              { n: "1", t: "Crea tu cuenta gratis", b: "Con tu correo o con Google. Sin tarjeta, sin enredos." },
              { n: "2", t: "Pregunta lo que sea", b: "Escríbele como le hablas a un pana. Entiende el criollo." },
              { n: "3", t: "Responde al instante", b: "Y guarda tu historial para volver cuando quieras." },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center lp-display text-[20px] font-bold text-white" style={{ backgroundColor: "var(--primary)", boxShadow: "0 22px 44px -22px color-mix(in srgb, var(--primary) 75%, transparent), inset 0 1px 0 rgba(255,255,255,0.25)" }}>
                    {s.n}
                  </div>
                  <h3 className="lp-display text-[1.25rem] font-semibold mt-5" style={{ color: "var(--text-primary)" }}>{s.t}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed max-w-[34ch]" style={{ color: "var(--text-secondary)" }}>{s.b}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tendencias (marquee) ────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 overflow-hidden">
        <Reveal>
          <h2 className="lp-display text-[2.1rem] sm:text-[2.9rem] font-bold text-center px-5 max-w-[20ch] mx-auto" style={{ color: "var(--text-primary)" }}>
            Lo que le preguntan todos los días.
          </h2>
        </Reveal>
        <div className="mt-12 space-y-3.5" aria-hidden>
          {[MARQUEE_A, MARQUEE_B].map((row, ri) => (
            <div key={ri} className={`lp-marquee ${ri === 1 ? "lp-marquee-rev" : ""}`}>
              {[...row, ...row].map((q, i) => (
                <span key={i} className="mx-1.5 whitespace-nowrap text-[14px] px-4 py-2.5 rounded-full" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)", boxShadow: "0 12px 30px -22px rgba(42,37,33,0.4)" }}>
                  {q}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Precios (doble bisel en el recomendado) ─────────────────────── */}
      <section className="max-w-[1180px] mx-auto px-5 sm:px-8 py-20 sm:py-24">
        <Reveal>
          <div className="flex justify-center mb-6"><Eyebrow>Precios</Eyebrow></div>
          <h2 className="lp-display text-[2.1rem] sm:text-[2.9rem] font-bold text-center" style={{ color: "var(--text-primary)" }}>
            Empieza gratis. Mejora cuando quieras.
          </h2>
          <p className="mt-4 text-[15.5px] text-center" style={{ color: "var(--text-secondary)" }}>
            Pagas con Pago Móvil, Zelle o un cupón. Sin contratos.
          </p>
        </Reveal>

        <div className="mt-14 grid md:grid-cols-3 gap-5 items-stretch">
          <Reveal><PlanCard name="Gratis" price="$0" cadence="para siempre" features={[`${freeDailyLimit} mensajes al día`, "Conoce a Venezuela", "Tu historial guardado"]} /></Reveal>
          <Reveal delay={70}><PlanCard name="Semanal" price={`$${priceWeeklyUsd}`} cadence="por semana" features={["Mensajes ilimitados", "Respuestas más largas", "Ideal para una semana fuerte"]} /></Reveal>
          <Reveal delay={140}><PlanCard name="Mensual" price={`$${priceMonthlyUsd}`} cadence="por mes" featured features={["Mensajes ilimitados", "El mejor precio por día", "Para los que lo usan a diario"]} /></Reveal>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 pb-20 sm:pb-28">
        <Reveal>
          <Bezel radius={40} className="max-w-[1180px] mx-auto" innerStyle={{ background: "linear-gradient(140deg, var(--primary), #0a6f55)", color: "#fff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.22)" }}>
            <div className="px-8 py-16 sm:py-24 text-center">
              <h2 className="lp-display text-[2.2rem] sm:text-[3.2rem] font-bold leading-[1.04]">
                Tu asistente venezolano
                <br />te está esperando.
              </h2>
              <p className="mt-5 text-[16.5px]" style={{ color: "rgba(255,255,255,0.9)" }}>
                Gratis para empezar. Crea tu cuenta en 10 segundos.
              </p>
              <div className="mt-9 flex justify-center">
                <CTA href="/sign-up" tone="light">Crear cuenta gratis</CTA>
              </div>
            </div>
          </Bezel>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-5 sm:px-8 pb-10" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="max-w-[1180px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight"><Mark size={17} /> VeChat</span>
          <div className="flex items-center gap-5 text-[13.5px]" style={{ color: "var(--text-secondary)" }}>
            <Link href="/sign-in" className="hover:underline">Iniciar sesión</Link>
            <Link href="/sign-up" className="hover:underline">Crear cuenta</Link>
          </div>
          <p className="text-[12.5px]" style={{ color: "var(--text-tertiary)" }}>VeChat. La IA que sí sabe de Venezuela.</p>
        </div>
      </footer>
    </div>
  );
}

// Tarjeta limpia con sombra ambiental difusa (no doble bisel, para dar ritmo).
function SoftTile({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="h-full rounded-[26px] p-7" style={{ backgroundColor: "var(--surface)", border: "1px solid color-mix(in srgb, var(--border) 70%, transparent)", boxShadow: "0 40px 70px -50px color-mix(in srgb, var(--primary) 18%, rgba(42,37,33,0.5))" }}>
      <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl mb-5" style={{ backgroundColor: "color-mix(in srgb, var(--primary) 9%, transparent)", color: "var(--primary)" }}>
        <Icon name={icon} />
      </div>
      <h3 className="lp-display text-[1.25rem] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
    </div>
  );
}

function PlanCard({ name, price, cadence, features, featured = false }: { name: string; price: string; cadence: string; features: string[]; featured?: boolean }) {
  const body = (
    <div className="h-full p-7 flex flex-col" style={featured ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.45)" } : undefined}>
      <div className="flex items-center justify-between">
        <h3 className="lp-display text-[1.35rem] font-semibold" style={{ color: "var(--text-primary)" }}>{name}</h3>
        {featured && <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full text-white" style={{ backgroundColor: "var(--primary)" }}>Recomendado</span>}
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="lp-display text-[2.6rem] font-bold" style={{ color: "var(--text-primary)" }}>{price}</span>
        <span className="text-[14px]" style={{ color: "var(--text-tertiary)" }}>{cadence}</span>
      </div>
      <ul className="mt-6 space-y-3 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: "var(--text-secondary)" }}><Check /> <span>{f}</span></li>
        ))}
      </ul>
      <div className="mt-7">
        {featured
          ? <span className="block"><CTA href="/sign-up">Crear cuenta</CTA></span>
          : <Link href="/sign-up" className="inline-flex w-full items-center justify-center text-[14.5px] font-semibold py-3 rounded-full lp-ease transition-colors hover:bg-[var(--surface-hover)]" style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}>Crear cuenta</Link>}
      </div>
    </div>
  );

  if (featured) {
    return <Bezel radius={28} innerStyle={{ backgroundColor: "var(--surface)", border: "1.5px solid var(--primary)" }}>{body}</Bezel>;
  }
  return (
    <div className="h-full rounded-[26px]" style={{ backgroundColor: "var(--surface)", border: "1px solid color-mix(in srgb, var(--border) 75%, transparent)", boxShadow: "0 40px 70px -52px rgba(42,37,33,0.5)" }}>
      {body}
    </div>
  );
}
