import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fetchDolarRates, buildDolarContext } from "@/lib/dolar";
import { searchLocalBusinesses } from "@/lib/localBusinesses";

// PILOTO de tool-calling (Bloque 3). AISLADO — no toca el chat en vivo. El
// modelo decide cuándo llamar herramientas en vez de que Vercel adivine.
// Soporta DOS proveedores para comparar viabilidad:
//   - "minimax" (default, formato OpenAI vía FEED_LLM_*) — el modelo de Jose
//   - "claude"  (formato Anthropic vía ANTHROPIC_*) — referencia probada
// Devuelve { answer, trace, model, provider } para inspección (sin streaming).

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOLS = [
  {
    name: "get_dolar",
    description:
      "Devuelve la tasa del dólar en Venezuela HOY (BCV y paralelo). Úsalo SOLO si el usuario pregunta por el precio/tasa del dólar, euro o el cambio.",
    parameters: { type: "object", properties: {}, required: [] as string[] },
  },
  {
    name: "search_local_businesses",
    description:
      "Busca negocios REALES y verificados (cafés, restaurantes, tiendas, servicios) en VeLocal. Úsalo cuando el usuario quiere comer, comprar o un servicio en su ciudad. Si no devuelve resultados, NO inventes: dilo con honestidad.",
    parameters: {
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
      "Busca en internet información ACTUAL (noticias, trámites, datos recientes) que no cubran las otras herramientas. NO lo uses para negocios locales ni para el dólar.",
    parameters: {
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
      const srcs = (data.results || []).slice(0, 4).map((r: { title?: string; url: string }) => `- ${r.title || r.url}: ${r.url}`).join("\n");
      return [ans, srcs ? `Fuentes:\n${srcs}` : ""].filter(Boolean).join("\n\n") || "Sin resultados.";
    } catch {
      return "Error buscando en la web.";
    }
  }
  return "Herramienta desconocida.";
}

const SYSTEM =
  "Eres VeChat, un asistente de IA para Venezuela. Responde directo y sobrio, con sabor venezolano natural sin exceso de jerga. Usa las herramientas SOLO cuando aplique (la tasa del dólar; negocios locales reales; o búsqueda web). REGLA CRÍTICA: NUNCA inventes negocios, precios ni datos locales — si una herramienta no devuelve resultados, dilo con honestidad.";

type Trace = { tool: string; input: unknown; output: string }[];

// ===== MiniMax / OpenAI-compatible (tools como functions, tool_calls) =====
async function runMiniMax(question: string): Promise<{ answer: string; trace: Trace; model: string }> {
  const URL = (process.env.FEED_LLM_URL || "").replace(/\/+$/, "");
  const KEY = process.env.FEED_LLM_KEY || "";
  const MODEL = process.env.FEED_LLM_MODEL || "MiniMax-M3";
  if (!URL || !KEY) throw new Error("FEED_LLM_URL/KEY no configurados");
  const oaiTools = TOOLS.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } }));
  const messages: Record<string, unknown>[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: question },
  ];
  const trace: Trace = [];
  for (let step = 0; step < 4; step++) {
    const res = await fetch(`${URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ model: MODEL, messages, tools: oaiTools, tool_choice: "auto", temperature: 0.3 }),
    });
    if (!res.ok) throw new Error(`MiniMax ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("MiniMax: respuesta sin message");
    messages.push(msg);
    const calls = msg.tool_calls || [];
    if (!calls.length) {
      const text = (msg.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return { answer: text, trace, model: MODEL };
    }
    for (const tc of calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
      const out = await runTool(tc.function?.name, args);
      trace.push({ tool: tc.function?.name, input: args, output: out.slice(0, 300) });
      messages.push({ role: "tool", tool_call_id: tc.id, content: out });
    }
  }
  return { answer: "(agente MiniMax: máximo de pasos)", trace, model: MODEL };
}

// ===== Claude / Anthropic (tool_use / tool_result) — referencia probada =====
async function runClaude(question: string): Promise<{ answer: string; trace: Trace; model: string }> {
  const KEY = process.env.ANTHROPIC_API_KEY || "";
  const BASE = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "");
  const MODEL = process.env.AGENT_MODEL || "claude-haiku-4-5-20251001";
  if (!KEY) throw new Error("ANTHROPIC_API_KEY no configurada");
  const antTools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: question }];
  const trace: Trace = [];
  for (let step = 0; step < 4; step++) {
    const res = await fetch(`${BASE}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: antTools, messages }),
    });
    if (!res.ok) throw new Error(`Claude ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
    const data = await res.json();
    messages.push({ role: "assistant", content: data.content });
    const toolUses = (data.content || []).filter((c: { type: string }) => c.type === "tool_use");
    if (data.stop_reason !== "tool_use" || !toolUses.length) {
      const text = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
      return { answer: text, trace, model: MODEL };
    }
    const results = [];
    for (const tu of toolUses) {
      const out = await runTool(tu.name, tu.input || {});
      trace.push({ tool: tu.name, input: tu.input, output: out.slice(0, 300) });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out });
    }
    messages.push({ role: "user", content: results });
  }
  return { answer: "(agente Claude: máximo de pasos)", trace, model: MODEL };
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.slice(0, 2000) : "";
  if (!question) return NextResponse.json({ error: "falta 'question'" }, { status: 400 });
  const provider = body.provider === "claude" ? "claude" : "minimax";

  try {
    const out = provider === "claude" ? await runClaude(question) : await runMiniMax(question);
    return NextResponse.json({ provider, ...out });
  } catch (e) {
    return NextResponse.json({ provider, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
