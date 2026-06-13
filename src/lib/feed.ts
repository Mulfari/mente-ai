import { createClient } from "@/lib/supabase/server";

// ============================================================================
// Feed público de descubrimiento ("Tendencias") — fase 1 del algoritmo.
//
// Se alimenta de query_events (cada pregunta escrita o tarjeta tocada).
// Ranking real, sin IA todavía:
//   - PERSONAS, no eventos: un usuario repitiendo la misma pregunta no
//     infla la tendencia (sus repeticiones pesan 15%).
//   - DECAIMIENTO temporal: lo de hace 2 horas pesa mucho más que lo de
//     ayer (exp(-edad/18h)) — tendencia = velocidad, no acumulado.
//   - PICO: si un tema hace en 6h lo que normalmente hace en días, sube
//     aunque su volumen total sea pequeño (detecta lo que está explotando).
//   - DIVERSIDAD: máximo 2 tarjetas por categoría en Tendencias.
//   - PARA TI: sección personalizada por el historial del usuario (sus
//     categorías y palabras clave) — para visitantes queda "Preguntando
//     ahora".
// Mientras el volumen real es bajo, las semillas curadas rellenan; los
// datos reales las desplazan solos. Los contadores ("N personas hoy") solo
// se muestran cuando son personas reales distintas y superan el umbral.
// ============================================================================

export type FeedCard = {
  prompt: string;
  categoryId: string;
  categoryLabel: string;
  /** Personas distintas en 48h; null = sin volumen suficiente (semilla).
      Se mantiene internamente para derivar `signal`, pero el cliente ya NO
      lo muestra como número crudo ("15 personas") — usa la señal de barras. */
  count: number | null;
  /** Nivel de intensidad para el indicador de señal: 0 = semilla (sin
      barras), 1/2/3 = relativo dentro de los temas reales del feed. */
  signal: 0 | 1 | 2 | 3;
};

export type FeedRecentItem = {
  prompt: string;
  city: string | null;
  minutesAgo: number | null; // null = semilla, no mostrar tiempo
};

export type FeedForYouItem = {
  prompt: string;
  categoryId: string;
  categoryLabel: string;
  /** "tuyo" = retomar algo que el usuario preguntó; "afin" = recomendado */
  reason: "tuyo" | "afin";
};

