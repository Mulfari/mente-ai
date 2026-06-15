// src/app/api/web-context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { shouldSearchWeb, isNewsQuery, searchIntent, type WebSource } from "@/lib/webSearch";
import { getWebDomains } from "@/lib/appConfig";

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
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ used: false, sources: [] });
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
  const domainsMap = await getWebDomains();
  const includeDomains = intent ? domainsMap[intent] : undefined;
  const tavilyBody: Record<string, unknown> = {
    query: question,
    max_results: MAX_RESULTS,
    search_depth: "advanced",
    include_answer: "advanced",
    topic: news ? "news" : "general",
  };
  if (news) tavilyBody.days = 30;
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
