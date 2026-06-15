// src/lib/webSearch.ts
// Funciones PURAS e isomórficas (server + cliente), sin dependencias.
// shouldSearchWeb: heurística barata para decidir si una pregunta necesita
// información fresca de internet. buildGroundedQuestion: arma el texto que se
// le manda al modelo (campo `question`) inyectando las fuentes + instrucción.

export type WebSource = { title: string; url: string; snippet: string };

// Señales de "esto necesita web": actualidad, precios, resultados, fechas,
// trámites y disparadores temporales. Es deliberadamente conservadora: ante la
// duda NO busca (mejor no añadir latencia a un chat normal). Los falsos
// negativos se cubren en la Fase 2 (clasificador). Acentos opcionales.
const SEARCH_SIGNALS: RegExp[] = [
  /\b(hoy|ahora|actual(es|mente)?|reciente|último|ultima|de\s+este\s+(a[ñn]o|mes))\b/i,
  /\b(precio|cu[áa]nto\s+(cuesta|vale|est[áa])|tasa|d[óo]lar|euro|bcv|paralelo)\b/i,
  /\b(qui[ée]n\s+gan[óo]|resultado|marcador|mundial|eliminatorias|clasific)\b/i,
  /\b(noticia|pas[óo]|ocurri[óo]|sucedi[óo]|estren[óo])\b/i,
  /\b(cu[áa]ndo|qu[ée]\s+d[íi]a|fecha\s+de)\b/i,
  /\b(saime|seniat|cita|tr[áa]mite|requisitos)\b/i,
  /\b20(2[4-9]|3\d)\b/, // años 2024..2039
];

export function shouldSearchWeb(question: string): boolean {
  const q = (question || "").trim();
  if (q.length < 6) return false;
  return SEARCH_SIGNALS.some((re) => re.test(q));
}

// Recorta un snippet para acotar el tamaño del prompt aumentado.
function trimSnippet(s: string, max = 320): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Construye el `question` aumentado. El usuario NO ve esto; solo el modelo.
export function buildGroundedQuestion(question: string, sources: WebSource[]): string {
  if (!sources || sources.length === 0) return question;
  const today = new Date().toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
  const list = sources
    .map((s, i) => `${i + 1}. ${s.title} — ${trimSnippet(s.snippet)}\n   Fuente: ${s.url}`)
    .join("\n");
  return [
    `INSTRUCCIONES: Para datos actuales o factuales responde USANDO SOLO la información de internet de abajo. Cita las fuentes relevantes con enlaces markdown [título](url). Si la información no alcanza para responder, dilo claramente y NO inventes.`,
    ``,
    `INFORMACIÓN DE INTERNET (consultada el ${today}):`,
    list,
    ``,
    `PREGUNTA DEL USUARIO:`,
    question,
  ].join("\n");
}
