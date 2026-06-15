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

// Para trámites oficiales conviene RESTRINGIR a dominios .gob.ve (fuente
// autoritativa). En el resto NO restringimos (sesgamos por country en la ruta).
const TRAMITE_RE = /\b(saime|seniat|pasaporte|c[ée]dula\b|rif\b|cita|tr[áa]mite|requisitos|gob\.ve)\b/i;
export function includeDomainsFor(question: string): string[] | undefined {
  if (TRAMITE_RE.test(question || "")) return ["saime.gob.ve", "seniat.gob.ve", "gob.ve"];
  return undefined;
}

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
    `INSTRUCCIONES: Para datos actuales o factuales responde USANDO SOLO la información de internet de abajo. Da una respuesta directa y clara cuando las fuentes la sustenten. Cita las fuentes relevantes con enlaces markdown [título](url). Si la información de verdad no alcanza, dilo y NO inventes.`,
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
