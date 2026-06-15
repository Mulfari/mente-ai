// src/app/api/web-context/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { shouldSearchWeb, type WebSource } from "@/lib/webSearch";

export const runtime = "nodejs";

const TAVILY_URL = "https://api.tavily.com/search";
const MAX_RESULTS = 5;
const TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 15 * 60 * 1000;

// Caché best-effort en memoria del proceso (por instancia de función). No es
// global pero corta el costo de queries repetidas dentro de una instancia.
const cache = new Map<string, { at: number; sources: WebSource[] }>();
function cacheGet(key: string): WebSource[] | null {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.sources;
  if (hit) cache.delete(key);
  return null;
}
function cacheSet(key: string, sources: WebSource[]) {
  cache.set(key, { at: Date.now(), sources });
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
  if (cached) return NextResponse.json({ used: cached.length > 0, sources: cached });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: question,
        max_results: MAX_RESULTS,
        search_depth: "basic",
        include_answer: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return NextResponse.json({ used: false, sources: [] });
    const data = await res.json();
    const sources: WebSource[] = (data.results || [])
      .slice(0, MAX_RESULTS)
      .map((r: any) => ({ title: r.title || r.url, url: r.url, snippet: r.content || "" }))
      .filter((s: WebSource) => s.url);
    cacheSet(key, sources);
    return NextResponse.json({ used: sources.length > 0, sources });
  } catch {
    // Timeout o error de red → sin grounding, el chat sigue.
    return NextResponse.json({ used: false, sources: [] });
  } finally {
    clearTimeout(timer);
  }
}
