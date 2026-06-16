// Generador de la landing v2 desde el export de Claude Design ("vechat-landing").
//
// Toma el markup + CSS crudos del export (landing-body.html / landing-design.css,
// en esta misma carpeta) y produce los dos artefactos que consume Landing.tsx:
//   src/components/landing/landingMarkup.ts   (HTML con CTAs cableados + placeholders)
//   src/components/landing/landingDesign.css  (CSS con cada selector scoped bajo .lp)
//
// Re-generar tras actualizar el export:  node scripts/landing/build-landing.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../src/components/landing");

/* ──────────────────────────────────────────────────────────────────────────
   1. HTML — rewire CTAs + placeholder dynamic prices
   ────────────────────────────────────────────────────────────────────────── */
let html = readFileSync(resolve(HERE, "landing-body.html"), "utf8");

const ctaMap = [
  ['<a class="lnk" href="#">Entrar</a>', '<a class="lnk" href="/sign-in">Entrar</a>'],
  ['<a class="btn btn--green" href="#">Empieza gratis</a>', '<a class="btn btn--green" href="/sign-up">Empieza gratis</a>'],
  ['<a class="btn btn--green btn--lg" href="#">Crea tu cuenta gratis', '<a class="btn btn--green btn--lg" href="/sign-up">Crea tu cuenta gratis'],
  ['<a class="btn btn--soft" href="#">Empezar gratis</a>', '<a class="btn btn--soft" href="/sign-up">Empezar gratis</a>'],
  ['<a class="btn btn--soft" href="#">Elegir Semanal</a>', '<a class="btn btn--soft" href="/sign-up">Elegir Semanal</a>'],
  ['<a class="btn btn--green" href="#">Elegir Mensual</a>', '<a class="btn btn--green" href="/sign-up">Elegir Mensual</a>'],
  ['<a href="#">Entrar</a>', '<a href="/sign-in">Entrar</a>'],
  ['<a href="#">Crear cuenta</a>', '<a href="/sign-up">Crear cuenta</a>'],
  ['<a href="#">Mi historial</a>', '<a href="/sign-in">Mi historial</a>'],
];
let ctaHits = 0;
for (const [from, to] of ctaMap) {
  const before = html;
  html = html.split(from).join(to);
  if (html !== before) ctaHits++;
}

// precios dinámicos → placeholders que el componente sustituye con appConfig
const priceMap = [
  ['<div class="amt">$2 <small>por semana</small></div>', '<div class="amt">$__PRICE_WEEKLY__ <small>por semana</small></div>'],
  ['<div class="amt">$6 <small>por mes</small></div>', '<div class="amt">$__PRICE_MONTHLY__ <small>por mes</small></div>'],
  ['<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> 10 mensajes al día',
   '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg> __FREE_LIMIT__ mensajes al día'],
  ['tienes 10 mensajes al día, para siempre', 'tienes __FREE_LIMIT__ mensajes al día, para siempre'],
  ['pasas a un plan pago desde $2 por semana', 'pasas a un plan pago desde $__PRICE_WEEKLY__ por semana'],
];
let priceHits = 0;
for (const [from, to] of priceMap) {
  const before = html;
  html = html.split(from).join(to);
  if (html !== before) priceHits++;
}
const deadLeft = (html.match(/href="#"/g) || []).length;

const tsBanner = `// AUTO-GENERADO desde el export de Claude Design (vechat-landing).
// Markup estático de la landing v2. Los CTA ya apuntan a /sign-up · /sign-in;
// __PRICE_WEEKLY__ / __PRICE_MONTHLY__ / __FREE_LIMIT__ los sustituye Landing.tsx
// con appConfig en el server. No editar a mano: re-generar con build-landing.mjs.
/* eslint-disable */
export const LANDING_HTML = String.raw\``;
writeFileSync(`${REPO}/landingMarkup.ts`, tsBanner + html + "`;\n");

