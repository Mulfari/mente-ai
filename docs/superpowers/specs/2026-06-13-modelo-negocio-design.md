# Modelo de negocio VeChat — diseño

**Fecha:** 2026-06-13
**Estado:** aprobado (pendiente implementación)

## Objetivo

Cambiar el modelo de uso de VeChat de **pago puro con activación manual**
(toda cuenta nueva nace bloqueada) a un **freemium de adquisición**: la gente
prueba gratis con un límite diario y de ahí convierte a un plan pago. La meta
principal es que los visitantes puedan probar el producto sin fricción y
engancharse antes de pedirles pagar.

## Estado actual (punto de partida)

- Registro libre con Clerk, pero la cuenta nace con `subscription_weeks = 0`.
- `getBlockReason()` (ChatInterface): con `weeks === 0` devuelve
  `canSend:false, canWrite:false` — la persona **no puede ni escribir**.
- `/api/chat`: si `subscription_weeks <= 0` → error 403. Existe un
  `HOURLY_LIMIT = 20` con cooldown de 5 min, pero es **código muerto**: los de
  0 semanas se bloquean antes de alcanzarlo.
- Activación: admin agrega semanas a mano, o la persona canjea un cupón.
- `subscription_weeks = -1` significa acceso ilimitado (admin).

## Los tiers

| Tier | Acceso | Cómo se llega |
|---|---|---|
| **Visitante** (sin cuenta) | Escribe **1 pregunta** de prueba; al enviarla se le pide registro | Funnel actual, sin cambios |
| **Gratis** (registrado) | **10 mensajes/día**, se reinician cada día. Todas las funciones | Toda cuenta nueva nace aquí |
| **Plan Semanal** ($2) | Chat **ilimitado** durante 7 días | Paga |
| **Plan Mensual** ($6) | Chat **ilimitado** durante 30 días | Paga |
| **Admin** | Ilimitado | Ya existe (`subscription_weeks = -1`) |

Decisiones de alcance confirmadas:
- **Gratis = todas las funciones** (voz, adjuntos, búsqueda); el único límite es
  la cantidad (10/día). No se reservan features como premium.
- **Visitante = 1 pregunta** antes del registro (igual que hoy).
- **Reset diario a medianoche hora Venezuela** (VET = UTC−4, o sea 04:00 UTC)
  para todos los usuarios.

## El cambio central

"Bloqueado" deja de ser el estado por defecto. Toda cuenta nueva nace en
**Gratis** con sus 10 mensajes/día. De hecho el **bloqueo total desaparece** del
flujo normal: una cuenta siempre puede al menos chatear gratis. El único caso de
"sin acceso" que se conserva es `status = 'inactive'`, reservado para un baneo
manual del admin (no es el camino de nadie por defecto). Se retira el límite
muerto de 20/hora y lo reemplaza el conteo diario del tier gratis.

### Qué pasa al vencer un plan pago

Cuando un plan semanal/mensual expira, el usuario **no se bloquea**: vuelve al
tier **Gratis** (10/día). Es coherente con el objetivo freemium — nadie queda
sin poder usar nada. (Esto reemplaza el comportamiento viejo donde
`weeks === 0` = bloqueo total.)

## Modelo de datos

### `profiles` — nuevos/ajustados campos

- `plan` (text): `'free' | 'weekly' | 'monthly' | 'unlimited'`. Fuente de verdad
  del tier. `unlimited` = admin. Reemplaza la interpretación implícita de
  `subscription_weeks`.
  - Nota de compatibilidad: se conserva `subscription_weeks`/`subscription_end`
    para no romper el admin existente; `plan` se deriva/sincroniza al activar.
    La decisión fina (mantener ambos vs. migrar del todo) se resuelve en el plan
    de implementación; el spec exige que **`/api/chat` y `getBlockReason` lean un
    único concepto de tier**, no dos señales contradictorias.
- `daily_msg_count` (int, default 0): mensajes enviados en la ventana diaria
  actual (solo cuenta para tier `free`).
- `daily_reset_at` (timestamptz): instante en que `daily_msg_count` vuelve a 0
  (próxima medianoche VE). Si `now >= daily_reset_at`, se resetea y se reprograma.

### Configuración editable desde el admin (sin redeploy)

Una fila de configuración (tabla `app_config` o similar, key/value) con:
- `free_daily_limit` (default 10)
- `price_weekly_usd` (default 2)
- `price_monthly_usd` (default 6)
- `plan_weekly_days` (default 7)
- `plan_monthly_days` (default 30)

El gating y la UI de precios leen de aquí; el admin los edita desde `/admin`.

## Lógica de control de acceso

### Servidor (`/api/chat`) — la verdad

