import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/trending — four ranked sections, like a discovery feed:
//   • trending — top clicks in the last 48h (viral / hot right now)
//   • nearYou  — top clicks filtered by the user's city (7d window)
//   • forYou   — top clicks in the user's most-asked category (7d window)
//   • recent   — most recent distinct sub-options clicked (7d window)
//
// Auth is optional: anonymous users get the trending and recent sections.
// nearYou and forYou are empty if the user has no city or no history yet.
// The frontend hides empty sections.
//
// Returns:
//   { sections: { trending, nearYou, forYou, recent }, meta: { userCity, topCategory } }

type SubOptionOut = {
  id: string;
  categoryId: string;
  title: string;
  subtitle: string;
  iconKey: string;
  eventCount: number;
  prompts: string[];
};

type TrendingSections = {
  trending: SubOptionOut[];
  nearYou: SubOptionOut[];
  forYou: SubOptionOut[];
  recent: SubOptionOut[];
};

const VALID_CATEGORIES = ["comida", "servicios", "ofertas"] as const;
const TOP_N = 8;
const PROMPTS_PER_SUBOPTION = 3;

const SUBOPTION_META: Record<string, { title: string; subtitle: string; iconKey: string; categoryId: string }> = {
  // Comida
  pizza:        { title: "Pizza",          subtitle: "Pizzerías y delivery",    iconKey: "pizza",        categoryId: "comida" },
  sushi:        { title: "Sushi",          subtitle: "Sushi para delivery",     iconKey: "sushi",        categoryId: "comida" },
  veggie:       { title: "Vegetariana",    subtitle: "Opciones veggie",         iconKey: "veggie",       categoryId: "comida" },
  desayuno:     { title: "Desayunos",      subtitle: "Brunch y desayunos",      iconKey: "desayuno",     categoryId: "comida" },
  postres:      { title: "Postres",        subtitle: "Dulce y algo más",        iconKey: "postres",      categoryId: "comida" },
  cafes:        { title: "Cafés",          subtitle: "Para trabajar o charlar", iconKey: "cafes",        categoryId: "comida" },
  // Servicios
  plomero:      { title: "Plomería",       subtitle: "Urgencias y arreglos",    iconKey: "plomero",      categoryId: "servicios" },
  electricista: { title: "Electricista",   subtitle: "Instalaciones y más",     iconKey: "electricista", categoryId: "servicios" },
  limpieza:     { title: "Limpieza",       subtitle: "Servicio doméstico",      iconKey: "limpieza",     categoryId: "servicios" },
  mudanza:      { title: "Mudanzas",       subtitle: "Fletes y mudanzas",       iconKey: "mudanza",      categoryId: "servicios" },
  tecnico:      { title: "Técnico",        subtitle: "Electrodomésticos",       iconKey: "tecnico",      categoryId: "servicios" },
  clases:       { title: "Clases",         subtitle: "Idiomas, música y más",   iconKey: "clases",       categoryId: "servicios" },
  // Ofertas
  hoy:          { title: "Ofertas de hoy", subtitle: "Lo que vence hoy",        iconKey: "hoy",          categoryId: "ofertas" },
  "2x1":        { title: "2x1",            subtitle: "Promociones 2x1",         iconKey: "2x1",          categoryId: "ofertas" },
  ropa:         { title: "Ropa",           subtitle: "Moda y descuentos",       iconKey: "ropa",         categoryId: "ofertas" },
  super:        { title: "Supermercado",   subtitle: "Ofertas del super",       iconKey: "super",        categoryId: "ofertas" },
  electronica:  { title: "Electrónica",    subtitle: "Tech en oferta",          iconKey: "electronica",  categoryId: "ofertas" },
  cupones:      { title: "Cupones",        subtitle: "Cupones y descuentos",    iconKey: "cupones",      categoryId: "ofertas" },
};

function humanizeId(id: string) {
  return SUBOPTION_META[id] ?? { title: id, subtitle: "Tendencia", iconKey: id, categoryId: "comida" };
}

type Agg = {
  subOptionId: string;
  categoryId: string;
  eventCount: number;
  promptCounts: Map<string, number>;
};

function aggregate(rows: Array<{ category_id: string; sub_option_id: string | null; prompt: string }>): Map<string, Agg> {
  const bySubOption = new Map<string, Agg>();
  for (const row of rows) {
    if (!row.sub_option_id) continue;
    const key = `${row.category_id}::${row.sub_option_id}`;
    let agg = bySubOption.get(key);
    if (!agg) {
      agg = {
        subOptionId: row.sub_option_id,
        categoryId: row.category_id,
        eventCount: 0,
        promptCounts: new Map(),
      };
      bySubOption.set(key, agg);
    }
    agg.eventCount += 1;
    agg.promptCounts.set(row.prompt, (agg.promptCounts.get(row.prompt) ?? 0) + 1);
  }
  return bySubOption;
}

