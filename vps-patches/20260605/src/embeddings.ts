// Wave 1: Cohere embed-multilingual-v3 wrapper.
//
// Single-purpose module. Public API:
//   embed(text, type) -> number[]                 (single text)
//   embedBatch(texts, type) -> number[][]          (up to 96 per call)
//
// Reads COHERE_API_KEY from process.env. Throws EmbedError on any failure
// (timeout, non-2xx, missing key). Callers are expected to catch and fall
// back to the existing pg_trgm / ILIKE path — embedding failure is
// non-fatal everywhere it's used.
//
// In-process LRU-ish cache (Map, capped at 512) to avoid re-embedding the
// same text in one session. Dies on process restart — that's fine.

const COHERE_URL = "https://api.cohere.ai/v1/embed";
const MODEL = "embed-multilingual-v3.0";
const CACHE_MAX = 512;
const TIMEOUT_MS = 5_000;

export type EmbedType = "search_document" | "search_query";

export class EmbedError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "EmbedError";
  }
}

const cache = new Map<string, number[]>();

function cacheKey(text: string, type: EmbedType): string {
  return type + "::" + text;
}

function cacheGet(key: string): number[] | undefined {
  const v = cache.get(key);
  if (v) {
    // Refresh recency: delete + re-set so it moves to the back of Map order.
    cache.delete(key);
    cache.set(key, v);
  }
  return v;
}

function cachePut(key: string, value: number[]): void {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  if (cache.size > CACHE_MAX) {
    // Evict the oldest (first inserted) key. Map preserves insertion order.
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

async function cohereCall(texts: string[], inputType: EmbedType, apiKey: string): Promise<number[][]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(COHERE_URL, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        texts,
        model: MODEL,
        input_type: inputType,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new EmbedError(`cohere ${res.status}: ${body.slice(0, 200)}`);
    }
    const data: any = await res.json();
    const vectors: number[][] | undefined = data?.embeddings;
    if (!Array.isArray(vectors) || vectors.length !== texts.length) {
      throw new EmbedError("cohere: malformed response (missing or wrong-length embeddings)");
    }
    return vectors;
  } catch (err) {
    if (err instanceof EmbedError) throw err;
    if ((err as any)?.name === "AbortError") {
      throw new EmbedError(`cohere: timeout after ${TIMEOUT_MS}ms`);
    }
    throw new EmbedError("cohere: " + (err instanceof Error ? err.message : String(err)), err);
  } finally {
    clearTimeout(timer);
  }
}

export async function embed(text: string, type: EmbedType): Promise<number[]> {
  if (!text || !text.trim()) {
    throw new EmbedError("embed: empty text");
  }
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new EmbedError("embed: COHERE_API_KEY not set");
  }
  const key = cacheKey(text, type);
  const hit = cacheGet(key);
  if (hit) return hit;

  const [vec] = await cohereCall([text], type, apiKey);
  cachePut(key, vec);
  return vec;
}

export async function embedBatch(texts: string[], type: EmbedType): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > 96) {
    throw new EmbedError(`embedBatch: ${texts.length} texts exceeds Cohere max of 96`);
  }
  const apiKey = process.env.COHERE_API_KEY;
  if (!apiKey) {
    throw new EmbedError("embedBatch: COHERE_API_KEY not set");
  }

  // Cache hit fast-path: embed anything we already have, then call Cohere
  // only for the misses (in original order).
  const result: (number[] | null)[] = new Array(texts.length).fill(null);
  const missIdx: number[] = [];
  const missTexts: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i];
    if (!t || !t.trim()) {
      // Empty text can't be embedded; fill with zeros so the caller can
      // decide to skip the row. Caller should filter empties out beforehand.
      result[i] = new Array(1024).fill(0);
      continue;
    }
    const hit = cacheGet(cacheKey(t, type));
    if (hit) {
      result[i] = hit;
    } else {
      missIdx.push(i);
      missTexts.push(t);
    }
  }
  if (missTexts.length === 0) return result as number[][];

  const fresh = await cohereCall(missTexts, type, apiKey);
  for (let j = 0; j < missIdx.length; j++) {
    const vec = fresh[j];
    result[missIdx[j]] = vec;
    cachePut(cacheKey(missTexts[j], type), vec);
  }
  return result as number[][];
}
