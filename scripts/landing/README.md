# Landing v2 — generador

La landing (deslogueado) es un diseño hecho en **Claude Design** (export
"vechat-landing") y portado al app de forma **integrada, no pegada**.

## Fuente
- `landing-body.html` — markup crudo del export (extraído del bundle JS-inyectado).
- `landing-design.css` — CSS crudo del export (sin los `@font-face`: las 4 fuentes
  ya las carga el app por `next/font`).

## Generar
```bash
node scripts/landing/build-landing.mjs
```
Produce los dos artefactos que consume `src/components/landing/Landing.tsx`:
- `landingMarkup.ts` — el HTML con los CTA cableados a `/sign-up` · `/sign-in`
  y placeholders `__PRICE_WEEKLY__` / `__PRICE_MONTHLY__` / `__FREE_LIMIT__`
  (los sustituye el server con `appConfig`).
- `landingDesign.css` — el CSS con **cada selector scoped bajo `.lp`** (no toca
  el chat), keyframes renombrados a `lp-*`, y un parche móvil para el `<nav>`
  (el diseño es desktop-first).

No editar `landingMarkup.ts` / `landingDesign.css` a mano: se regeneran.
