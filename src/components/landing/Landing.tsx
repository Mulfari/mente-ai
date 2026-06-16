import type { AppConfig } from "@/lib/appConfig";
import { LANDING_HTML } from "./landingMarkup";
import "./landingDesign.css";

// ── Landing v2 — diseño importado de Claude Design (export "vechat-landing").
// Markup + CSS fieles al diseño, pero integrados: cada selector va scoped bajo
// `.lp` (no toca el chat), los CTA apuntan a /sign-up · /sign-in, los precios
// salen de appConfig y se conserva el JSON-LD para SEO. Tema bloqueado en claro
// (papel cálido), con contenedor de scroll propio porque el body global está
// bloqueado. Para re-generar markup/CSS: scripts/landing/build-landing.mjs.

const SITE_URL = "https://www.mulfai.com.ve";

export default function Landing({ appConfig }: { appConfig: AppConfig }) {
  const { freeDailyLimit, priceWeeklyUsd, priceMonthlyUsd } = appConfig;

  const markup = LANDING_HTML
    .replaceAll("__PRICE_WEEKLY__", String(priceWeeklyUsd))
    .replaceAll("__PRICE_MONTHLY__", String(priceMonthlyUsd))
    .replaceAll("__FREE_LIMIT__", String(freeDailyLimit));

  // Datos estructurados (schema.org / JSON-LD). Google (resultados enriquecidos
  // con precio y FAQ) y las IAs entienden qué es el producto, qué cuesta y qué
  // responde. Las preguntas son las que un venezolano hace de verdad.
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div
        className="lp h-[100dvh] overflow-y-auto"
        style={{ overscrollBehavior: "contain" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </>
  );
}
