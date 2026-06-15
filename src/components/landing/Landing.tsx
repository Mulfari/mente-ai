import Link from "next/link";
import Image from "next/image";
import Reveal from "./Reveal";
import LivePhone from "./LivePhone";
import type { AppConfig } from "@/lib/appConfig";

// ── Landing EDITORIAL ("criollo", concepto 1): papel limpio, tipografía grande
// de medios (Archivo), un solo acento bermellón, hairlines en vez de cards,
// índice tipo revista, el producto como FIGURA (incluye demo en vivo). Tema
// bloqueado en claro (página print-emulating editorial). Contenedor de scroll
// propio porque el body global está bloqueado.

const ED = {
  "--ed-bg": "#F4F2EC",
  "--ed-surface": "#FAF9F4",
  "--ed-ink": "#1A1813",
  "--ed-ink-2": "#56524A",
  "--ed-ink-3": "#8E887A",
  "--ed-line": "#E2DED3",
  "--ed-accent": "#10A37F",
  "--ed-accent-ink": "#0A7355",
  backgroundColor: "var(--ed-bg)",
  color: "var(--ed-ink)",
} as React.CSSProperties;

function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ed-accent)" }}>
      <path d="M4 5l8 14L20 5" />
    </svg>
  );
}
function Arrow({ c = "var(--ed-accent)" }: { c?: string }) {
  return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Button({ href, children, dark = false }: { href: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2 font-semibold text-[15px] px-5 py-3 lp-ease transition-transform duration-300 active:scale-[0.97]" style={{ backgroundColor: "var(--ed-accent)", color: "#FBF1EC", borderRadius: 9 }}>
      {children}
      <span className="lp-ease transition-transform duration-300 group-hover:translate-x-0.5"><Arrow c="#FBF1EC" /></span>
    </Link>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12.5px] tracking-wide" style={{ color: "var(--ed-ink-3)" }}>{children}</p>;
}

const SITE_URL = "https://www.mulfai.com.ve";

export default function Landing({ appConfig }: { appConfig: AppConfig }) {
  const { freeDailyLimit, priceWeeklyUsd, priceMonthlyUsd } = appConfig;

  // Datos estructurados (schema.org / JSON-LD). Se los come Google (resultados
  // enriquecidos con precio y FAQ) y las IAs (entienden qué es el producto, qué
  // cuesta y qué responde). Las preguntas son reales: las que un venezolano hace.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${SITE_URL}/#app`,
        name: "VeChat",
        url: SITE_URL,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web, iOS, Android",
        inLanguage: "es-VE",
        description:
          "La IA venezolana: te responde con lo de aquí y de ahorita — el dólar de hoy, lo que está pasando en el país y los trámites, en vivo. Y además, estudio, trabajo y código. En español venezolano.",
        publisher: { "@id": `${SITE_URL}/#org` },
        offers: [
          { "@type": "Offer", name: "Gratis", price: "0", priceCurrency: "USD", description: `${freeDailyLimit} mensajes al día, para siempre.` },
          { "@type": "Offer", name: "Semanal", price: String(priceWeeklyUsd), priceCurrency: "USD", description: "Mensajes ilimitados por una semana." },
          { "@type": "Offer", name: "Mensual", price: String(priceMonthlyUsd), priceCurrency: "USD", description: "Mensajes ilimitados por un mes." },
        ],
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Mulfex",
        url: SITE_URL,
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "¿Qué es VeChat?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "VeChat es la IA venezolana: un asistente que te responde con lo de aquí y de ahorita — el dólar de hoy, los trámites y la actualidad del país, en vivo — en español venezolano. Y además te ayuda con estudio, trabajo y código.",
            },
          },
          {
            "@type": "Question",
            name: "¿VeChat es gratis?",
            acceptedAnswer: {
              "@type": "Answer",
              text: `Sí. Puedes usar VeChat gratis con ${freeDailyLimit} mensajes al día. También hay un plan Semanal de ${priceWeeklyUsd} USD y uno Mensual de ${priceMonthlyUsd} USD con mensajes ilimitados.`,
            },
          },
          {
            "@type": "Question",
            name: "¿En qué se diferencia de ChatGPT?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Las IA genéricas tienen conocimiento congelado y, para lo local, te mandan a 'consultar una fuente oficial'. VeChat consulta información en vivo y te resuelve con lo de aquí: el dólar de hoy, la actualidad del país y los trámites del SAIME y el SENIAT, en tu idioma.",
            },
          },
          {
            "@type": "Question",
            name: "¿Cómo se paga VeChat?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Puedes pagar con Pago Móvil, Zelle o canjeando un cupón.",
            },
          },
          {
            "@type": "Question",
            name: "¿Necesito instalar algo?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. VeChat funciona desde el navegador, en el teléfono o en la computadora. Solo creas tu cuenta y empiezas a chatear.",
            },
          },
        ],
      },
    ],
  };

  return (
    <div className="lp-body h-[100dvh] overflow-y-auto" style={{ ...ED, overscrollBehavior: "contain" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="ed-grain" aria-hidden />

      {/* ── Masthead ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30" style={{ backgroundColor: "color-mix(in srgb, var(--ed-bg) 88%, transparent)", backdropFilter: "blur(8px)", borderBottom: "1px solid var(--ed-line)" }}>
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight text-[17px]"><Mark size={18} /> VeChat</span>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="text-[14px]" style={{ color: "var(--ed-ink-2)" }}>Entrar</Link>
            <Link href="/sign-up" className="text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ color: "var(--ed-accent-ink)" }}>Empieza gratis <Arrow c="var(--ed-accent-ink)" /></Link>
          </div>
        </div>
      </header>

      {/* ── Hero (type-led) ─────────────────────────────────────────────── */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 pt-16 sm:pt-24 pb-16">
        <Reveal>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] mb-7" style={{ color: "var(--ed-ink-3)" }}>La IA hecha en Venezuela</p>
          <h1 className="ed-display font-bold text-[3rem] leading-[1.0] sm:text-[5rem] lg:text-[5.6rem] max-w-[14ch]">
            Lo que pasa en el país, VeChat <span style={{ color: "var(--ed-accent)" }}>lo sabe</span>.
          </h1>
          <div className="mt-9 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-7">
            <p className="text-[17px] sm:text-[18px] leading-relaxed max-w-[44ch]" style={{ color: "var(--ed-ink-2)" }}>
              Del dólar a los trámites, de las hallacas a tu negocio. Pregúntale como le hablas a un pana.
            </p>
            <Link href="/sign-up" className="group inline-flex items-center gap-2.5 font-semibold text-[16px] shrink-0 pb-1.5" style={{ borderBottom: "2px solid var(--ed-accent)" }}>
              Crea tu cuenta gratis
              <span className="lp-ease transition-transform duration-300 group-hover:translate-x-0.5"><Arrow /></span>
            </Link>
          </div>
        </Reveal>
        {/* Índice tipo revista */}
        <Reveal delay={120}>
          <div className="mt-12 pt-5 flex flex-wrap gap-x-8 gap-y-2 text-[13px]" style={{ borderTop: "1px solid var(--ed-line)", color: "var(--ed-ink-2)" }}>
            <span>Dólar y bolívares</span><span>Trámites del SAIME</span><span>Recetas criollas</span><span>Estudio y trabajo</span><span>Tu negocio</span>
          </div>
        </Reveal>
      </section>

      {/* ── Statement (la tesis) ────────────────────────────────────────── */}
      <section className="py-16 sm:py-24" style={{ borderTop: "1px solid var(--ed-line)", borderBottom: "1px solid var(--ed-line)" }}>
        <div className="max-w-[1160px] mx-auto px-5 sm:px-8">
          <Reveal>
            <p className="ed-display font-medium text-[1.7rem] sm:text-[2.5rem] leading-[1.18] max-w-[24ch]">
              Las otras IA te mandan a <span style={{ color: "var(--ed-ink-3)" }}>&ldquo;consultar una fuente oficial&rdquo;</span>. VeChat <span style={{ color: "var(--ed-accent)" }}>te resuelve</span>, con lo de aquí.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── El producto como figura ─────────────────────────────────────── */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-center">
          <Reveal>
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] mb-5" style={{ color: "var(--ed-ink-3)" }}>Por dentro</p>
            <h2 className="ed-display font-bold text-[1.9rem] sm:text-[2.6rem] leading-[1.06]">
              Tu historial, a la mano. En el teléfono o la computadora.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed max-w-[40ch]" style={{ color: "var(--ed-ink-2)" }}>
              Tus temas, tus respuestas guardadas y tus conversaciones de siempre. Sin perder el hilo.
            </p>
            {/* Teléfono en vivo, como figura framed */}
            <div className="mt-9 inline-block">
              <div className="rounded-[40px] p-2" style={{ backgroundColor: "#16140F", boxShadow: "0 30px 60px -34px rgba(26,24,19,0.5)", width: 250 }}>
                <LivePhone />
              </div>
              <Caption>En el teléfono, respondiendo en vivo.</Caption>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div>
              <div className="overflow-hidden rounded-[12px]" style={{ border: "1px solid var(--ed-line)", boxShadow: "0 40px 80px -44px rgba(26,24,19,0.45)" }}>
                <Image src="/landing/app-desktop.png" alt="VeChat en el escritorio" width={1340} height={840} className="w-full h-auto block" />
              </div>
              <Caption>El escritorio, con tu historial al lado.</Caption>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Índice de lo que sabe (lista editorial, numerada) ───────────── */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--ed-line)" }}>
        <Reveal>
          <h2 className="ed-display font-bold text-[1.9rem] sm:text-[2.7rem] mb-10 max-w-[16ch]">
            Sabe de lo que aquí importa.
          </h2>
        </Reveal>
        <div className="grid md:grid-cols-2 gap-x-16">
          {[
            { n: "01", t: "Dólar y bolívares", d: "Tasas del día y conversiones al toque." },
            { n: "02", t: "Trámites del Estado", d: "SAIME, SENIAT, RIF, pasaporte, citas." },
            { n: "03", t: "Recetas criollas", d: "Tequeños, hallacas, cachapas, pabellón." },
            { n: "04", t: "Estudio y trabajo", d: "Resume, redacta, traduce, hasta código." },
            { n: "05", t: "Tu negocio", d: "Precios, costos, cuentas e ideas para vender." },
            { n: "06", t: "Te lo explica fácil", d: "En tu idioma, las veces que haga falta." },
          ].map((it, i) => (
            <Reveal key={it.n} delay={(i % 2) * 60}>
              <div className="flex gap-5 py-5" style={{ borderTop: "1px solid var(--ed-line)" }}>
                <span className="ed-display text-[15px] font-semibold pt-1" style={{ color: "var(--ed-accent-ink)" }}>{it.n}</span>
                <div>
                  <h3 className="ed-display text-[1.3rem] font-semibold leading-tight">{it.t}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: "var(--ed-ink-2)" }}>{it.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Precios (rate card editorial) ───────────────────────────────── */}
      <section className="max-w-[1160px] mx-auto px-5 sm:px-8 py-16 sm:py-24" style={{ borderTop: "1px solid var(--ed-line)" }}>
        <Reveal>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-12">
            <h2 className="ed-display font-bold text-[1.9rem] sm:text-[2.7rem] max-w-[16ch]">Empieza gratis. Mejora cuando quieras.</h2>
            <p className="text-[14px]" style={{ color: "var(--ed-ink-2)" }}>Pagas con Pago Móvil, Zelle o un cupón.</p>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3">
          {[
            { name: "Gratis", price: "$0", cad: "para siempre", f: [`${freeDailyLimit} mensajes al día`, "Conoce a Venezuela", "Historial guardado"], featured: false },
            { name: "Semanal", price: `$${priceWeeklyUsd}`, cad: "por semana", f: ["Mensajes ilimitados", "Respuestas más largas", "Para una semana fuerte"], featured: false },
            { name: "Mensual", price: `$${priceMonthlyUsd}`, cad: "por mes", f: ["Mensajes ilimitados", "El mejor precio por día", "Para usarlo a diario"], featured: true },
          ].map((p, i) => (
            <Reveal key={p.name} delay={i * 70}>
              <div className="h-full px-0 md:px-7 py-7 flex flex-col" style={{ borderTop: "1px solid var(--ed-line)", borderLeft: i === 0 ? undefined : "1px solid var(--ed-line)" }}>
                <div className="flex items-center gap-2.5">
                  <h3 className="ed-display text-[1.25rem] font-semibold">{p.name}</h3>
                  {p.featured && <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--ed-accent-ink)" }}>Recomendado</span>}
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="ed-display text-[2.4rem] font-bold">{p.price}</span>
                  <span className="text-[13px]" style={{ color: "var(--ed-ink-3)" }}>{p.cad}</span>
                </div>
                <ul className="mt-6 space-y-2.5 flex-1">
                  {p.f.map((x) => (
                    <li key={x} className="text-[14px]" style={{ color: "var(--ed-ink-2)" }}>{x}</li>
                  ))}
                </ul>
                <Link href="/sign-up" className="group mt-7 inline-flex items-center gap-2 text-[14.5px] font-semibold" style={{ color: p.featured ? "var(--ed-accent-ink)" : "var(--ed-ink)", borderBottom: `2px solid ${p.featured ? "var(--ed-accent-ink)" : "var(--ed-line)"}`, paddingBottom: 3, alignSelf: "flex-start" }}>
                  Elegir <span className="lp-ease transition-transform duration-300 group-hover:translate-x-0.5"><Arrow c={p.featured ? "var(--ed-accent-ink)" : "var(--ed-ink)"} /></span>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Cierre (contraportada oscura, único bloque invertido) ───────── */}
      <section className="px-4 sm:px-8 pb-6 pt-2">
        <Reveal>
          <div className="max-w-[1160px] mx-auto rounded-[16px] px-8 py-20 sm:py-28 text-center" style={{ backgroundColor: "#16140F", color: "#F4F2EC" }}>
            <h2 className="ed-display font-bold text-[2.3rem] sm:text-[3.4rem] leading-[1.04]">
              Tu pana digital<br />te está esperando.
            </h2>
            <div className="mt-9 flex justify-center">
              <Button href="/sign-up">Crea tu cuenta gratis</Button>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="px-5 sm:px-8 py-8">
        <div className="max-w-[1160px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[13px]" style={{ color: "var(--ed-ink-2)" }}>
          <span className="inline-flex items-center gap-2 font-semibold tracking-tight" style={{ color: "var(--ed-ink)" }}><Mark size={16} /> VeChat</span>
          <div className="flex items-center gap-5">
            <Link href="/sign-in" className="hover:opacity-70">Entrar</Link>
            <Link href="/sign-up" className="hover:opacity-70">Crear cuenta</Link>
          </div>
          <span style={{ color: "var(--ed-ink-3)" }}>La IA que sí sabe de Venezuela.</span>
        </div>
      </footer>
    </div>
  );
}
