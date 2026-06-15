import type { MetadataRoute } from "next";

// Genera /robots.txt. Le dice a los buscadores (Google, Bing) y a los
// crawlers de IA (GPTBot de OpenAI, ClaudeBot de Anthropic, PerplexityBot,
// Google-Extended, etc.) qué pueden leer.
//
// OJO: a propósito NO bloqueamos a los bots de IA — el objetivo es justo el
// contrario, que nos lean y nos citen. La regla "*" los cubre a todos. Solo
// bloqueamos lo privado (la app logueada, el admin, las APIs) y los enlaces
// compartidos efímeros (/c/...) que caducan a las 24h y no deben indexarse.

const SITE_URL = "https://www.mulfai.com.ve";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/chat", "/admin", "/agent", "/context", "/api/", "/c/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
