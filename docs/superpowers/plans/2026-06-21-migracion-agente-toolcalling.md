# Migración del chat al agente (tool-calling) — plan

**Fecha:** 2026-06-21
**Estado:** piloto PROBADO. Falta la migración a producción.

## Dónde estamos
`/api/agent` (aislado, no toca el chat) funciona end-to-end: **Claude Haiku**
(`claude-haiku-4-5-20251001`, vía `ANTHROPIC_API_KEY`/`ANTHROPIC_BASE_URL`) con 3
tools — `get_dolar`, `search_local_businesses`, `search_web` — **decide solo** cuál
usar, groundea con datos reales y **no inventa**. No streaming aún.

## Objetivo
Que el agente sea el cerebro del chat, reemplazando el flujo actual (heurísticas
de grounding en Vercel + orquestador del VPS).

## Por qué se hace en su propia sesión (no rápido)
Toca el **flujo central del chat** — lo más frágil y de lo que dependen todos los
usuarios. Un error rompe el producto para todos. Se hace **detrás de un flag**,
con el flujo viejo intacto hasta probar el agente.

## Pasos (en orden, cada uno verificable)
1. **Streaming del agente** (`/api/agent` → SSE). Consumir el streaming de
   Anthropic (deltas de texto + `tool_use`), ejecutar tools, continuar, streamear
   el texto final. Emitir eventos propios: `tool_start` (qué herramienta corre),
   `chunk` (texto), `tool_data` (negocios/dólar/fuentes estructurados), `done`.
   Probar por curl/JS con la sesión.
2. **Flag** (`app_config.agent_enabled`, default OFF). Con OFF el chat sigue
   exactamente igual (cero riesgo). Con ON, un nuevo camino de envío en el cliente
   usa `/api/agent` en vez de `vps-token`+`/api/stream`.
3. **Cablear el cliente** (camino aislado, como `sendAnonMessage`): consume el SSE
   del agente; en `tool_data` de `search_local_businesses` setea `_businesses` →
   se renderizan las tarjetas + `BusinessMap` (ya existen); `get_dolar` → texto;
   `search_web` → chips de fuentes (`_sources`, ya existe).
4. **Persistencia/historial** (logueado): igual que hoy (upsert de mensajes).
5. **Probar con el flag ON solo para admin/Jose**; comparar contra el flujo viejo.
6. **Rollout gradual**: flag ON para un % → todos. Fallback al flujo viejo si el
   agente falla (try/catch → vps-token).
7. **Retirar el orquestador del VPS** del camino del chat (queda libre).
8. **Costo/modelo**: Haiku para el agente; medir costo real (hoy negligible con
   pocos usuarios); a escala, rutear (modelo barato para queries triviales) si
   hace falta. El feed sigue en MiniMax.

## Riesgo y mitigación
- Riesgo: regresión del chat logueado.
- Mitigación: el **flag** (paso 2) mantiene el flujo viejo como default + fallback;
  el camino del agente es **aislado** (no se edita el envío logueado existente);
  se prueba antes de flipear.

## Decisión pendiente de Jose
- Confirmar el **costo** de correr el chat en Claude (negligible ahora; relevante a
  escala). Sin ese OK, el agente queda como piloto/flag OFF.
