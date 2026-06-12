import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Feed público de descubrimiento ("Tendencias") para la home deslogueada.
//
// 100% dinámico: se alimenta de query_events (cada pregunta escrita o tarjeta
// tocada en el producto). Mientras el volumen real es bajo, se mezcla con
// semillas curadas; los datos reales van desplazando a las semillas solos
// conforme crece el tráfico. Los contadores ("N hoy") solo se muestran cuando
// son reales y superan el umbral — nunca se inventan números.
// ============================================================================

export type FeedCard = {
  prompt: string;
  categoryId: string;
  categoryLabel: string;
  /** Conteo real de las últimas 48h; null = sin volumen suficiente (semilla) */
  count: number | null;
};

export type FeedRecentItem = {
  prompt: string;
  city: string | null;
  minutesAgo: number | null; // null = semilla, no mostrar tiempo
};

export type PublicFeed = {
  featured: FeedCard;
  trending: FeedCard[];
  nearYou: { city: string | null; prompts: string[] };
  recent: FeedRecentItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  comida: "Comida",
  servicios: "Servicios",
  ofertas: "Ofertas",
  tramites: "Trámites",
  negocios: "Negocios",
  salud: "Salud",
  general: "Popular",
};

// Mínimo de repeticiones reales para mostrar contador / destronar semillas.
const MIN_REAL_COUNT = 3;
const TRENDING_CARDS = 4;
const RECENT_ITEMS = 3;
const NEARBY_PROMPTS = 4;

// Semillas curadas (cold start) ----------------------------------------------
const SEED_FEATURED: FeedCard = {
  prompt: "¿A cuánto está el dólar hoy?",
  categoryId: "general",
  categoryLabel: "Popular",
  count: null,
};

const SEED_TRENDING: FeedCard[] = [
  { prompt: "Cita en el Saime paso a paso", categoryId: "tramites", categoryLabel: "Trámites", count: null },
  { prompt: "¿Qué delivery está abierto ahora?", categoryId: "comida", categoryLabel: "Comida", count: null },
  { prompt: "¿En qué emprender con poco capital?", categoryId: "negocios", categoryLabel: "Negocios", count: null },
  { prompt: "Farmacias de turno cerca de mí", categoryId: "salud", categoryLabel: "Salud", count: null },
  { prompt: "¿Dónde reparan teléfonos en mi zona?", categoryId: "servicios", categoryLabel: "Servicios", count: null },
  { prompt: "Promociones 2x1 en comida hoy", categoryId: "ofertas", categoryLabel: "Ofertas", count: null },
];

const SEED_NEARBY: Record<string, string[]> = {
  Maracay: [
    "Mejores arepas de Maracay",
    "¿Qué hacer un domingo en Maracay?",
    "Gimnasios económicos en Maracay",
    "Repuestos en la Av. Bolívar",
  ],
  Caracas: [
    "¿Dónde comer bien en Chacao?",
    "Parques para llevar niños en Caracas",
    "Cotillones cerca de La Candelaria",
    "Metro de Caracas: rutas y horarios",
  ],
  Valencia: [
    "Mejores panaderías de Valencia",
    "¿Qué hacer en el Parque Negra Hipólita?",
    "Talleres mecánicos confiables en Valencia",
    "Delivery de sushi en Valencia",
  ],
  default: [
    "Mejores arepas cerca de mí",
    "¿Qué hacer este fin de semana?",
    "Delivery abierto ahora",
    "Servicios a domicilio confiables",
  ],
};

const SEED_RECENT: FeedRecentItem[] = [
  { prompt: "¿Cómo sacar el RIF por primera vez?", city: "Valencia", minutesAgo: null },
  { prompt: "Receta de tequeños para vender", city: "Caracas", minutesAgo: null },
  { prompt: "¿Qué hacer un domingo en Maracay?", city: "Maracay", minutesAgo: null },
];

// Sanitizado ------------------------------------------------------------------
// El feed muestra texto escrito por usuarios: filtramos datos personales,
// enlaces, groserías comunes y textos demasiado cortos o largos.
const BLOCKED_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /@[\w.]+/, // emails / handles
  /\d{6,}/, // teléfonos, cédulas
  /\b(coño|verga|mmg|mamague|marico|maldit[oa]|put[oa]|mierda|joder|carajo)\b/i,
];

export function sanitizePrompt(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  if (collapsed.length < 12 || collapsed.length > 90) return null;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(collapsed)) return null;
  }
  // Capitalizar la primera letra; respetar signos de apertura.
  const first = collapsed.search(/[a-záéíóúñ]/i);
  if (first === -1) return null;
  return (
    collapsed.slice(0, first) +
    collapsed.charAt(first).toUpperCase() +
    collapsed.slice(first + 1)
  );
}

