import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/trending — flat list of top trending sub-options with their prompt
// variations. The frontend uses the top list as filter chips and the prompts
// of the selected sub-option as the cards in "O pregúntale algo".
// No auth required. With zero data, returns { trending: { topSubOptions: [] } }.

type SubOptionOut = {
  id: string;
  categoryId: string;
  title: string;
  subtitle: string;
  iconKey: string;
  eventCount: number;
  prompts: string[];
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

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sinceDays = Math.min(90, Math.max(1, Number(url.searchParams.get("sinceDays") ?? 30) || 30));
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? TOP_N) || TOP_N));

  const supabase = await createClient();
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();

  const { data, error } = await supabase
    .from("query_events")
    .select("category_id, sub_option_id, prompt")
    .not("sub_option_id", "is", null)
    .gte("created_at", since)
    .in("category_id", [...VALID_CATEGORIES])
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate: group by (category_id, sub_option_id), keep total count and
  // per-prompt count. The most-popular prompt(s) by count become the cards.
  type Agg = {
    subOptionId: string;
    categoryId: string;
    eventCount: number;
    promptCounts: Map<string, number>;
  };
  const bySubOption = new Map<string, Agg>();
  for (const row of data ?? []) {
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

  const topSubOptions: SubOptionOut[] = [...bySubOption.values()]
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

  return NextResponse.json({ trending: { topSubOptions }, sinceDays });
}