function topFromAgg(bySubOption: Map<string, Agg>, limit: number): SubOptionOut[] {
  return [...bySubOption.values()]
    .sort((a, b) => b.eventCount - a.eventCount)
    .slice(0, limit)
    .map((agg) => {
      const meta = humanizeId(agg.subOptionId);
      const topPrompts = [...agg.promptCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, PROMPTS_PER_SUBOPTION)
        .map(([prompt]) => prompt);
      return {
        id: agg.subOptionId,
        categoryId: agg.categoryId,
        title: meta.title,
        subtitle: meta.subtitle,
        iconKey: meta.iconKey,
        eventCount: agg.eventCount,
        prompts: topPrompts,
      };
    });
}

export async function GET(_request: NextRequest) {
  const { userId } = await auth();
  const supabase = await createClient();

  // Pull the user's city and their most-asked category in parallel.
  let userCity: string | null = null;
  let topCategory: string | null = null;
  if (userId) {
    const [ctxRes, historyRes] = await Promise.all([
      supabase
        .from("user_context")
        .select("city")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("query_events")
        .select("category_id")
        .eq("user_id", userId)
        .not("sub_option_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    userCity = ((ctxRes.data?.city ?? "").trim()) || null;
    if (historyRes.data?.length) {
      const counts: Record<string, number> = {};
      for (const r of historyRes.data) {
        if (r.category_id) counts[r.category_id] = (counts[r.category_id] ?? 0) + 1;
      }
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      topCategory = top?.[0] ?? null;
    }
  }

  // Trending uses a tight 48h window so "viral" really means recent.
  // The other three use 7d so they have enough data to be useful.
  const now = Date.now();
  const since48h = new Date(now - 2 * 86_400_000).toISOString();
  const since7d = new Date(now - 7 * 86_400_000).toISOString();

  const baseCols = "category_id, sub_option_id, prompt";

  const trendingQuery = supabase
    .from("query_events")
    .select(baseCols)
    .not("sub_option_id", "is", null)
    .in("category_id", [...VALID_CATEGORIES])
    .gte("created_at", since48h)
    .order("created_at", { ascending: false })
    .limit(2000);

  const nearYouQuery = userCity
    ? supabase
        .from("query_events")
        .select(baseCols)
        .not("sub_option_id", "is", null)
        .in("category_id", [...VALID_CATEGORIES])
        .eq("city", userCity)
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(2000)
    : Promise.resolve({ data: [] as Array<{ category_id: string; sub_option_id: string | null; prompt: string }>, error: null });

  const forYouQuery = topCategory
    ? supabase
        .from("query_events")
        .select(baseCols)
        .not("sub_option_id", "is", null)
        .eq("category_id", topCategory)
        .gte("created_at", since7d)
        .order("created_at", { ascending: false })
        .limit(2000)
    : Promise.resolve({ data: [] as Array<{ category_id: string; sub_option_id: string | null; prompt: string }>, error: null });

  const recentQuery = supabase
    .from("query_events")
    .select(baseCols)
    .not("sub_option_id", "is", null)
    .in("category_id", [...VALID_CATEGORIES])
    .gte("created_at", since7d)
    .order("created_at", { ascending: false })
    .limit(500);

  const [trendingRes, nearYouRes, forYouRes, recentRes] = await Promise.all([
    trendingQuery,
    nearYouQuery,
    forYouQuery,
    recentQuery,
  ]);

  if (trendingRes.error) return NextResponse.json({ error: trendingRes.error.message }, { status: 500 });
  if (nearYouRes.error)  return NextResponse.json({ error: nearYouRes.error.message  }, { status: 500 });
  if (forYouRes.error)   return NextResponse.json({ error: forYouRes.error.message   }, { status: 500 });
  if (recentRes.error)   return NextResponse.json({ error: recentRes.error.message   }, { status: 500 });

  const sections: TrendingSections = {
    trending: topFromAgg(aggregate(trendingRes.data ?? []), TOP_N),
    nearYou:  topFromAgg(aggregate(nearYouRes.data  ?? []), TOP_N),
    forYou:   topFromAgg(aggregate(forYouRes.data   ?? []), TOP_N),
    recent:   topFromAgg(aggregate(recentRes.data   ?? []), TOP_N),
  };

  // Dedupe: each sub_option_id appears in at most one section. Higher-priority
  // sections keep the id; lower-priority ones drop it. Fixes the "all 3
  // sections show the same items" bug when data is concentrated in one
  // category. Priority order chosen to surface freshest signal first.
  const seen = new Set<string>();
  const PRIORITY: (keyof TrendingSections)[] = ["trending", "nearYou", "forYou", "recent"];
  for (const key of PRIORITY) {
    sections[key] = sections[key].filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  return NextResponse.json({ sections, meta: { userCity, topCategory } });
}