function normalizeKey(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type EventRow = {
  prompt: string;
  category_id: string | null;
  city: string | null;
  created_at: string;
};

function labelFor(categoryId: string | null): { id: string; label: string } {
  const id = categoryId && CATEGORY_LABELS[categoryId] ? categoryId : "general";
  return { id, label: CATEGORY_LABELS[id] };
}

// Agregación ------------------------------------------------------------------
export async function getPublicFeed(visitorCity: string | null): Promise<PublicFeed> {
  const supabase = createClient();
  const since48h = new Date(Date.now() - 48 * 3600_000).toISOString();
  const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data } = await supabase
    .from("query_events")
    .select("prompt, category_id, city, created_at")
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(2000);

  const events: EventRow[] = data ?? [];
  const recent48h = events.filter((e) => e.created_at >= since48h);

  // Agrupar las últimas 48h por texto normalizado (solo prompts publicables)
  const groups = new Map<string, FeedCard>();
  for (const e of recent48h) {
    const clean = sanitizePrompt(e.prompt);
    if (!clean) continue;
    const key = normalizeKey(clean);
    const existing = groups.get(key);
    if (existing) {
      existing.count = (existing.count ?? 0) + 1;
    } else {
      const { id, label } = labelFor(e.category_id);
      groups.set(key, { prompt: clean, categoryId: id, categoryLabel: label, count: 1 });
    }
  }

  const ranked = [...groups.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  // Destacado: el prompt más repetido SI tiene volumen real; si no, semilla.
  const realFeatured = ranked[0] && (ranked[0].count ?? 0) >= MIN_REAL_COUNT ? ranked[0] : null;
  const featured = realFeatured ?? SEED_FEATURED;

  // Tendencias: reales con volumen primero, completadas con semillas.
  const usedPrompts = new Set([normalizeKey(featured.prompt)]);
  const trending: FeedCard[] = [];
  for (const card of ranked) {
    if (trending.length >= TRENDING_CARDS) break;
    if ((card.count ?? 0) < MIN_REAL_COUNT) break;
    const key = normalizeKey(card.prompt);
    if (usedPrompts.has(key)) continue;
    usedPrompts.add(key);
    trending.push(card);
  }
  for (const seed of SEED_TRENDING) {
    if (trending.length >= TRENDING_CARDS) break;
    const key = normalizeKey(seed.prompt);
    if (usedPrompts.has(key)) continue;
    usedPrompts.add(key);
    trending.push(seed);
  }

  // Cerca de ti: prompts reales de la ciudad del visitante (7 días); si no
  // alcanza, completar con semillas de esa ciudad (o genéricas).
  const cityKey = visitorCity && SEED_NEARBY[visitorCity] ? visitorCity : null;
  const nearbyReal: string[] = [];
  if (visitorCity) {
    const seen = new Set<string>();
    for (const e of events) {
      if (nearbyReal.length >= NEARBY_PROMPTS) break;
      if (!e.city || e.city.toLowerCase() !== visitorCity.toLowerCase()) continue;
      const clean = sanitizePrompt(e.prompt);
      if (!clean) continue;
      const key = normalizeKey(clean);
      if (seen.has(key)) continue;
      seen.add(key);
      nearbyReal.push(clean);
    }
  }
  const nearbySeeds = SEED_NEARBY[cityKey ?? "default"] ?? SEED_NEARBY.default;
  const nearYouPrompts = [...nearbyReal];
  for (const seed of nearbySeeds) {
    if (nearYouPrompts.length >= NEARBY_PROMPTS) break;
    if (nearYouPrompts.some((p) => normalizeKey(p) === normalizeKey(seed))) continue;
    nearYouPrompts.push(seed);
  }

  // Preguntando ahora: las últimas preguntas reales publicables; completar
  // con semillas (sin marca de tiempo) si hay pocas.
  const recentReal: FeedRecentItem[] = [];
  const seenRecent = new Set<string>();
  for (const e of events) {
    if (recentReal.length >= RECENT_ITEMS) break;
    const clean = sanitizePrompt(e.prompt);
    if (!clean) continue;
    const key = normalizeKey(clean);
    if (seenRecent.has(key)) continue;
    seenRecent.add(key);
    recentReal.push({
      prompt: clean,
      city: e.city,
      minutesAgo: Math.max(1, Math.round((Date.now() - new Date(e.created_at).getTime()) / 60_000)),
    });
  }
  const recent = [...recentReal];
  for (const seed of SEED_RECENT) {
    if (recent.length >= RECENT_ITEMS) break;
    if (seenRecent.has(normalizeKey(seed.prompt))) continue;
    recent.push(seed);
  }

  return {
    featured,
    trending,
    nearYou: { city: visitorCity ?? cityKey, prompts: nearYouPrompts },
    recent,
  };
}