export type PublicFeed = {
  featured: FeedCard;
  trending: FeedCard[];
  nearYou: { city: string | null; prompts: string[] };
  recent: FeedRecentItem[];
  /** Solo usuarios con historial; null => el cliente muestra "Preguntando ahora" */
  forYou: { items: FeedForYouItem[] } | null;
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

// Umbral de PERSONAS distintas (48h) para mostrar contador / destronar semillas.
const MIN_REAL_PEOPLE = 3;
const TRENDING_CARDS = 8;
const RECENT_ITEMS = 3;
const NEARBY_PROMPTS = 4;
const FORYOU_ITEMS = 4;
const MAX_PER_CATEGORY = 2;

// Parámetros del ranking.
const DECAY_TAU_HOURS = 18; // vida media efectiva del interés
const REPEAT_WEIGHT = 0.15; // peso de los envíos repetidos del mismo usuario
const ANON_WEIGHT = 0.4; // peso de eventos anónimos (no podemos distinguirlos)
const ANON_CAP = 1.5; // tope de contribución anónima por tema
const SPIKE_BONUS = 0.35; // hasta +105% (spike capped 3x)

// Semillas curadas (cold start) ----------------------------------------------
const SEED_FEATURED: FeedCard = {
  prompt: "¿A cuánto está el dólar hoy?",
  categoryId: "general",
  categoryLabel: "Popular",
  count: null,
  signal: 0,
};

const SEED_TRENDING: FeedCard[] = [
  { prompt: "Cita en el Saime paso a paso", categoryId: "tramites", categoryLabel: "Trámites", count: null, signal: 0 },
  { prompt: "¿Qué delivery está abierto ahora?", categoryId: "comida", categoryLabel: "Comida", count: null, signal: 0 },
  { prompt: "¿En qué emprender con poco capital?", categoryId: "negocios", categoryLabel: "Negocios", count: null, signal: 0 },
  { prompt: "Farmacias de turno cerca de mí", categoryId: "salud", categoryLabel: "Salud", count: null, signal: 0 },
  { prompt: "¿Dónde reparan teléfonos en mi zona?", categoryId: "servicios", categoryLabel: "Servicios", count: null, signal: 0 },
  { prompt: "Promociones 2x1 en comida hoy", categoryId: "ofertas", categoryLabel: "Ofertas", count: null, signal: 0 },
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
  const first = collapsed.search(/[a-záéíóúñ]/i);
  if (first === -1) return null;
  return (
    collapsed.slice(0, first) +
    collapsed.charAt(first).toUpperCase() +
    collapsed.slice(first + 1)
  );
}

export function normalizeKey(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[¿?¡!.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCity(city: string | null): string | null {
  if (!city) return null;
  const c = city.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return c || null;
}

// Palabras clave para la afinidad de "Para ti" (sin stopwords comunes).
const STOPWORDS = new Set([
  "para", "como", "donde", "cuando", "cuanto", "cuanta", "esta", "este", "esto",
  "estan", "puedo", "hacer", "tiene", "tengo", "sobre", "cerca", "ahora", "saber",
  "cual", "cuales", "quien", "porque", "entre", "desde", "hasta", "mejor", "mejores",
  "venezuela", "caracas", "maracay", "valencia", "zona", "hoy",
]);

export function keywordsOf(prompt: string): Set<string> {
  const words = normalizeKey(prompt).split(" ");
  const out = new Set<string>();
  for (const w of words) {
    if (w.length >= 4 && !STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

// Extracción barata de tags de interés de una pregunta: devuelve la clave
// normalizada (para deduplicar/agrupar) + una etiqueta legible (la palabra
// original capitalizada). Es el aprendizaje "en vivo" — el cron del feed lo
// pule luego con IA (junta sinónimos, mejora las etiquetas).
export function extractTags(prompt: string): { tag: string; label: string }[] {
  const original = prompt.replace(/[¿?¡!.,;:"'()]/g, " ").replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const out: { tag: string; label: string }[] = [];
  for (const word of original.split(" ")) {
    const tag = normalizeKey(word);
    if (tag.length < 4 || STOPWORDS.has(tag) || seen.has(tag)) continue;
    seen.add(tag);
    const label = word.charAt(0).toLocaleUpperCase("es") + word.slice(1).toLocaleLowerCase("es");
    out.push({ tag, label });
    if (out.length >= 4) break; // máx. 4 tags por búsqueda
  }
  return out;
}

// Top tags de interés de un usuario como lista de etiquetas (pinned primero,
// luego por weight). Se materializa en user_context.interests para que el
// chat (que lee esa columna) reciba el perfil, y para mostrar en "Mi contexto".
export async function materializeInterests(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  limit = 10
): Promise<string> {
  const { data } = await supabase
    .from("user_interests")
    .select("label, pinned, weight")
    .eq("user_id", userId)
    .order("pinned", { ascending: false })
    .order("weight", { ascending: false })
    .limit(limit);
  const labels = (data ?? []).map((r) => (r.label as string).trim()).filter(Boolean);
  const joined = labels.join(", ");
  // Upsert manual (user_context.user_id no tiene unique constraint): si la
  // fila existe se actualiza, si no se crea — un usuario nuevo puede no tener
  // contexto todavía y el chat lee esta columna.
  const { data: existing } = await supabase
    .from("user_context")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("user_context")
      .update({ interests: joined, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("user_context").insert({ user_id: userId, interests: joined });
  }
  return joined;
}

export type EventRow = {
  prompt: string;
  category_id: string | null;
  city: string | null;
  created_at: string;
  user_id: string | null;
};

export function labelFor(categoryId: string | null): { id: string; label: string } {
  const id = categoryId && CATEGORY_LABELS[categoryId] ? categoryId : "general";
  return { id, label: CATEGORY_LABELS[id] };
}

// Tema agregado. En fase 1 la agrupación es por texto normalizado; el cron
// de fase 2 (feedDigest) remapea los eventos a temas canónicos con IA y
// materializa el resultado en feed_cache — getPublicFeed lo usa si existe.
export type Topic = {
  key: string;
  prompt: string;
  categoryId: string;
  categoryLabel: string;
  score: number;
  /** personas distintas con actividad en 48h (anónimos cuentan máx. 1) */
  people48h: number;
  cities: Map<string, number>; // ciudad normalizada -> peso
  keywords: Set<string>;
  lastAt: number;
};

export function buildTopics(events: EventRow[], now: number): Map<string, Topic> {
  const topics = new Map<string, Topic>();
  // por tema: peso ya aportado por cada usuario (para descontar repetidos)
  const perTopicUsers = new Map<string, Map<string, number>>();
  const perTopicAnon = new Map<string, number>();
  const people48hSets = new Map<string, Set<string>>();
  const recentWeight = new Map<string, number>(); // últimas 6h (pico)
  const olderWeight = new Map<string, number>(); // resto de la semana

  for (const e of events) {
    const clean = sanitizePrompt(e.prompt);
    if (!clean) continue;
    const key = normalizeKey(clean);
    const ageHours = (now - new Date(e.created_at).getTime()) / 3_600_000;
    if (ageHours < 0 || ageHours > 7 * 24) continue;

    let topic = topics.get(key);
    if (!topic) {
      const { id, label } = labelFor(e.category_id);
      topic = {
        key,
        prompt: clean,
        categoryId: id,
        categoryLabel: label,
        score: 0,
        people48h: 0,
        cities: new Map(),
        keywords: keywordsOf(clean),
        lastAt: 0,
      };
      topics.set(key, topic);
      perTopicUsers.set(key, new Map());
      perTopicAnon.set(key, 0);
      people48hSets.set(key, new Set());
    }
    // Si algún evento del tema trae categoría real, adoptarla (los typed van sin ella).
    if (topic.categoryId === "general" && e.category_id && CATEGORY_LABELS[e.category_id]) {
      topic.categoryId = e.category_id;
      topic.categoryLabel = CATEGORY_LABELS[e.category_id];
    }

    const decay = Math.exp(-ageHours / DECAY_TAU_HOURS);
    let weight: number;
    if (e.user_id) {
      const users = perTopicUsers.get(key)!;
      const prior = users.get(e.user_id) ?? 0;
      weight = decay * (prior > 0 ? REPEAT_WEIGHT : 1);
      users.set(e.user_id, prior + 1);
      if (ageHours <= 48) people48hSets.get(key)!.add(e.user_id);
    } else {
      const used = perTopicAnon.get(key)!;
      weight = Math.min(decay * ANON_WEIGHT, Math.max(0, ANON_CAP - used));
      perTopicAnon.set(key, used + weight);
      if (ageHours <= 48) people48hSets.get(key)!.add("__anon__");
    }

    topic.score += weight;
    if (ageHours <= 6) recentWeight.set(key, (recentWeight.get(key) ?? 0) + weight);
    else olderWeight.set(key, (olderWeight.get(key) ?? 0) + weight);

    const city = normalizeCity(e.city);
    if (city) topic.cities.set(city, (topic.cities.get(city) ?? 0) + weight);
    const ts = new Date(e.created_at).getTime();
    if (ts > topic.lastAt) topic.lastAt = ts;
  }

  // Bonus de pico: ritmo de las últimas 6h vs. el ritmo medio previo.
  for (const [key, topic] of topics) {
    const recent = recentWeight.get(key) ?? 0;
    const older = olderWeight.get(key) ?? 0;
    const baseline = older / 27 + 0.25; // 27 ventanas de 6h restantes en 7d
    const spike = Math.min(recent / baseline, 3);
    topic.score *= 1 + SPIKE_BONUS * spike;
    topic.people48h = people48hSets.get(key)!.size;
  }
  return topics;
}

// Serialización de temas para feed_cache (Map/Set -> JSON y de vuelta).
export type SerializedTopic = {
  key: string;
  prompt: string;
  categoryId: string;
  categoryLabel: string;
  score: number;
  people48h: number;
  cities: Record<string, number>;
  keywords: string[];
  lastAt: number;
};

export function serializeTopics(topics: Topic[]): SerializedTopic[] {
  return topics.map((t) => ({
    key: t.key,
    prompt: t.prompt,
    categoryId: t.categoryId,
    categoryLabel: t.categoryLabel,
    score: t.score,
    people48h: t.people48h,
    cities: Object.fromEntries(t.cities),
    keywords: [...t.keywords],
    lastAt: t.lastAt,
  }));
}

export function deserializeTopics(s: SerializedTopic[]): Topic[] {
  return s.map((t) => ({
    key: t.key,
    prompt: t.prompt,
    categoryId: t.categoryId,
    categoryLabel: t.categoryLabel,
    score: t.score,
    people48h: t.people48h,
    cities: new Map(Object.entries(t.cities)),
    keywords: new Set(t.keywords),
    lastAt: t.lastAt,
  }));
}

// La caché materializada por el cron vale hasta 26h (cron diario + margen);
// después se ignora y se agrega en vivo (fase 1) como respaldo.
const CACHE_MAX_AGE_MS = 26 * 3600_000;

// Agregación ------------------------------------------------------------------
export async function getPublicFeed(
  visitorCity: string | null,
  userId: string | null = null
): Promise<PublicFeed> {
  const supabase = createClient();
  const now = Date.now();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();

  // 1) Temas: primero la caché materializada del cron (temas canónicos,
  //    agrupados con IA); si no existe o está vieja, agregación en vivo.
  let topics: Map<string, Topic> | null = null;
  try {
    const { data: cacheRow, error } = await supabase
      .from("feed_cache")
      .select("payload, updated_at")
      .eq("id", "topics")
      .maybeSingle();
    if (!error && cacheRow && now - new Date(cacheRow.updated_at).getTime() < CACHE_MAX_AGE_MS) {
      const arr = (cacheRow.payload as { topics?: SerializedTopic[] } | null)?.topics;
      if (arr && arr.length > 0) {
        topics = new Map(deserializeTopics(arr).map((t) => [t.key, t]));
      }
    }
  } catch { /* tabla aún no migrada — respaldo en vivo */ }
  const fromCache = topics !== null;

  const { data } = await supabase
    .from("query_events")
    .select("prompt, category_id, city, created_at, user_id")
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(fromCache ? 100 : 3000);

  const events: EventRow[] = data ?? [];
  if (!topics) topics = buildTopics(events, now);
  const ranked = [...topics.values()].sort((a, b) => b.score - a.score);
  const qualifying = ranked.filter((t) => t.people48h >= MIN_REAL_PEOPLE);

  const toCard = (t: Topic): FeedCard => ({
    prompt: t.prompt,
    categoryId: t.categoryId,
    categoryLabel: t.categoryLabel,
    count: t.people48h >= MIN_REAL_PEOPLE ? t.people48h : null,
    signal: 0, // se asigna por posición más abajo
  });

  // Destacado: el tema con más score SI tiene personas reales; si no, semilla.
  // Copia de la semilla: abajo se muta .signal y SEED_FEATURED es compartido.
  const featured = qualifying[0] ? toCard(qualifying[0]) : { ...SEED_FEATURED };

  // Tendencias: reales calificados con tope por categoría, semillas rellenan.
  const usedPrompts = new Set([normalizeKey(featured.prompt)]);
  const categoryCount = new Map<string, number>();
  const trending: FeedCard[] = [];
  for (const t of qualifying) {
    if (trending.length >= TRENDING_CARDS) break;
    if (usedPrompts.has(t.key)) continue;
    const inCat = categoryCount.get(t.categoryId) ?? 0;
    if (inCat >= MAX_PER_CATEGORY) continue; // diversidad
    usedPrompts.add(t.key);
    categoryCount.set(t.categoryId, inCat + 1);
    trending.push(toCard(t));
  }
  // Las semillas solo rellenan hasta 4 tarjetas (los temas reales pueden
  // llegar a 8): una fila llena de semillas se vería inflada artificialmente.
  for (const seed of SEED_TRENDING) {
    if (trending.length >= 4) break;
    const key = normalizeKey(seed.prompt);
    if (usedPrompts.has(key)) continue;
    usedPrompts.add(key);
    trending.push({ ...seed });
  }

  // Señal por POSICIÓN (no por conteo): el feed ya está ordenado por
  // relevancia, así que las primeras tarjetas son las más fuertes. Es un
  // indicador de prominencia relativa, SIEMPRE visible (nunca un número),
  // que vive aunque el tráfico sea bajo. Destacado = 3 barras.
  featured.signal = 3;
  for (let i = 0; i < trending.length; i++) {
    trending[i] = { ...trending[i], signal: i < 2 ? 3 : i < 5 ? 2 : 1 };
  }

  // Cerca de ti: LOCAL de verdad — temas con actividad real en la ciudad de
  // la persona (no "Venezuela"). Prioridad:
  //   1) temas reales atados a SU ciudad (por score);
  //   2) si faltan, las semillas curadas de ESA ciudad;
  //   3) solo si NO hubo ningún tema real local, las semillas "cerca de mí"
  //      (genéricas pero localmente enmarcadas) — para no dejar el bloque
  //      vacío en cold-start. Si ya hay reales, NO se diluye con genéricas.
  const cityNorm = normalizeCity(visitorCity);
  const cityKey = visitorCity && SEED_NEARBY[visitorCity] ? visitorCity : null;
  const nearbyReal: string[] = [];
  if (cityNorm) {
    for (const t of ranked) {
      if (nearbyReal.length >= NEARBY_PROMPTS) break;
      if (!t.cities.has(cityNorm)) continue;
      nearbyReal.push(t.prompt);
    }
  }
  const nearYouPrompts = [...nearbyReal];
  // Padding: semillas de la ciudad si existen; genéricas solo en cold-start.
  const citySeeds = cityKey ? SEED_NEARBY[cityKey] : null;
  const padSeeds = citySeeds ?? (nearbyReal.length === 0 ? SEED_NEARBY.default : []);
  for (const seed of padSeeds) {
    if (nearYouPrompts.length >= NEARBY_PROMPTS) break;
    if (nearYouPrompts.some((p) => normalizeKey(p) === normalizeKey(seed))) continue;
    nearYouPrompts.push(seed);
  }

  // Preguntando ahora: últimas preguntas reales publicables + semillas.
  // Con el diccionario canónico disponible, cada entrada se muestra con su
  // versión limpia reescrita por el digest en vez del texto crudo.
  let recentAlias = new Map<string, string>();
  if (fromCache && events.length > 0) {
    try {
      const candidateKeys = [...new Set(
        events
          .map((e) => sanitizePrompt(e.prompt))
          .filter((p): p is string => p !== null)
          .map((p) => normalizeKey(p))
      )].slice(0, 20);
      if (candidateKeys.length > 0) {
        const { data: al } = await supabase
          .from("feed_topic_aliases")
          .select("key, topic_key")
          .in("key", candidateKeys);
        recentAlias = new Map((al ?? []).map((a) => [a.key as string, a.topic_key as string]));
      }
    } catch { /* sin tabla aún */ }
  }
  const recentReal: FeedRecentItem[] = [];
  const seenRecent = new Set<string>();
  for (const e of events) {
    if (recentReal.length >= RECENT_ITEMS) break;
    const clean = sanitizePrompt(e.prompt);
    if (!clean) continue;
    const key = normalizeKey(clean);
    const topicKey = recentAlias.get(key);
    const canonical = topicKey ? topics.get(topicKey)?.prompt ?? clean : clean;
    const dedupeKey = topicKey ?? key;
    if (seenRecent.has(dedupeKey)) continue;
    seenRecent.add(dedupeKey);
    // "Preguntando ahora" se muestra limpio: solo la pregunta (sin tiempo ni
    // ciudad), así que no calculamos esos campos.
    recentReal.push({ prompt: canonical, city: null, minutesAgo: null });
  }
  const recent = [...recentReal];
  for (const seed of SEED_RECENT) {
    if (recent.length >= RECENT_ITEMS) break;
    if (seenRecent.has(normalizeKey(seed.prompt))) continue;
    recent.push(seed);
  }

  // Para ti: según el PERFIL DE INTERESES del usuario — sus tags aprendidos
  // (user_interests, que se actualizan en vivo y se pulen con IA) + su
  // historial reciente. Recomienda temas afines que aún no ha preguntado.
  let forYou: PublicFeed["forYou"] = null;
  if (userId) {
    const since30d = new Date(now - 30 * 86_400_000).toISOString();
    const [{ data: mine }, { data: myTags }] = await Promise.all([
      supabase
        .from("query_events")
        .select("prompt, category_id, created_at")
        .eq("user_id", userId)
        .gte("created_at", since30d)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("user_interests")
        .select("tag, weight")
        .eq("user_id", userId)
        .order("weight", { ascending: false })
        .limit(40),
    ]);

    const myEvents = mine ?? [];
    const interestTags = (myTags ?? []).map((r) => r.tag as string);
    if (myEvents.length > 0 || interestTags.length > 0) {
      // Perfil de interés: tags aprendidos + categorías y palabras del historial.
      const myCategories = new Map<string, number>();
      const myKeywords = new Set<string>(interestTags); // los tags persistentes pesan
      const myKeys = new Set<string>();
      const myOwn: { prompt: string; categoryId: string }[] = [];
      for (const e of myEvents) {
        const clean = sanitizePrompt(e.prompt);
        if (!clean) continue;
        const key = normalizeKey(clean);
        if (e.category_id && CATEGORY_LABELS[e.category_id]) {
          myCategories.set(e.category_id, (myCategories.get(e.category_id) ?? 0) + 1);
        }
        for (const w of keywordsOf(clean)) myKeywords.add(w);
        if (!myKeys.has(key)) {
          myKeys.add(key);
          myOwn.push({ prompt: clean, categoryId: e.category_id ?? "general" });
        }
      }

      // Con temas canónicos (caché del cron), traducir las claves crudas del
      // usuario a sus temas vía alias — para no recomendarle algo que ya
      // preguntó con otras palabras.
      if (fromCache && myKeys.size > 0) {
        try {
          const { data: aliases } = await supabase
            .from("feed_topic_aliases")
            .select("topic_key")
            .in("key", [...myKeys].slice(0, 80));
          for (const a of aliases ?? []) myKeys.add(a.topic_key as string);
        } catch { /* sin tabla aún — la exclusión por clave cruda basta */ }
      }

      // Candidatos: temas globales afines que el usuario NO ha preguntado.
      const scored: { t: Topic; s: number }[] = [];
      for (const t of ranked) {
        if (myKeys.has(t.key)) continue;
        let affinity = 0;
        if (myCategories.has(t.categoryId)) affinity += 0.8;
        let overlap = 0;
        for (const w of t.keywords) if (myKeywords.has(w)) overlap++;
        affinity += Math.min(overlap, 2) * 0.5;
        if (affinity <= 0) continue; // solo lo realmente afín
        scored.push({ t, s: t.score * (1 + affinity) + affinity });
      }
      scored.sort((a, b) => b.s - a.s);

      const items: FeedForYouItem[] = [];
      for (const { t } of scored) {
        if (items.length >= FORYOU_ITEMS) break;
        const { id, label } = labelFor(t.categoryId);
        items.push({ prompt: t.prompt, categoryId: id, categoryLabel: label, reason: "afin" });
      }
      // Retomar lo suyo: su pregunta distinta más reciente (si hay espacio).
      for (const own of myOwn.slice(0, 2)) {
        if (items.length >= FORYOU_ITEMS + 1) break;
        const { id, label } = labelFor(own.categoryId);
        items.push({ prompt: own.prompt, categoryId: id, categoryLabel: label, reason: "tuyo" });
      }

      if (items.length >= 2) forYou = { items };
    }
  }

  return {
    featured,
    trending,
    nearYou: { city: visitorCity ?? cityKey, prompts: nearYouPrompts },
    recent,
    forYou,
  };
}
