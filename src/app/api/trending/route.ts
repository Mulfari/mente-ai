import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/trending — aggregate top sub-options per category by event count.
// Optional query params: sinceDays (1-90, default 30), limit (1-12, default 6).
// No auth required (read-only public aggregate). With zero data, returns
// { trending: {}, sinceDays } — the frontend falls back to static CATEGORIES.

type SubOptionOut = {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  iconKey: string;
  eventCount: number;
};

const VALID_CATEGORIES = ["comida", "servicios", "ofertas"] as const;

const SUBOPTION_META: Record<string, { title: string; subtitle: string; iconKey: string }> = {
  // Comida
  pizza:        { title: "Pizza",        subtitle: "Pizzerías y delivery",  iconKey: "pizza" },
  sushi:        { title: "Sushi",        subtitle: "Sushi para delivery",   iconKey: "sushi" },
  veggie:       { title: "Vegetariana",  subtitle: "Opciones veggie",       iconKey: "veggie" },
  desayuno:     { title: "Desayunos",    subtitle: "Brunch y desayunos",    iconKey: "desayuno" },
  postres:      { title: "Postres",      subtitle: "Dulce y algo más",      iconKey: "postres" },
  cafes:        { title: "Cafés",        subtitle: "Para trabajar o charlar", iconKey: "cafes" },
  // Servicios
  plomero:      { title: "Plomería",     subtitle: "Urgencias y arreglos",  iconKey: "plomero" },
  electricista: { title: "Electricista", subtitle: "Instalaciones y más",   iconKey: "electricista" },
  limpieza:     { title: "Limpieza",     subtitle: "Servicio doméstico",    iconKey: "limpieza" },
  mudanza:      { title: "Mudanzas",     subtitle: "Fletes y mudanzas",     iconKey: "mudanza" },
  tecnico:      { title: "Técnico",      subtitle: "Electrodomésticos",     iconKey: "tecnico" },
  clases:       { title: "Clases",       subtitle: "Idiomas, música y más", iconKey: "clases" },
  // Ofertas
  hoy:          { title: "Ofertas de hoy", subtitle: "Lo que vence hoy",    iconKey: "hoy" },
  "2x1":        { title: "2x1",          subtitle: "Promociones 2x1",       iconKey: "2x1" },
  ropa:         { title: "Ropa",         subtitle: "Moda y descuentos",     iconKey: "ropa" },
  super:        { title: "Supermercado", subtitle: "Ofertas del super",     iconKey: "super" },
  electronica:  { title: "Electrónica",  subtitle: "Tech en oferta",        iconKey: "electronica" },
  cupones:      { title: "Cupones",      subtitle: "Cupones y descuentos",  iconKey: "cupones" },
};

function humanizeId(id: string) {
  return SUBOPTION_META[id] ?? { title: id, subtitle: "Tendencia reciente", iconKey: id };
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sinceDays = Math.min(90, Math.max(1, Number(url.searchParams.get("sinceDays") ?? 30) || 30));
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit") ?? 6) || 6));

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

  // Aggregate in-process: group by (category_id, sub_option_id), count, keep
  // the most recent prompt as the canonical text for that sub-option.
  const byCategory = new Map<string, Map<string, SubOptionOut & { _firstSeen: number }>>();
  let i = 0;
  for (const row of data ?? []) {
    if (!row.sub_option_id) continue;
    let subMap = byCategory.get(row.category_id);
    if (!subMap) { subMap = new Map(); byCategory.set(row.category_id, subMap); }
    const existing = subMap.get(row.sub_option_id);
    if (existing) {
      existing.eventCount += 1;
    } else {
      const meta = humanizeId(row.sub_option_id);
      subMap.set(row.sub_option_id, {
        id: row.sub_option_id,
        title: meta.title,
        subtitle: "Tendencia reciente",
        prompt: row.prompt,
        iconKey: meta.iconKey,
        eventCount: 1,
        _firstSeen: i,
      });
    }
    i += 1;
  }

  const result: Record<string, SubOptionOut[]> = {};
  for (const [catId, subMap] of byCategory) {
    result[catId] = [...subMap.values()]
      .sort((a, b) => b.eventCount - a.eventCount || a._firstSeen - b._firstSeen)
      .slice(0, limit)
      .map(({ _firstSeen, ...rest }) => rest);
  }
  return NextResponse.json({ trending: result, sinceDays });
}
