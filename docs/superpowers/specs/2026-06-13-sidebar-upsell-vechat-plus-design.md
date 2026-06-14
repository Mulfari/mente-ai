# Sidebar upsell "VeChat Plus" — diseño

**Fecha:** 2026-06-13
**Estado:** aprobado (pendiente implementación)

## Objetivo

Aprovechar el sidebar (espacio siempre visible del logueado) como conversión
pasiva para usuarios free: mostrar la cuota del día y un CTA al plan de pago,
sin recargar ni molestar. De paso, dar nombre de marca al tier de pago:
**VeChat Plus**.

## Alcance

### 1. Bloque de conversión en el sidebar (lo nuevo)

- Componente/bloque **encima del chip de cuenta**, dentro de `SidebarBody`
  (`src/components/chat/ConversationSidebar.tsx`).
- Visible SOLO cuando: `isFree` (tier free) **y** modo `expanded`. NO para
  pago/admin/banned, NO en el rail colapsado, NO deslogueado.
- Contenido:
  - Etiqueta "VeChat Plus" (verde de marca, sutil).
  - Cuota: "N de M mensajes hoy" + barra de progreso (consumido en verde).
  - Botón "Hazte Plus" → llama `onUpgrade()` (abre el `PlansModal` existente).
- Presentacional: el sidebar NO calcula tier ni cuota; los recibe por props.

### 2. Nombre de marca "VeChat Plus" (coherencia)

- `PlansModal` (`src/components/chat/PlansModal.tsx`): título
  "Hazte ilimitado" → "Hazte VeChat Plus". Semanal/Mensual siguen siendo las
  dos duraciones dentro del plan.
- `LimitReachedCard` (`src/components/chat/LimitReachedCard.tsx`): el texto
  "…o pásate a ilimitado" → "…o hazte VeChat Plus".
- `AccountMenu` (`src/components/AccountMenu.tsx`): la sección de planes
  encabeza con "VeChat Plus".

## Arquitectura / datos

`ChatInterface` ya tiene todo lo necesario:
- `isFreeTier` (= `resolveTier(profile) === "free"` con `isLoggedIn`).
- `quotaLeft()` y `appConfig.freeDailyLimit`.
- `setShowPlans(true)` (abre el `PlansModal`).

Pasa al `<ConversationSidebar>` (y este a `SidebarBody`) props nuevas:
- `showUpgrade: boolean` (= `isFreeTier`).
- `quotaUsed: number`, `quotaTotal: number` (para el texto y la barra).
- `onUpgrade: () => void` (= `() => setShowPlans(true)`).

El sidebar muestra el bloque si `showUpgrade && expanded`.

## Fuera de alcance (YAGNI)

- El chip de cuenta (queda solo avatar + correo, como está).
- El rail colapsado (sin bloque).
- Cambiar precios o planes (siguen Semanal $2 / Mensual $6).
- Mostrar cuota a usuarios de pago (no aplica; son ilimitados).

## Verificación

- Free con cuota: el bloque muestra "N de M" correcto, barra proporcional,
  y "Hazte Plus" abre el modal (con título "Hazte VeChat Plus").
- Pago/admin: el bloque NO aparece.
- Rail colapsado: el bloque NO aparece.
- El chip de cuenta sigue mostrando solo el correo.
