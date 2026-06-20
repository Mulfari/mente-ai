# Admin · tab "Métricas" (dashboard de estadísticas) — diseño

**Fecha:** 2026-06-19
**Estado:** diseño aprobado (export de Claude Design `VeChatMetrics.dc.html`);
pendiente plan de implementación.

## Objetivo

Agregar una pestaña **"Métricas"** al panel `/admin` existente para que el
fundador vea, de un vistazo: crecimiento de usuarios, uso/engagement, negocio
(planes/cupones) y geografía/contenido. **No** se crea un admin nuevo — es una
tab más sobre la estructura que ya existe (`AdminPanelClient` + `/api/admin/data`).

## Diseño (del export de Claude Design)

Fuente: `VeChatMetrics.dc.html`. Usa los tokens de VeChat (`--surface #FBF8F2`,
`--border #E6DFD2`, `--ink #2A2521`/`--ink-3 #9B9183`, `--brand #10A37F`,
`--track rgba(42,37,33,.07)`) y fuentes Inter + Bricolage Grotesque. Secciones:

1. **Resumen (KPIs):** grid de tarjetas (auto-fit minmax 150px). 9 tarjetas:
   Usuarios totales · Nuevos 7d · Nuevos 30d · Activos 7d · De pago vigentes ·
   Conversaciones · Mensajes · Consultas · Tocaron el límite (hoy). Delta opcional
   (flecha + valor) cuando aplica.
2. **Crecimiento:** "Registros por día" — barras (30 buckets, alto 112px).
3. **Uso:** dos tarjetas — "Mensajes por día" (sparkline SVG con área) y
   "Consultas por día" (barras).
4. **Negocio · geografía · contenido:** tres tarjetas — "Usuarios por plan"
   (barras horizontales + conteo y %), "Top ciudades" y "Top consultas" (listas
   con barra de proporción), ambas con **estado vacío** ("Sin datos todavía").

## Arquitectura

Separación limpia **datos ↔ visualización**:
- **Endpoint** `GET /api/admin/data?type=stats` (en la ruta admin existente,
  gateado por `requireAdmin()`): computa y devuelve **`MetricsData`** (números
  crudos). Service role (RLS off project-wide).
- **Componente** `src/components/admin/MetricsTab.tsx`: recibe `MetricsData` y
  hace la **viz** (las funciones `bars()`, `spark()`, `planRows`, `listRows` del
  `renderVals()` del export se portan tal cual). Markup portado a JSX con tokens
  reales de VeChat (`var(--surface)`, `var(--primary)`, `var(--text-primary)`,
  `var(--text-secondary)`, `var(--text-tertiary)`, `var(--border)`).
- **AdminPanelClient:** se agrega `"stats"` al tipo `Tab` y un botón "Métricas"
  en la barra de tabs; al activarla, carga `type=stats` y renderiza `<MetricsTab>`.

### Contrato `MetricsData`
```ts
type Kpi = { label: string; value: number; delta?: string };
type NamedCount = { name: string; count: number };
type MetricsData = {
  kpis: Kpi[];
  registros: number[];   // 30 enteros (hoy-29 … hoy)
  mensajes: number[];    // 30
  consultas: number[];   // 30
  planes: NamedCount[];  // Free, Semanal, Mensual, Ilimitado, Bloqueado
  ciudades: NamedCount[];      // top 10
  topConsultas: NamedCount[];  // top 10
};
```

### Cómo se computa cada métrica (server)
- **KPIs:**
  - Usuarios totales: `count(profiles)`.
  - Nuevos 7d/30d: `profiles` con `created_at >= now()-interval`.
  - Activos 7d: `profiles` con `last_message_at >= now()-7d`.
  - De pago vigentes: `subscription_end > now()`.
  - Conversaciones/Mensajes/Consultas: `count` de `conversations`/`messages`/`query_events`.
  - Tocaron el límite (hoy): `profiles` con `daily_reset_at` de hoy (medianoche VE)
    y `daily_msg_count >= free_daily_limit` (de `getAppConfig`).
  - Delta (opcional): nuevos del período vs período anterior; si es caro u 0, se
    omite (el componente maneja `delta` ausente).
- **Series 30d** (`registros`/`mensajes`/`consultas`): `date_trunc('day', created_at)`
  + `count` agrupado, **rellenado a 30 buckets** (días sin datos = 0), en orden
  cronológico, hora de Venezuela (UTC-4).
- **Planes:** traer campos mínimos de `profiles` (`status, subscription_weeks,
  subscription_end, role`) y clasificar con **`resolveTier()`** (fuente de verdad,
  sin duplicar en SQL); contar por tier → orden fijo Free/Semanal/Mensual/Ilimitado/
  Bloqueado. (Semanal/Mensual: distinguir por la duración del plan o `plan`/
  `used_coupon_label`; si no se puede separar limpio, colapsar en "De pago" — decidir
  en el plan.)
- **Ciudades:** `user_context.city` no nulo, `group by`, top 10.
- **Top consultas:** `query_events.prompt` (o el agregado del feed) `group by`,
  top 10; saltar vacíos/nulos.

## Detalles de portado
- Iconos: el export usa Phosphor (`<i class="ph …">`) en los estados vacíos; el
  app **no** carga Phosphor → reemplazar esos 2 por **SVG inline** (mapa, chat).
- Sin dependencias nuevas (la sparkline es SVG inline; barras son divs).
- Tema oscuro: al usar las variables reales de VeChat, funciona en claro y oscuro.

## Seguridad / rendimiento
- Gateado por `requireAdmin()` (igual que el resto del admin).
- Las agregaciones corren bajo demanda al abrir la tab; con la data actual
  (≈4 usuarios) es trivial. A escala: cachear o materializar más adelante (YAGNI hoy).

## No-objetivos (v1)
- Sin date-picker, sin export CSV, sin tiempo real, sin filtros.
- Granularidad diaria, ventana 30 días, listas top 10.

## Testing
- `npm run build` verde.
- Con la cuenta admin en prod: abrir la tab "Métricas" → KPIs cuadran con los
  conteos reales; las series y listas se ven; estados vacíos cuando corresponde.
- Regresión: las otras tabs (Usuarios/Cupones/Lugares/Config) siguen igual.

## Archivos
- Crear: `src/components/admin/MetricsTab.tsx`.
- Modificar: `src/app/api/admin/data/route.ts` (rama `type === "stats"`),
  `src/components/AdminPanelClient.tsx` (tab + carga + render).
- (Posible helper) `src/lib/adminStats.ts` para las agregaciones, si conviene
  sacarlas de la ruta.
