# VeChat — Foco y posicionamiento

- **Fecha:** 2026-06-15
- **Estado:** Aprobado (fuente de verdad de VeChat)
- **Alcance:** SOLO VeChat (el lado consumidor). El marco Mulfex y los productos
  de negocios quedan fuera de este doc; ver specs/visión maestra aparte.

## Por qué existe este doc

Al preparar el SEO/posicionamiento salió una tensión: lo que la app comunica
hoy ("ChatGPT criollo / asistente general") apunta a una identidad que la
visión ya quería dejar atrás. Antes de grabarle a Google y a las IAs una
identidad equivocada, paramos a aclarar **qué es VeChat, cuál es la meta y cómo
crece** — para que la ejecución (incluido el SEO) no tenga errores. Esta es la
foto acordada.

## 1. Qué es VeChat (visión)

**La IA venezolana.** Asistente general **hoy** → puerta a lo **local** mañana.
El chat es la puerta; *resolver tu vida en Venezuela* es el destino.

No replanteamos el rumbo general → local (sigue intacto desde la visión del
14-jun). Lo que este doc afina es la **punta**: con qué identidad y sustancia se
presenta VeChat al mundo en la fase actual.

## 2. Posicionamiento (la punta)

> **"VeChat — la IA venezolana. La que sabe lo de aquí, ahorita."**

Dos capas que se apilan (no compiten):

- **Identidad (el gancho):** *la IA venezolana.* Orgullo, memorable, propia
  (ownable), buen término de búsqueda. En Venezuela el "hecho aquí" pega fuerte,
  dentro y en la diáspora.
- **Sustancia / la cuña (la razón para creer):** **datos locales en vivo** — el
  dólar de hoy, los trámites reales, lo que abre cerca. Es lo que ChatGPT,
  Gemini o Meta AI **no tienen y no pueden copiar**.

**Regla:** lideramos con la cuña local-en-vivo + la identidad venezolana. Lo
general (código, estudio, redacción, traducción) se menciona como **bonus**,
nunca como el titular.

**Por qué no liderar con "asistente general":** ahí competimos contra ChatGPT
y compañía — gratis, en español, más potentes, con marca. Es la única pelea que
no se gana. El "sabe de Venezuela" solo es defendible si significa datos locales
en vivo, no tono ni recetas.

**Por qué la identidad sola no basta:** "venezolana" dice de dónde eres, no qué
haces mejor. Sin la cuña detrás, corre el riesgo del "carro nacional" (orgullo,
pero dudan de la calidad frente al importado) y sigue perdiendo contra el
ChatGPT gratis. Identidad + cuña = foso.

## 3. Meta ahora (próximos 3–6 meses)

**Crecer la audiencia correcta.** No "usuarios" en bruto, sino **usuarios que
vuelven por lo venezolano**. Se necesita audiencia para luego vender a los
negocios (lado oferta), pero la masa de gente que quiere IA general gratis es
crecimiento de **vanidad**: cuesta inferencia, no paga (ChatGPT es gratis) y se
va apenas note que el otro es mejor.

- **Métrica norte:** retención en consultas de **intención local / venezolana**,
  no registros sueltos ni totales de usuarios.

## 4. Cómo crece (canales)

- **Motor: cuña + viralidad.** El valor compartible (compartir conversación,
  WhatsApp, TikTok/IG) es de donde sale el crecimiento de una IA de consumo en
  Venezuela.
- **SEO/GEO = higiene, no motor.** Para un chat logueado sin contenido público,
  el techo del SEO es bajo, y el SEO solo amplifica lo que ya eres. Se mantiene
  la base técnica barata (robots, sitemap, llms.txt, metadata, JSON-LD) pero no
  se apuesta el crecimiento a ella.

## 5. Movida barata clave: capturar la intención local desde ya

El chat general **ya** recibe consultas locales ("¿dónde como pabellón en
Maracay?"). Loguear esa demanda ahora — montado sobre el chat actual, casi
gratis — sirve para:

- **(a)** La **prueba** que se le muestra a los negocios mañana (hay demanda
  real, aquí está).
- **(b)** La **brújula**: qué vertical y qué ciudad construir primero.

No es fase 2: la captura de datos de intención local es de **fase 1**, montada
sobre lo que ya existe.

## 6. Qué NO es (guardas anti-error)

- **No** es "otro ChatGPT general" — no se lidera con utilidad amplia.
- **No** perseguimos números de vanidad — la métrica es retención local.
- **No** apostamos el crecimiento al SEO — es higiene.

## 7. Implicaciones concretas (próximos pasos)

1. **Reescribir el posicionamiento público / SEO** liderando con "la IA
   venezolana + la cuña local-en-vivo" (en vez de "asistente general"):
   landing, `metadata`, `public/llms.txt` y el JSON-LD (incluida la FAQ).
2. **Logueo de intención local:** detectar y registrar las consultas con
   intención local/venezolana del chat (demanda) — diseño aparte.

Cada uno se lleva a su propio plan de implementación cuando toque.

## Referencias

- Visión general Mulfex y rumbo general → local: memoria del proyecto
  (`mulfex-vision`, `vechat-rumbo-vision`) y
  `docs/superpowers/specs/2026-06-14-rumbo-vechat-vision-maestra-design.md`.
- SEO técnico ya implementado (2026-06-15): `src/app/robots.ts`,
  `src/app/sitemap.ts`, `public/llms.txt`, `src/app/layout.tsx` (metadata),
  `src/components/landing/Landing.tsx` (JSON-LD).