1. Resolver el tier del perfil.
2. Si tier pago vigente o `unlimited` → permitir (sin tope).
3. Si tier `free`:
   - Si `now >= daily_reset_at`: `daily_msg_count = 0`,
     `daily_reset_at = próxima medianoche VE`.
   - Si `daily_msg_count >= free_daily_limit` → **429** con el momento del
     próximo reset.
   - Si no, permitir e **incrementar** `daily_msg_count`.
4. (El incremento ocurre solo para tier `free`; los pagos no consumen cuota.)

### Cliente (`getBlockReason`) — refleja, no decide

- Visitante: `canWrite:true, canSend:true` (al enviar dispara registro).
- Gratis con cuota disponible: `canSend:true`.
- Gratis sin cuota hoy: `canSend:false` con razón "límite diario alcanzado" +
  CTA a planes (bloqueo suave, ver abajo).
- Pago vigente / unlimited: `canSend:true`.

El contador de cuota restante se muestra en la UI (ej. "Te quedan 3 hoy") de
forma sutil; se nutre del mismo `daily_msg_count` que devuelve el perfil.

## Conversión (cómo se le muestra el límite)

Dos momentos, ambos cálidos (nunca un error rojo):

### 1. Aviso anticipado (le quedan pocos)

Cuando la cuota restante del día baja a **≤3**, aparece una píldora sutil
(verde de marca) **sobre el input**: *"Te quedan 3 mensajes gratis hoy"*. Antes
de ese umbral **no se muestra nada** — no abrumamos; el aviso aparece justo
cuando empieza a importar y siembra la idea de pasar a ilimitado. La cuota
restante se deriva de `free_daily_limit - daily_msg_count`.

### 2. Cupo agotado (bloqueo suave)

Al consumir el mensaje número (límite+1) del día, el input deja de aceptar
envíos y **se reemplaza por una tarjeta cálida** (no se borra ni se expulsa
nada; la conversación queda visible). La tarjeta contiene:

- Felicitación, no regaño: *"Llegaste a tus 10 mensajes de hoy"* con tono criollo
  (un emoji 🎉/ícono de confeti).
- **Cuenta regresiva** al próximo reset, derivada de `daily_reset_at`
  (ej. *"Se renuevan en 6 h 23 min"*). Es honesto y baja la ansiedad.
- Dos salidas: **"Ver planes"** (botón primario → modal de planes) y
  **"Tengo un cupón"** (→ flujo de canje existente).

El gating real lo impone `/api/chat` (429); esta tarjeta es el reflejo en UI.

### Modal de planes

Muestra Semanal ($2) y Mensual ($6) — montos leídos de la config — con dos vías
de pago **hoy**:
- **Canjear cupón** (sistema ya existente).
- **Pagar por WhatsApp**: botón con mensaje pre-armado; la persona paga
  (Pago Móvil/Zelle/USDT), manda comprobante, y el admin activa.

## Cobro mixto + activación centralizada

Pieza clave para no rehacer nada cuando se enchufe una pasarela: **una sola
función de activación de plan**, ej. `activarPlan(userId, plan, durationDays)`,
que:
- fija `plan`, `subscription_start`, `subscription_end`/semanas según corresponda;
- es llamada **hoy** por el admin (`/api/admin/*`) y por el canje de cupones;
- mañana podrá ser llamada por el webhook de una pasarela automática **sin tocar
  la UI ni la lógica de tiers**.

La pasarela automática queda **fuera de alcance** de esta iteración (YAGNI); solo
se deja la costura lista.

## Migración de cuentas existentes

- Cuentas con `subscription_weeks = 0` (bloqueadas hoy) → pasan a `plan = 'free'`.
- `subscription_weeks = -1` (admin) → `plan = 'unlimited'`.
- Cuentas con semanas > 0 vigentes → mapear al plan pago correspondiente.
- (Hoy solo hay 2 perfiles, ambos admin; la migración es trivial pero la
  contemplamos por correctitud.)

## Fuera de alcance (YAGNI)

- Pasarela de pago automática (solo se deja la función de activación lista).
- Diferenciación de features por tier (gratis tiene todo, limitado por cantidad).
- Planes anual u otros niveles.
- Reseteos por zona horaria del usuario (todos usan hora Venezuela).

## Criterios de éxito / verificación

- Cuenta nueva puede chatear de inmediato hasta el límite diario, sin que el
  admin la active.
- Al enviar el mensaje número (límite+1) del día, el servidor responde 429 y el
  cliente muestra el bloqueo suave + modal de planes.
- Tras el reset (medianoche VE) la cuenta gratis vuelve a tener sus mensajes.
- Un cupón / activación de admin sube el tier a pago y desaparece el tope.
- Al vencer un plan pago, la cuenta cae a Gratis (no a bloqueo total).
- Cambiar un precio/limite desde el admin se refleja en la UI y el gating sin
  redeploy.
- El gating real vive en `/api/chat`: saltarse el cliente no permite exceder la
  cuota.
