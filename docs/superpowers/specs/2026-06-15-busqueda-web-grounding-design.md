# VeChat: búsqueda web / grounding — diseño

**Fecha:** 2026-06-15
**Estado:** borrador (para revisión)

## Objetivo

Que VeChat deje de **inventar** en preguntas de actualidad o factuales (el caso
que disparó esto: el modelo afirmó que "Venezuela va al mundial", que es falso).
La meta es **conectar el modelo a información real de internet** antes de
responder, de modo que en temas actuales conteste con **fuentes verificables y
citas**, y que cuando no tenga base confiable lo **admita** en vez de rellenar.

No se trata de "que el chat navegue por todo"; se trata de **grounding**: traer
unas pocas fuentes buenas y obligar al modelo a apoyarse en ellas.

## El problema (por qué alucina)

Un LLM no consulta internet: genera el texto **más probable** según su
entrenamiento, con una **fecha de corte**. Para hechos que cambian
(eliminatorias, precios, noticias, trámites) tiene datos viejos o ninguno, así
que **rellena con algo verosímil** y lo afirma con seguridad. Eso es una
alucinación. Modelos chicos/baratos (probable el de `api.selectapi.vip`)
alucinan más.

## Estado actual (punto de partida)

- El chat arma el prompt en el **VPS orchestrator** (`203.161.47.133`, fuera de
  este repo). El cliente le manda directo a `${vpsUrl}/api/stream` el payload
  `{ mode, question, attachments, user_context, conversation_history }`. **No
  hay grounding**: el modelo responde solo con su memoria.
- Existe un `/api/research` (comando manual `"investiga X en Y"`) que entra por
  **SSH** a un segundo VPS (`177.7.46.156`) y corre un `research.py` que scrapea
  y guarda JSON. Es clunky, manual y — **importante** — tiene un **password root
  en texto plano en el código**, con el **repo público en GitHub**. Se deprecia.
- El bubble del chat ya renderiza **enlaces markdown** → las citas se ven bien
  sin trabajo extra.

## Decisión de proveedor de búsqueda

**Elegido para la Fase 1: [Tavily](https://tavily.com).** Justificación:

- Es una **API de búsqueda hecha para LLMs**: una sola llamada POST devuelve
  resultados **limpios y resumidos** (título, URL, snippet) listos para inyectar
  al prompt, e incluso un campo `answer` opcional. Menos post-procesamiento que
  una API de búsqueda cruda.
- **Plan gratis** generoso para arrancar (suficiente para validar), precio por
  consulta razonable después.
- Soporta `include_domains` / `exclude_domains` → podemos sesgar a **fuentes
  locales VE** (tasa del dólar, `gob.ve` para trámites, medios confiables).
- Integración trivial (key en env, fetch server-side). Mantenemos **nuestro
  modelo** actual; solo lo alimentamos mejor.

Alternativas consideradas (no elegidas para Fase 1):

| Proveedor | Por qué no (ahora) |
|---|---|
| **Brave Search API** | Buena y privada, pero devuelve resultados **crudos** → más trabajo de resumen/limpieza. Plan B si Tavily no convence en calidad/costo. |
| **Exa** | Búsqueda semántica fuerte para investigación, pero overkill para Q&A de actualidad. |
| **Serper / SerpAPI (Google)** | Buena calidad pero es raspar Google (zona gris de ToS) y más caro. |
| **Perplexity Sonar** | Excelente: responde con web en vivo + citas, casi sin construir. Pero **reemplaza** nuestro modelo para esas consultas (otro estilo y costo). Reservado para **Fase 2** como ruteo de las preguntas más duras de actualidad. |

## Arquitectura — dónde se conecta

El prompt se arma en el VPS, pero la **lógica de búsqueda vivirá en Next** (en
este repo): así queda **versionada, testeable y desplegada por Vercel**, y la key
de Tavily nunca toca el cliente. El VPS solo cambia para **leer un campo nuevo
`web_context`** y tejerlo en el system prompt.

```
Cliente
  → /api/auth/vps-token            (ya existe)
  → POST /api/web-context          (NUEVO, Next): decide si buscar; si sí, Tavily
                                     → { used, sources:[{title,url,snippet}] }
  → VPS /api/stream                con web_context añadido al payload
       → el VPS inyecta las fuentes en el system prompt y responde citando
```

- **Decisión:** un endpoint dedicado `/api/web-context` (paso previo) en vez de
  meter la búsqueda dentro del stream, para **no tocar** el camino de streaming
  que ya funciona. Alternativa: revivir el proxy `/api/stream` de Next (hoy sin
  usar) y que él busque y reenvíe; queda anotado como opción si preferimos un
  solo punto.
- El **único cambio en el VPS**: aceptar `web_context` y, si viene, anteponer al
  system prompt algo como: *"FUENTES WEB (usa SOLO esto para datos actuales y
  cita con enlaces markdown; si no alcanza, dilo): …"*.

