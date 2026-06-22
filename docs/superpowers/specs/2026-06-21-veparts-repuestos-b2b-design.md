# VeParts — Marketplace B2B de repuestos (diseño v1)

- **Fecha:** 2026-06-21
- **Autor:** Jose Mulfari (brainstorm con Claude)
- **Estado:** Aprobado (diseño) — pendiente plan de ejecución
- **Marco:** Producto vertical de negocios dentro de **Mulfex** (ver memoria
  `mulfex-vision`). Tercer vertical después de VeLocal y Express Printer.

## 1. Resumen en una línea

VeParts conecta **talleres** (que necesitan repuestos) con **tiendas/distribuidores
de repuestos** (que los venden). El taller consulta por WhatsApp en lenguaje
natural; VeParts busca en los catálogos de las tiendas y, si no hay match,
difunde la consulta para que las tiendas coticen. La **tienda paga** por el flujo
de demanda. La data de repuestos queda en la DB compartida y alimenta VeChat, y
más adelante VeShop.

## 2. Quién es quién

| Actor | Rol | Paga | Canal |
|---|---|---|---|
| **Tienda / distribuidor** | Tiene el stock | **Sí** (suscripción mensual) | Panel web (Clerk) |
| **Taller** | Necesita el repuesto, genera la demanda | No (lado gratis) | Bot de WhatsApp (sin cuenta) |

La lógica de negocio: la tienda paga porque VeParts le lleva demanda real de
talleres = más ventas. El taller es el lado gratis que hace valioso al producto;
mientras más talleres consultan, más vale para la tienda.

## 3. El loop (flujo central)

1. **Ingesta:** la tienda manda lo que tenga (Excel, foto del estante, lista en
   PDF). La IA lo digitaliza y arma un catálogo estructurado. La tienda revisa y
   corrige antes de publicar.
2. **Consulta:** el taller escribe por WhatsApp, p. ej. *"necesito pastillas de
   freno para Corolla 2015"*.
3. **Parseo:** la IA extrae parte + vehículo (marca/modelo/año) de la consulta.
4. **Búsqueda instantánea:** VeParts busca en los catálogos de las tiendas de la
   ciudad y responde con las que tienen el repuesto (nombre, precio, disponible,
   horario, ubicación, botón de contacto).
5. **Difusión (si no hay match):** VeParts ofrece difundir la consulta a las
   tiendas relevantes; ellas responden con cotización (precio + disponibilidad);
   el taller recibe el resumen.
6. **Downstream:** el catálogo vive en la DB compartida → VeChat lo descubre
   (igual que a VeLocal) → más adelante VeShop lo vende.

## 4. Arquitectura

Sigue el **patrón VeLocal** (vertical independiente que comparte la DB con VeChat,
sin tocar el código de VeChat).

- **Repo nuevo:** `Mulfari/veparts` (separado de VeChat y VeLocal).
- **Frontend/Backend:** Next.js (App Router) + Tailwind, deploy en Vercel.
- **Auth:** **Clerk app nueva** — solo para tiendas (el panel web). Los talleres
  NO crean cuenta; se identifican por su número de WhatsApp.
- **DB:** Supabase compartido (`swioimqjygpolttiequz`), tablas propias con prefijo
  `veparts_`. RLS ON en todas (solo rutas API con service role +, si aplica,
  policies por tienda con el token de Clerk como en VeChat).
- **WhatsApp:** Meta WhatsApp Cloud API (oficial) vía webhook a una ruta Next
  (`/api/wa/webhook`). Es el mayor bloqueo operativo (número business +
  verificación de Meta + plantillas). Para el piloto se puede arrancar
  **semi-manual** (un humano opera el número) y automatizar después.
- **IA de ingesta:** Claude (visión) para fotos/PDF; Excel/CSV se parsea directo.
  Extracción estructurada + **normalización/canonicalización** de nombres de
  parte (el naming de repuestos es caótico) — patrón análogo al feed digest de
  VeChat. LLM agnóstico vía variables de entorno.
- **Matching:** Postgres full-text (`search_tsv` con `unaccent`, igual que la
  integración VeChat↔VeLocal) + filtros por vehículo (marca/modelo/año o rango).
  Embeddings semánticos = opcional fase 2 si el tsv se queda corto.

## 5. Modelo de datos (Supabase, prefijo `veparts_`)

> Nombres y columnas son la intención de diseño; los tipos exactos se afinan en
> las migraciones del plan.

- **`veparts_stores`** — tienda/distribuidor. Link a Clerk (`clerk_user_id` +
  `id` uuid interno, mismo patrón de identidades que VeChat), nombre, ubicación
  (lat/lng + ciudad), horario, whatsapp, estado de suscripción (plan, vigencia).