/* ──────────────────────────────────────────────────────────────────────────
   2. CSS — scope every selector under `.lp`
   ────────────────────────────────────────────────────────────────────────── */
let css = readFileSync(resolve(HERE, "landing-design.css"), "utf8");

// renombrar keyframes (evitar choque con globals del app)
for (const [from, to] of [["vc-thinking-wave", "lp-think"], ["lvp", "lp-live"], ["slide", "lp-slide"]]) {
  css = css.replace(new RegExp("\\b" + from + "\\b", "g"), to);
}

function parseRules(str) {
  const rules = [];
  let i = 0;
  const n = str.length;
  while (i < n) {
    while (i < n && /\s/.test(str[i])) i++;
    if (i >= n) break;
    if (str[i] === "/" && str[i + 1] === "*") {
      const e = str.indexOf("*/", i);
      rules.push({ type: "comment", text: str.slice(i, e + 2) });
      i = e + 2;
      continue;
    }
    let prelude = "";
    while (i < n && str[i] !== "{") { prelude += str[i]; i++; }
    let body = "";
    let d = 0;
    do {
      const ch = str[i];
      if (ch === "{") d++;
      else if (ch === "}") d--;
      body += ch;
      i++;
    } while (i < n && d > 0);
    rules.push({ type: "rule", prelude: prelude.trim(), body });
  }
  return rules;
}

function scopeSelectors(sel) {
  return sel
    .split(",")
    .map((s) => {
      s = s.trim();
      if (!s) return s;
      if (s === ":root" || s === "body" || s === "html") return ".lp";
      if (s.startsWith("body ")) return ".lp " + s.slice(5);
      if (s.startsWith(":root ")) return ".lp " + s.slice(6);
      return ".lp " + s;
    })
    .join(", ");
}

function transform(str) {
  let out = "";
  for (const r of parseRules(str)) {
    if (r.type === "comment") { out += r.text + "\n"; continue; }
    const pre = r.prelude;
    if (pre.startsWith("@keyframes") || pre.startsWith("@-")) { out += pre + " " + r.body + "\n"; continue; }
    if (pre.startsWith("@media") || pre.startsWith("@supports")) {
      const inner = r.body.slice(r.body.indexOf("{") + 1, r.body.lastIndexOf("}"));
      out += pre + " {\n" + transform(inner) + "}\n";
      continue;
    }
    out += scopeSelectors(pre) + " " + r.body + "\n";
  }
  return out;
}

const scoped = transform(css);
// tokens que el app puede no tener globalmente, definidos en el wrapper
const extraTokens = `.lp { --motion-premium: cubic-bezier(0.32, 0.72, 0, 1); scroll-behavior: smooth; }\n`;
// Parches de integración (NO vienen del export). El diseño es desktop-first y su
// <nav> no cabe en móvil (4 links de sección + CTA ~533px, recorta "Empieza
// gratis"). En pantallas chicas ocultamos los links de sección y dejamos solo
// "Entrar" + "Empieza gratis".
const patches = `\n/* ── Parches de integración (no vienen del export) ───────────────────────── */
@media (max-width: 768px) {
  .lp .nav .lnk[href^="#"], .lp .nav .sep { display: none; }
}
`;
const cssBanner = `/* AUTO-GENERADO desde el export de Claude Design (vechat-landing).
   CSS de la landing v2, con CADA selector scoped bajo .lp para no tocar el chat.
   Tokens de marca (--primary, --surface, --user-bubble) y fuentes (--font-*)
   los hereda del app. No editar a mano: re-generar con build-landing.mjs. */\n`;
writeFileSync(`${REPO}/landingDesign.css`, cssBanner + extraTokens + scoped + patches);

const braceBal = (scoped.match(/{/g) || []).length - (scoped.match(/}/g) || []).length;
console.log(`HTML: ${ctaHits} CTAs, ${priceHits} precios, ${deadLeft} '#' restantes`);
console.log(`CSS: ${scoped.length} bytes scoped, balance de llaves ${braceBal}`);
