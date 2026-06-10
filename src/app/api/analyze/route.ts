import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Mensaje vacío" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || "";
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.selectapi.vip";
  const model = process.env.ANTHROPIC_MODEL || "[private model]";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  const prompt = `Eres un analizador de consultas. Dado un mensaje de usuario en español, determina qué información necesita del directorio.

Devuelve un JSON con esta estructura exacta, sin texto adicional:
{
  "needs": {
    "cities": ["ciudad"],
    "categories": ["categoria"],
    "keywords": ["palabra"],
    "general": true/false
  },
  "search_query": "consulta simplificada"
}

Reglas:
- cities: ciudades mencionadas (maracay, caracas, valencia, barquisimeto, etc.)
- categories: categorias del directorio (restaurante, farmacia, clinica, gym, lavanderia, estacion)
- keywords: palabras clave relevantes adicionales
- general: true si es pregunta general que no es sobre lugares
- search_query: una consulta corta para buscar en la DB

Ejemplos:
- "restaurantes en Maracay" → needs: {cities: ["Maracay"], categories: ["restaurante"], general: false}
- "dame una clinica cerca" → needs: {cities: [], categories: ["clinica"], general: false}
- "como funciona esto?" → needs: {general: true}`;

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 512,
        stream: false,
        system: prompt,
        messages: [{ role: "user", content: message }],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Error en análisis" }, { status: 500 });
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return NextResponse.json({ needs: { general: true }, knowledge: [], count: 0 });

    let analysis = JSON.parse(match[0]);
    if (!analysis.needs) analysis = { needs: { general: true } };

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const knowledge: any[] = [];

    if (!analysis.needs.general) {
      const kParts: string[] = ["status=eq.approved"];
      analysis.needs.cities?.forEach((c: string) => kParts.push(`city=ilike.*${encodeURIComponent(c)}*`));
      analysis.needs.categories?.forEach((c: string) => kParts.push(`category=ilike.*${encodeURIComponent(c)}*`));
      const kUrl = `${supabaseUrl}/rest/v1/knowledge?select=*&${kParts.join("&")}&order=created_at.desc&limit=30`;
      const kRes = await fetch(kUrl, { headers });
      if (kRes.ok) knowledge.push(...await kRes.json());

      const pParts: string[] = ["active=eq.true"];
      if (analysis.needs.cities?.length) {
        pParts.push(`cities.name=ilike.*${encodeURIComponent(analysis.needs.cities[0])}*`);
      }
      if (analysis.needs.categories?.length) {
        pParts.push(`categories.name=ilike.*${encodeURIComponent(analysis.needs.categories[0])}*`);
      }
      const pUrl = `${supabaseUrl}/rest/v1/places?select=*,cities(name),categories(name)&${pParts.join("&")}&order=rating.desc&limit=30`;
      const pRes = await fetch(pUrl, { headers });
      if (pRes.ok) {
        const places = await pRes.json();
        for (const p of places) {
          knowledge.push({
            source: "place",
            content: `${p.name}${p.cities?.name ? `, ${p.cities.name}` : ""}: ${p.address || "Direccion no disponible"}. ${p.specialty || p.description || ""} ${p.phone ? `📞 ${p.phone}` : ""} ${p.google_maps_url ? `📍 ${p.google_maps_url}` : ""}`,
          });
        }
      }
    }

    return NextResponse.json({ analysis, knowledge, count: knowledge.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error en análisis" }, { status: 500 });
  }
}