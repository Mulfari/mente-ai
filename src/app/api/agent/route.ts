import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchDolarRates, buildDolarContext } from "@/lib/dolar";
import { searchLocalBusinesses } from "@/lib/localBusinesses";

// PILOTO de tool-calling (Bloque 3). AISLADO — no toca el chat en vivo. El
// modelo (Claude, tool-use confiable) decide cuándo llamar herramientas en vez
// de que Vercel adivine con heurísticas. Si funciona, se migra el chat a esto y
// se retira el orquestador del VPS. Devuelve { answer, trace, model } para
// inspección (no streaming aún; eso viene en la migración).

export const runtime = "nodejs";
export const maxDuration = 60;

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const BASE_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
const MODEL = process.env.AGENT_MODEL || "claude-haiku-4-5-20251001";

const TOOLS = [
  {
    name: "get_dolar",
    description:
      "Devuelve la tasa del dólar en Venezuela HOY (BCV y paralelo). Úsalo SOLO si el usuario pregunta por el precio/tasa del dólar, euro o el cambio.",
    input_schema: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "search_local_businesses",
    description:
      "Busca negocios REALES y verificados (cafés, restaurantes, tiendas, servicios) en VeLocal. Úsalo cuando el usuario quiere comer, comprar o un servicio en su ciudad. Si no devuelve resultados, NO inventes negocios: dilo con honestidad.",
    input_schema: {
      type: "object",
      properties: {
        termino: { type: "string", description: "qué busca, ej. 'café', 'hamburguesas', 'farmacia'" },
        ciudad: { type: "string", description: "ciudad del usuario, ej. 'Maracay' (opcional)" },
      },
      required: ["termino"],
    },
  },
  {
    name: "search_web",
    description:
      "Busca en internet información ACTUAL (noticias, trámites, datos recientes) que no cubran las otras herramientas. NO lo uses para negocios locales (usa search_local_businesses) ni para el dólar (usa get_dolar).",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "qué buscar en la web" } },
      required: ["query"],
    },
  },
];

async function runTool(name: string, input: Record<string, unknown>): Promise<string> {
  if (name === "get_dolar") {
    try {
      const rates = await fetchDolarRates();
      return buildDolarContext(rates).answer || "No hay tasa disponible ahora.";
    } catch {
      return "No se pudo obtener la tasa del dólar.";
    }
  }
  if (name === "search_local_businesses") {
    const biz = await searchLocalBusinesses({
      term: String(input?.termino ?? ""),
      city: input?.ciudad ? String(input.ciudad) : null,
    });
    if (!biz.length) return "No hay negocios verificados en VeLocal para eso. Dile al usuario con honestidad que aún no lo tienes; NO inventes.";
    return biz
      .map((b) => `- ${b.name}${b.category ? ` (${b.category})` : ""}${b.neighborhood ? ` · ${b.neighborhood}` : ""} · ${b.openNow ? "abierto" : "cerrado"}`)
      .join("\n");
  }
  if (name === "search_web") {
    const q = String(input?.query ?? "");
    if (!q) return "Falta la consulta.";
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return "Búsqueda web no disponible.";
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ query: q, search_depth: "advanced", include_answer: "advanced", country: "venezuela", max_results: 5 }),
      });
      if (!res.ok) return "No se pudo buscar en la web ahora.";
      const data = await res.json();
      const ans = typeof data.answer === "string" ? data.answer : "";
      const srcs = (data.results || [])
        .slice(0, 4)
        .map((r: { title?: string; url: string }) => `- ${r.title || r.url}: ${r.url}`)
        .join("\n");
      return [ans, srcs ? `Fuentes:\n${srcs}` : ""].filter(Boolean).join("\n\n") || "Sin resultados.";
    } catch {
      return "Error buscando en la web.";
    }
  }
  return "Herramienta desconocida.";
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!API_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY no configurada" }, { status: 500 });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.slice(0, 2000) : "";
  if (!question) return NextResponse.json({ error: "falta 'question'" }, { status: 400 });

  const system =
    "Eres VeChat, un asistente de IA para Venezuela. Responde directo y sobrio, con sabor venezolano natural sin exceso de jerga. Usa las herramientas SOLO cuando aplique (la tasa del dólar; o negocios locales reales). REGLA CRÍTICA: NUNCA inventes negocios, precios ni datos locales — si una herramienta no devuelve resultados, dilo con honestidad.";

  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: question }];
  const trace: { tool: string; input: unknown; output: string }[] = [];

  for (let step = 0; step < 4; step++) {
    const res = await fetch(`${BASE_URL}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system, tools: TOOLS, messages }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: `Modelo ${res.status}: ${t.slice(0, 400)}`, model: MODEL, baseUrl: BASE_URL }, { status: 502 });
    }
    const data = await res.json();
    messages.push({ role: "assistant", content: data.content });
    const toolUses = (data.content || []).filter((c: { type: string }) => c.type === "tool_use");
    if (data.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
      return NextResponse.json({ answer: text, trace, model: MODEL, steps: step + 1 });
    }
    const results = [];
    for (const tu of toolUses) {
      const out = await runTool(tu.name, tu.input || {});
      trace.push({ tool: tu.name, input: tu.input, output: out.slice(0, 300) });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return NextResponse.json({ answer: "(agente: se alcanzó el máximo de pasos)", trace, model: MODEL });
}
