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
  // Actualidad/política y eventos sobre personas — señales de alta precisión
  // (preguntas factuales que la lista de arriba se saltaba, ej. "presidente").
  /\b(presidente|gobierno|ministro|gobernador|alcalde|diputad|elecci[óo]n|elecciones)\b/i,
  /\b(qui[ée]n\s+(es|fue|ser[áa]|murió|muri[óo]|falleci[óo]|renunci[óo]))\b/i,
  /\b(qu[ée]\s+(le\s+)?pas[óa]\s+(con|a|el|la)|qu[ée]\s+fue\s+de)\b/i,
  /\b(falleci[óo]|muri[óo]|detenid|arrestad|renunci[óo]|nombrad|gan[óo]\s+el)\b/i,
  /\b20(2[4-9]|3\d)\b/, // años 2024..2039
];

export function shouldSearchWeb(question: string): boolean {
  const q = (question || "").trim();
  if (q.length < 6) return false;
  return SEARCH_SIGNALS.some((re) => re.test(q));
}

// ¿Es una pregunta de ACTUALIDAD (noticias/eventos)? Para estas usamos el
// topic "news" de Tavily + ventana de recencia, que trae resultados frescos y
// relevantes (clave para "¿quién ganó?", "¿clasificó?", elecciones, etc.).
const NEWS_SIGNALS: RegExp[] = [
  /\b(mundial|eliminatorias|clasific|resultado|marcador|qui[ée]n\s+gan[óo]|gan[óo])\b/i,
  /\b(noticia|pas[óo]|ocurri[óo]|sucedi[óo]|elecci[óo]n|elecciones|estren[óo])\b/i,
  /\b(hoy|ayer|reciente|último|ultima|esta\s+semana|este\s+(mes|a[ñn]o))\b/i,
];
export function isNewsQuery(question: string): boolean {
  return NEWS_SIGNALS.some((re) => re.test(question || ""));
}

// Intención de la búsqueda → permite curar dominios por tema (configurable sin
// redeploy desde app_config; ver getWebDomains). Solo TRÁMITES restringe a
// .gob.ve por defecto (fuente autoritativa); dólar/deportes quedan abiertos por
// defecto (no restringir de más) pero se les pueden añadir dominios en config.
export type SearchIntent = "tramites" | "dolar" | "deportes";
const INTENT_RE: Record<SearchIntent, RegExp> = {
  tramites: /\b(saime|seniat|pasaporte|c[ée]dula|rif\b|cita|tr[áa]mite|requisitos|pr[óo]rroga|gob\.ve)\b/i,
  dolar: /\b(d[óo]lar|d[óo]lares|tasa|bcv|paralelo|euro|cambio|bol[íi]var|petro)\b/i,
  deportes: /\b(f[úu]tbol|b[ée]isbol|mundial|eliminatorias|liga|partido|vinotinto|leones|magallanes|nba|mlb|champions|s[ée]rie\s+del\s+caribe)\b/i,
};
export function searchIntent(question: string): SearchIntent | null {
  const s = question || "";
  // Orden de prioridad: trámites primero (el más específico/útil para restringir).
  for (const k of ["tramites", "dolar", "deportes"] as SearchIntent[]) {
    if (INTENT_RE[k].test(s)) return k;
  }
  return null;
}
// Defaults en código (fallback si no hay fila web_domains en app_config).
export const DEFAULT_INTENT_DOMAINS: Record<SearchIntent, string[]> = {
  tramites: ["saime.gob.ve", "seniat.gob.ve", "gob.ve"],
  dolar: [],
  deportes: [],
};

// Recorta un snippet para acotar el tamaño del prompt aumentado.
function trimSnippet(s: string, max = 320): string {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

// Construye el `question` aumentado. El usuario NO ve esto; solo el modelo.
// `summary` es la síntesis que Tavily arma de las fuentes (include_answer):
// dársela al modelo hace que responda más tajante (no se queda en "no es
// concluyente" cuando las fuentes sí lo dicen), pero igual debe citar y no
// inventar.
export function buildGroundedQuestion(question: string, sources: WebSource[], summary?: string): string {
  if (!sources || sources.length === 0) return question;
  const today = new Date().toLocaleDateString("es-VE", { year: "numeric", month: "long", day: "numeric" });
  const list = sources
    .map((s, i) => `${i + 1}. ${s.title} — ${trimSnippet(s.snippet)}\n   Fuente: ${s.url}`)
    .join("\n");
  const parts = [
    `INSTRUCCIONES: Para datos actuales o factuales responde USANDO SOLO la información de internet de abajo. Da una respuesta directa y clara cuando las fuentes la sustenten. Cita las fuentes relevantes con enlaces markdown [título](url). Si la información de verdad no alcanza, dilo y NO inventes. IMPORTANTE: si las fuentes tratan sobre una persona o tema DISTINTO al que se pregunta (p. ej. un nombre parecido pero no idéntico, o en otro idioma), acláralo y di que no encontraste información sobre lo preguntado — NO asumas que un resultado de nombre similar es la respuesta.`,
    ``,
  ];
  if (summary && summary.trim()) {
    parts.push(`RESUMEN DE FUENTES (síntesis automática; contrástalo con las fuentes citadas):`, trimSnippet(summary, 700), ``);
  }
  parts.push(
    `INFORMACIÓN DE INTERNET (consultada el ${today}):`,
    list,
    ``,
    `PREGUNTA DEL USUARIO:`,
    question,
  );
  return parts.join("\n");
}

// Cuando la búsqueda web NO trajo fuentes (sin key, timeout, error o cero
// resultados) pero la pregunta era sensible al tiempo, añade una nota para que
// el modelo NO invente datos actuales desde su conocimiento congelado. Solo
// aplica a intenciones con caducidad (dólar/trámites/deportes); para el resto
// devuelve la pregunta tal cual (su conocimiento base suele bastar).
export function buildUngroundedNotice(question: string): string {
  const intent = searchIntent(question);
  if (!intent) return question;
  const tema =
    intent === "dolar"
      ? "una tasa o precio actual (como el dólar)"
      : intent === "tramites"
        ? "un requisito o dato de un trámite que pudo cambiar"
        : "un resultado o dato reciente";
  return [
    `INSTRUCCIONES: No se pudo consultar internet en este momento y la pregunta pide ${tema}. NO inventes cifras, fechas ni datos actuales desde tu memoria: di con franqueza que no pudiste confirmar el dato al día de hoy y, si aplica, sugiere dónde verificarlo. Sí puedes dar el contexto general que sepas con certeza.`,
    ``,
    `PREGUNTA DEL USUARIO:`,
    question,
  ].join("\n");
}
