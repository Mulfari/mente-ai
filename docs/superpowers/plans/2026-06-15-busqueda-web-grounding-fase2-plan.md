# Búsqueda web / grounding — Fase 2 (plan)

**Fecha:** 2026-06-15
**Estado:** borrador (para ejecutar)
**Contexto:** Fase 1 ya está viva (detector heurístico → Tavily afinado → respuesta citada). Esto la mejora en cobertura, precisión, costo y casos difíciles. Mismo principio que Fase 1: cambios en Next/cliente, sin romper el chat, degradación con gracia, verificación por DB-poll.

## Caso que motiva (real): "¿qué pasó con gaspi?"
Buscó (bien) pero Tavily trajo "Chris Gasper" (nombre parecido en inglés) y el modelo lo dio como respuesta. Falla de **desambiguación de entidad** + el modelo **asumió** un nombre parecido. Lo ataca la Tarea 1.

## Orden y tareas

### Tarea 1 — Clasificador + reescritura de query + anti-confusión (máxima prioridad; arregla "gaspi" y caza más)
Hoy: el cliente usa `shouldSearchWeb` (keywords) y manda la pregunta CRUDA a Tavily. Se le escapan preguntas factuales sin palabra-gatillo (ej. "¿quién es el presidente?") y no desambigua.
- **Gate más amplio en el cliente:** además del heurístico, llamar a `/api/web-context` para mensajes que parezcan PREGUNTA factual (terminan en "?" o tienen interrogativos qué/quién/cuándo/dónde/cuánto/cuál). Saludos, código, "escríbeme…" NO disparan.
- **Clasificador barato server-side** en `/api/web-context`: un LLM económico (reusar `FEED_LLM` = MiniMax, ya configurado) devuelve `{ search: boolean, query: string }` → decide si vale buscar Y **reescribe la query** (entidad + contexto VE + intención). Esto resuelve "gaspi" (rewrite a algo buscable) y caza más casos.
- **Instrucción anti-confusión** en `buildGroundedQuestion`: "si las fuentes son sobre una persona/tema DISTINTO al preguntado (nombre parecido pero no igual), dilo y NO asumas que es la respuesta."
- **Recencia para "hoy/ayer":** si la pregunta es de hoy, `days` chico (2–3) en topic news.
- **Píldora:** mostrarla solo tras ~300ms de espera para que no parpadee en preguntas que el clasificador descarta.
- Verificación: "¿qué pasó con gaspi?" debe reescribir/“no encontré sobre Gaspi” en vez de dar a Gasper; "¿quién es el presidente de Venezuela?" debe buscar; un saludo NO.

### Tarea 2 — include_domains curados por intención, editables sin redeploy
- Tabla/columna en `app_config` (o tabla nueva `web_source_hints`): mapas intención→dominios (dólar→monitores+bcv.org.ve; deportes→medios; trámites→gob.ve; ya existe el de trámites hardcodeado).
- `/api/web-context` los lee (con caché corta) y arma `include_domains` según la intención detectada.
- Admin los edita en `/admin` (como el resto de config).

### Tarea 3 — Caché compartida + tope diario por usuario (costo)
- Hoy la caché es en memoria POR INSTANCIA (no comparte entre lambdas). Mover a **Supabase** (tabla `web_search_cache`: query normalizada, payload jsonb, expires_at) → cachea de verdad entre usuarios (el "dólar de hoy" se busca 1 vez).
- **Tope diario de búsquedas por usuario** (reusar patrón de cuota) para que el tier gratis no dispare costo de Tavily.

### Tarea 4 — Agéntico o ruteo a Perplexity (lo más grande; DECISIÓN pendiente)
- **Opción agéntica:** dar al modelo una tool `web_search` (function-calling) para que decida buscar e itere. REQUIERE confirmar que el chat (Claude Opus 4.6 vía selectapi.vip) soporta tool-calling por ese proxy.
- **Opción Perplexity Sonar:** rutear las preguntas más duras de actualidad a Perplexity (responde con web en vivo + citas). REQUIERE cuenta/API key Perplexity y aceptar otro proveedor/costo/estilo.
- **Decisión de Jose** antes de ejecutar esta.

## No-goals / riesgos
- El clasificador añade ~0.5–1.5s a preguntas factuales (no a chats normales). Mitiga: gate de preguntas + caché.
- Casos de actualidad muy fresca + nombre ambiguo (gaspi) siguen siendo lo más difícil; mejoramos, no garantizamos.
- Todo degrada con gracia: si el clasificador o Tavily fallan, se responde sin grounding (como hoy).

## Verificación (cada tarea)
`npm run build` + push + deploy READY + E2E **por DB-poll** (enviar pregunta, `select content from messages ... until in_progress=false`; NO depender del navegador que se cae en streams largos).
