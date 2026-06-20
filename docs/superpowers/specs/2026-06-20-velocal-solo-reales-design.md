# VeChat: solo negocios reales de VeLocal + captura de demanda

**Fecha:** 2026-06-20
**Estado:** implementado (lado Vercel)

## Problema

VeChat **inventaba negocios** locales (ej. conversación real: listó "Café Quindío",
"La Cesta", "El Mesón de la Mancha"… ninguno existe en VeLocal — solo Mantuano y
La Vid son reales) y luego se contradecía. Esto destruye la propuesta de valor
("la IA que sabe lo de aquí"): un usuario que va a un negocio inexistente pierde
la confianza al instante. **Inventar es peor que no saber.**

### Causas raíz
1. Nada le prohibía al modelo inventar negocios (el prompt base es neutral; el
   `answerHint` solo describía los encontrados).
2. El grounding local solo se disparaba con match. Cuando `localQuery` daba 0
   resultados, el flujo **caía al genérico** y el modelo rellenaba inventando.

## Decisión

**Solo negocios que estén en VeLocal.** Nunca inventar. Cuando no tenemos algo:
ser honesto **+ convertir el hueco en oportunidad** (captura de demanda).

## Diseño

### 1. Honestidad en el "sin match" (`/api/web-context`)
Cuando `localQuery` dispara pero `searchLocalBusinesses` devuelve 0:
- NO cae al genérico. Devuelve `kind: "local_business"` con `businesses: []` y un
  `answerHint` que instruye: *"aún no tienes ese negocio en VeChat; NUNCA inventes
  nombres/direcciones/horarios; ofrece buscar en web o di que estás sumando
  negocios"*. El modelo responde honesto, sin tarjetas.
- `ChatInterface.groundQuestionIfNeeded` ahora usa el `answerHint` aunque
  `businesses` venga vacío (antes exigía `length > 0`).

### 2. Captura de demanda (`demand_signals`)
Cada "sin match" registra una **señal de demanda** (`logDemand`): `term`, `city`,
`query`, `clerk_user_id`. Best-effort (jamás rompe el chat). Tabla con RLS ON
(solo service role).

### 3. Panel "a quién reclutar" (admin → Métricas)
`getStats` agrega `demandaSinCobertura` (top por `term · city`, 30 días).
`MetricsTab` lo muestra como **"Lo más pedido que NO tenemos"** → la lista de
negocios/categorías a reclutar para VeLocal. Cold-start como pipeline de ventas.

## Respaldo pendiente (VPS)
Un freno global anti-invención en el `baseInstruction` del orquestador cubriría
los follow-ups que NO disparan `localQuery` (ej. "¿qué otras opciones hay?").
Editado y listo en `C:\tmp\orchestrator.ts`; aplicar requiere autorización
explícita de deploy al VPS (bloqueado por el guardrail de seguridad).

## Fuera de alcance
- Reconocer negocios por nombre propio ("Café Quindío") como entidad distinta.
- Rediseño visual de la tarjeta (VeChatBizCard) — va en su propio ciclo.