## Cuándo buscar (detector)

Buscar en **toda** pregunta es caro e innecesario. Capas:

1. **Heurística barata (regex/keywords)** primero: dispara con señales de
   actualidad/tiempo y factuales — `hoy`, `actual`, `ahora`, `último`,
   `2025/2026`, `precio`, `cuánto cuesta`, `tasa`, `dólar`, `cuándo`, `quién
   ganó`, `resultado`, `noticia`, nombres propios + tiempo.
2. **Clasificador LLM barato (opcional)** para los casos ambiguos: reutilizar el
   `FEED_LLM` (MiniMax, ya configurado) con un prompt "¿necesita web? sí/no".
3. **Default conservador:** si parece factual/actual y hay duda → buscar (el
   costo de una búsqueda es bajo frente a una alucinación).

Preguntas de opinión, creatividad, código, charla → **no** se busca.

## Formato de citas

El modelo cita con **enlaces markdown** (`[texto](url)`) inline y/o una sección
**"Fuentes"** al final. El bubble ya los renderiza. Regla en el prompt: *no
inventar URLs; solo usar las provistas*.

## Cambios al system prompt (el cambio más barato, va sí o sí)

Independiente de la búsqueda, agregar al system prompt del VPS reglas
anti-alucinación:

- *"Si no tienes información confiable o actualizada, **dilo** y no inventes."*
- *"Para temas actuales (deportes, precios, noticias, fechas) usa **solo** las
  fuentes provistas en FUENTES WEB; si no hay, admite que no tienes el dato al
  día."*
- *"No afirmes hechos puntuales (resultados, cifras, fechas) sin respaldo."*

Esto solo ya reduce las alucinaciones seguras como la del mundial.

## Costo y control

- Buscar **solo cuando el detector lo pide**; top **5** resultados.
- **Caché** por query normalizada (p. ej. 15–30 min) para no repetir búsquedas
  iguales (el dólar de hoy lo preguntan mil personas).
- **Tope diario de búsquedas por usuario** (sobre todo tier gratis) para evitar
  abuso de costo; reusar la lógica de cuota que ya existe.

## Fuentes locales VE

Vía `include_domains` configurable: monitores de tasa para dólar, `*.gob.ve`
para trámites (SAIME, SENIAT), medios confiables. Editable sin redeploy (tabla
`app_config` o similar), igual que el resto de config.

## Seguridad (urgente, en paralelo)

1. **Rotar YA** el password root de `177.7.46.156` — está expuesto en el repo
   público.
2. Sacarlo del código → variable de entorno; el `/api/research` viejo se
   **deprecia/reemplaza** por la búsqueda nueva.
3. Idealmente **limpiar el historial de git** (la credencial vivió en commits
   anteriores); como mínimo, asumir comprometida y rotada.

## Fases

- **Fase 1 (este spec):** system prompt anti-alucinación + `/api/web-context`
  con Tavily + detector heurístico + el VPS consume `web_context` y cita.
  Resuelve el 80% de los casos de actualidad.
- **Fase 2:** volverlo **agéntico** (tool `web_search` con function-calling, el
  modelo decide y puede investigar en varios pasos) **si** el modelo de
  `api.selectapi.vip` soporta tools; o **rutear** las preguntas más duras de
  actualidad a **Perplexity Sonar**.

## Fuera de alcance

- Navegación libre / agente que hace clic en páginas.
- Reemplazar el modelo del chat (aparte; ver pregunta abierta).
- RAG sobre documentos propios del usuario.

## Preguntas abiertas

- ¿Qué modelo exacto sirve `api.selectapi.vip` y **soporta function-calling**?
  (Define si la Fase 2 agéntica es viable o vamos por ruteo a Perplexity.)
- ¿Vale la pena **subir a un modelo más fuerte** para el chat? El grounding
  ayuda igual, pero un modelo mejor + grounding es lo ideal.
- ¿El detector arranca solo-heurística o ya con el clasificador LLM barato?
