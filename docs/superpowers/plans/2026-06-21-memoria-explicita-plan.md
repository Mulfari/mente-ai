# Quitar "intereses" auto-aprendidos + Memoria explícita (estilo ChatGPT)

**Fecha:** 2026-06-21
**Por qué:** los intereses auto-extraídos son RUIDO (datos reales lo confirmaron:
"Abuscalo", "Pero", "Saludos", "Queda"…). `extractTags` agarra palabras sueltas
de las preguntas. Net-negativo: ensucia el panel del usuario y mete ruido al
modelo. Se reemplaza por **memoria explícita** (hechos claros que el usuario
controla), que sí cambia respuestas.

**Ya hecho:** el chat dejó de enviar `interests` al modelo (ChatInterface, los 2
caminos → `interests: ''`).

---

## Parte A — Quitar los intereses auto-aprendidos
Cleanup multi-archivo (todo DELETE, bajo riesgo, pero verificar cada paso):

1. **`/api/track-query`**: quitar `extractTags` + el RPC `bump_user_interests` +
   la re-materialización en `user_context.interests`. (Mantener el resto del
   tracking/`query_events` si lo hay.)
2. **UI**: quitar el grupo de chips de intereses del **ContextTab** (AccountMenu)
   y el input "Intereses" de **ContextEditor.tsx** (página `/context`, legacy).
   Dejar **nombre + ciudad** (eso sí sirve: alimenta negocios locales).
3. **Feed "Para ti"** (`feed.ts` `getForYou` / `TrendingFeed`): que NO dependa de
   `user_interests`; cae a "Preguntando ahora"/tendencias. (Reactivar con la
   memoria explícita en la Parte B si se quiere.)
4. **`feedDigest.ts`**: quitar `refineUserInterests` del cron.
5. **APIs**: `/api/user-context/interests` → eliminar; `/api/user-context/save` →
   dejar de aceptar/guardar `interests`.
6. **Datos**: `update user_context set interests = null`; opcional `drop table
   user_interests` + el RPC `bump_user_interests` + la migración. (O dejar la tabla
   dormida; preferible borrarla, es ruido.)
7. **Verificar**: chat funciona sin interests; panel solo nombre/ciudad; feed cae
   con gracia; build + tests.

---

## Parte B — Memoria explícita (estilo ChatGPT)
Hechos DURABLES y útiles que el usuario controla. Limpio, no ruido.

### Datos
- Tabla `user_memory (id uuid, user_id uuid, fact text, source 'model'|'manual',
  created_at)`. RLS ON (solo API). Cap ~20 por usuario (poda el más viejo).

### Cómo se GUARDA un hecho
- **Vía el modelo (preferido):** reusar el mecanismo `context_delta` que el
  orquestador YA emite (vimos `{"context_delta":{"add_notes":"..."}}`). Cambio:
  en vez de notas/intereses ruidosos, que escriba **un hecho corto y durable** a
  `user_memory`. Guardrail en el prompt: guardar SOLO datos estables que el
  usuario afirme de sí mismo ("vivo en Maracay", "soy vegetariano", "me interesa
  el trading"), NUNCA fragmentos de la pregunta ni cosas transitorias.
- **Con el agente (Bloque 3):** una tool `save_memory(fact)` que el modelo llama
  cuando el usuario declara algo durable. (Más explícito y confiable que
  context_delta; ideal cuando el agente sea el cerebro.)
- **Manual:** el usuario agrega/edita/borra hechos en el panel.

### Cómo se USA
- Inyectar los hechos de `user_memory` (lista corta) en el contexto del chat,
  reemplazando el viejo `interests`. Limpio → el modelo sí lo aprovecha.

### UI (AccountMenu → "Memoria")
- Lista de hechos guardados con botón **borrar** por hecho + **agregar** manual
  (como "Manage memory" de ChatGPT). Mensaje cuando el modelo guarda algo:
  "✓ Lo recordaré" (sutil, como ChatGPT).

### Guardrails
- Cap de hechos; el usuario puede borrar cualquiera; nada se guarda sin ser un
  hecho durable; opción de "desactivar memoria".

### Orden sugerido
1. Tabla `user_memory` + inyección en el chat + UI de gestión (manual primero).
2. Escritura por el modelo vía `context_delta` (VPS) con el guardrail nuevo.
3. Cuando el agente sea default: la tool `save_memory`.

## Nota
Parte A se puede hacer ya (es limpieza). Parte B conviene como pieza propia,
idealmente junto a la migración del agente (la tool `save_memory` encaja ahí).
