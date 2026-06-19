// src/app/api/web-context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { shouldSearchWeb, isNewsQuery, searchIntent, localQuery, type WebSource } from "@/lib/webSearch";
import { getWebDomains } from "@/lib/appConfig";
import { fetchDolarRates, buildDolarContext } from "@/lib/dolar";
import { searchLocalBusinesses } from "@/lib/localBusinesses";

export const runtime = "nodejs";

const TAVILY_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 6;
const TIMEOUT_MS = 8000; // advanced + síntesis tarda más que basic
const CACHE_TTL_MS = 15 * 60 * 1000;

// Caché best-effort en memoria del proceso (por instancia de función). No es
// global pero corta el costo de queries repetidas dentro de una instancia.
type CacheEntry = { sources: WebSource[]; answer: string };
const cache = new Map<string, { at: number; data: CacheEntry }>();
function cacheGet(key: string): CacheEntry | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
  if (hit) cache.delete(key);
  return null;
}
function cacheSet(key: string, data: CacheEntry) {
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 500) cache.delete(cache.keys().next().value as string);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ used: false, sources: [] }, { status: 401 });

  let question = "";
  let city: string | null = null;
  let lat: number | null = null;
  let lng: number | null = null;
  try {
    const body = await req.json();
    question = typeof body.question === "string" ? body.question : "";
    city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : null;
    lat = typeof body.lat === "number" ? body.lat : null;
    lng = typeof body.lng === "number" ? body.lng : null;
  } catch {
    return NextResponse.json({ used: false, sources: [] });
  }

  // VeLocal: descubrimiento de negocios locales. Va ANTES del gate de búsqueda
  // web porque "¿dónde tomo un café?" NO dispara shouldSearchWeb. Self-gating:
  // 0 negocios → no corta y cae al flujo web/genérico de abajo.
  const lq = localQuery(question);
  if (lq) {
    const businesses = await searchLocalBusinesses({ city, term: lq.term, lat, lng });
    if (businesses.length > 0) {
      const list = businesses
        .map((b) => `${b.name}${b.category ? " (" + b.category + ")" : ""}${b.openNow ? " — abierto ahora" : ""}`)
        .join("; ");
      const answerHint =
        `Negocios locales reales (de VeLocal) para "${lq.term}"${city ? " en " + city : ""}: ${list}. ` +
        `Recomiéndalos en 1-2 frases naturales y cálidas, como un pana que conoce la zona. ` +
        `NO repitas sus datos de contacto ni horarios: ya salen en tarjetas debajo. ` +
        `Si aplica, agrega un consejo general breve.`;
      return NextResponse.json({ used: true, kind: "local_business", businesses, answerHint });
    }
  }

  // Re-chequeo server-side del detector (defensa) y guardas.
  if (!question || !shouldSearchWeb(question)) {
    return NextResponse.json({ used: false, sources: [] });
  }
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    // Feature "apagado": sin key, no se busca → el chat sigue normal.
    return NextResponse.json({ used: false, sources: [] });
  }

  const key = question.trim().toLowerCase().slice(0, 200);
  const cached = cacheGet(key);
  if (cached) return NextResponse.json({ used: cached.sources.length > 0, sources: cached.sources, answer: cached.answer });

  // Afinado de fuentes: noticias/eventos → topic "news" + ventana reciente;
  // el resto → topic "general" sesgado a Venezuela. search_depth "advanced" y
  // include_answer "advanced" para una síntesis que el modelo usa de base.
  // Trámites → restringido a dominios .gob.ve (autoritativo).
  const news = isNewsQuery(question);
  const intent = searchIntent(question);

  // Dólar: primero la fuente ESTRUCTURADA (el número real de DolarAPI), mucho
  // más confiable que esperar que una búsqueda web pesque el dato. Si la API
  // falla o expira, caemos al flujo de búsqueda web normal de abajo.
  if (intent === "dolar") {
    const rates = await fetchDolarRates();
    if (rates.length) {
      const ctx = buildDolarContext(rates);
      cacheSet(key, ctx);
      return NextResponse.json({ used: true, sources: ctx.sources, answer: ctx.answer });
    }
  }

  const domainsMap = await getWebDomains();
  const includeDomains = intent ? domainsMap[intent] : undefined;
  // El dólar es del DÍA: forzamos recencia (topic news + ventana corta) aunque
  // la frase no traiga "hoy", para no servir una tasa de hace semanas. El resto
  // de actualidad usa ventana amplia; trámites/general van sesgados a Venezuela.
  const useNews = news || intent === "dolar";
  const tavilyBody: Record<string, unknown> = {
    query: question,
    max_results: MAX_RESULTS,
    search_depth: "advanced",
    include_answer: "advanced",
    topic: useNews ? "news" : "general",
  };
  if (useNews) tavilyBody.days = intent === "dolar" ? 2 : 30;
  else tavilyBody.country = "venezuela";
  if (includeDomains && includeDomains.length) tavilyBody.include_domains = includeDomains;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(tavilyBody),
      signal: controller.signal,
    });
    if (!res.ok) return NextResponse.json({ used: false, sources: [] });
    const data = await res.json();
    const sources: WebSource[] = (data.results || [])
      .slice(0, MAX_RESULTS)
      .map((r: any) => ({ title: r.title || r.url, url: r.url, snippet: r.content || "" }))
      .filter((s: WebSource) => s.url);
    const answer = typeof data.answer === "string" ? data.answer : "";
    cacheSet(key, { sources, answer });
    return NextResponse.json({ used: sources.length > 0, sources, answer });
  } catch {
    // Timeout o error de red → sin grounding, el chat sigue.
    return NextResponse.json({ used: false, sources: [] });
  } finally {
    clearTimeout(timer);
  }
}
