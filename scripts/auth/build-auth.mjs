// Generador del CSS de las páginas /sign-in y /sign-up desde el export de
// Claude Design (auth). Toma el CSS crudo del export (auth-layout.css, en esta
// carpeta) y produce src/components/auth/authDesign.css, con CADA selector
// scoped bajo `.av` (no toca el resto del app) + parches de integración:
// contenedor de scroll propio y SWAP de lados (formulario izquierda, marca
// derecha). El formulario lo dibuja Clerk embebido en .formpane (ver AuthShell
// + vechatAuthPageAppearance en src/lib/clerkAppearance.ts).
//
// Re-generar:  node scripts/auth/build-auth.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(HERE, "../../src/components/auth/authDesign.css");
const css = readFileSync(resolve(HERE, "auth-layout.css"), "utf8");

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
  return sel.split(",").map((s) => {
    s = s.trim();
    if (!s) return s;
    if (s === ":root" || s === "body" || s === "html") return ".av";
    if (s.startsWith("body ")) return ".av " + s.slice(5);
    if (s.startsWith(":root ")) return ".av " + s.slice(6);
    return ".av " + s;
  }).join(", ");
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
const banner = `/* AUTO-GENERADO desde el export de Claude Design (auth). CSS del login/registro,
   con CADA selector scoped bajo .av para no tocar el resto del app. Tokens de
   marca y fuentes los hereda del app. No editar a mano: re-generar con
   scripts/auth/build-auth.mjs. */\n`;
const patches = `
/* ── Parches de integración (no vienen del export) ───────────────────────── */
.av { height: 100dvh; overflow-y: auto; }
/* SWAP de lados: el form va a la IZQUIERDA y la marca (oscura) a la DERECHA.
   En el DOM el form va primero (mejor para lectores de pantalla); las columnas
   le dan a la marca el lado ancho a la derecha. */
.av .shell { grid-template-columns: 0.98fr 1.02fr; }
/* Clerk embebido en .formpane: ocupa el ancho del .formcard, sin tarjeta propia.
   min-height reserva el alto del formulario para que no salte al hidratar Clerk. */
.av .av-clerk { margin-top: 22px; width: 100%; min-height: 360px; }

/* Skeleton mientras Clerk carga (sin flash en blanco). Orden del diseño:
   inputs ARRIBA, social ABAJO. */
@keyframes av-shimmer { 0%,100% { opacity: .5; } 50% { opacity: .9; } }
.av .av-sk { display: flex; flex-direction: column; gap: 13px; animation: av-shimmer 1.4s ease-in-out infinite; }
.av .av-sk-lbl { width: 36%; height: 11px; border-radius: 6px; background: var(--line); }
.av .av-sk-input { height: 48px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
.av .av-sk-btn { height: 50px; border-radius: 12px; background: color-mix(in srgb, var(--green) 50%, var(--surface)); margin-top: 4px; }
.av .av-sk-div { height: 1px; background: var(--line); margin: 16px 0; }
.av .av-sk-social { height: 48px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line); }
@media (prefers-reduced-motion: reduce) { .av .av-sk { animation: none; } }

/* Orden del formulario de Clerk: campos ARRIBA, "Continuar con Google" ABAJO
   (como el diseño). Clerk ignora layout.socialButtonsPlacement por componente,
   así que reordenamos el flex de .cl-main. Scoped a .av → no toca el modal. */
.av .cl-main { display: flex; flex-direction: column; }
.av .cl-form { order: 1; }
.av .cl-dividerRow { order: 2; margin: 18px 0; }
.av .cl-socialButtonsRoot { order: 3; }
`;
writeFileSync(OUT, banner + scoped + patches);
const bal = (scoped.match(/{/g) || []).length - (scoped.match(/}/g) || []).length;
console.log("authDesign.css escrito:", (banner + scoped + patches).length, "bytes | balance:", bal);