- **`veparts_products`** — catálogo. `store_id`, nombre/descripción de la parte,
  marca de la parte, número de parte (OEM / cross-reference), precio, stock
  (disponible sí/no o cantidad), vehículo compatible (marca/modelo/año o rango),
  `search_tsv`, `source` (ingestado vs manual), `updated_at`.
- **`veparts_ingestions`** — un documento subido. `store_id`, referencia al
  archivo, `status` (procesando / listo / error), items extraídos, payload crudo.
- **`veparts_requests`** — consulta del taller. Taller (número WhatsApp), texto
  original, parte/vehículo parseado, ciudad, `status` (matched / broadcast /
  cerrado), `created_at`.
- **`veparts_quotes`** — cotización de una tienda a un request difundido.
  `request_id`, `store_id`, precio, disponible, mensaje, `created_at`.
- **`veparts_workshops`** — taller liviano. Número WhatsApp, nombre, ciudad. Se
  crea on-first-contact.
- **`veparts_events`** (métricas) — consultas recibidas, matches, contactos, para
  justificarle a la tienda el valor de la suscripción.

## 6. Superficies

### 6.1 Panel web de la tienda (Clerk)
- Onboarding / alta de la tienda (datos, ubicación, horario, WhatsApp).
- Subir documento(s) → la IA arma el catálogo → **revisar/editar/publicar**.
- Dashboard de **leads**: consultas que matchearon su stock + cotizaciones
  pedidas (en la difusión).
- Métricas que muestran el valor (consultas, matches, contactos).
- Estado de suscripción.

### 6.2 Bot de WhatsApp del taller
- Entrada en lenguaje natural ("necesito X para tal carro").
- IA parsea parte + vehículo.
- Respuesta de búsqueda: top tiendas con precio, disponible, horario, ubicación,
  contacto.
- Si no hay match: ofrece difundir → difunde a tiendas candidatas → recoge
  cotizaciones → devuelve resumen al taller.

### 6.3 Flujo de difusión
Request → seleccionar tiendas candidatas (categoría + ciudad) → notificarlas
(panel + WhatsApp opcional) → ventana de tiempo para responder → cotizaciones
vuelven → el taller recibe un resumen comparado.

## 7. Monetización

- **Suscripción mensual** a la tienda. Sin pasarela automática.
- Cobro **cupón + WhatsApp manual**, reutilizando el patrón de VeChat
  (activación centralizada, config editable sin redeploy tipo `app_config`).
- Sin cobro al taller (lado gratis por diseño).

## 8. Integración con VeChat y VeShop

- `veparts_products` + `veparts_stores` viven en la DB compartida → VeChat los
  descubre con el mismo mecanismo que usa para VeLocal (recall por tags/tsv +
  ranking por distancia).
- Se publica un **contrato de datos versionado** (análogo a
  `vechat-velocal-contract`) para lo que VeParts expone a VeChat.
- **VeShop** (marketplace dentro de VeChat para vender productos, empezando por
  repuestos y luego ropa, etc.) es **fase futura, fuera del alcance del v1**.
  VeParts deja la data lista para él.

## 9. Alcance del v1 y orden de construcción

- **Hito 1 (núcleo del negocio):** panel de la tienda + ingesta IA del catálogo +
  búsqueda instantánea del taller con contacto. Esto ya prueba el negocio en el
  piloto.
- **Hito 2:** difusión / cotización.
- **Hito 3:** integración con VeChat (contrato + descubrimiento).

**Beachhead:** Maracay (consistente con el beachhead de VeChat).

**Fuera de alcance v1:** VeShop, pasarela de pago automática, app móvil nativa,
verticales que no sean repuestos.

## 10. Riesgos y mitigaciones

- **WhatsApp oficial:** verificación de Meta + número business es el cuello de
  botella. Mitigación: piloto semi-manual, automatizar después.
- **Calidad de la ingesta IA:** docs caóticos (fotos borrosas, listas
  manuscritas). Mitigación: la tienda **revisa y corrige** antes de publicar; la
  ingesta es asistida, no 100% automática.
- **Cold-start:** el bot del taller no sirve sin tiendas con catálogo cargado.
  Mitigación: cargar vos mismo las primeras tiendas (la ingesta IA lo hace
  barato) antes de abrir el lado de los talleres.
- **No tocar VeChat:** todo el desarrollo va en el repo nuevo; VeChat solo lee la
  DB compartida.

## 11. Decisiones tomadas en el brainstorm

1. Paga la **tienda/distribuidor**; el taller es gratis.
2. La data entra por **documento que la IA digitaliza** (no integración con POS
   ni carga 100% manual).
3. El taller obtiene **búsqueda instantánea + difusión** si no hay match.
4. Canal **híbrido:** taller por WhatsApp, tienda por panel web.
5. Arquitectura: **producto nuevo aparte** (patrón VeLocal), no módulo dentro de
   VeChat ni extensión de VeLocal.
6. Monetización: **suscripción mensual**.
7. Nombre de trabajo **VeParts**; beachhead **Maracay**.
