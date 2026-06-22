# Producto link-in-bio para negocios — v1 "Presencia"

- **Fecha:** 2026-06-14
- **Estado:** Borrador para revisión
- **Autor:** Jose Mulfari (con asistencia de Claude)
- **Contexto:** Primer producto de oferta de Mulfex (ver memoria `mulfex-vision`).
  Vendible por sí solo; alimenta el índice de VeChat.
- **Nombre:** **VeLocal** *(dominio por definir — decisión abierta)*

---

## 1. Objetivo

Una app aparte donde un dueño de negocio **registra su negocio, obtiene una
página pública (su link-in-bio) en minutos, y la usa en su bio de Instagram**.
Esa página, al crearse, **indexa la data del negocio en la misma base que VeChat
lee**, así que el negocio empieza a aparecer en las recomendaciones de VeChat sin
hacer nada extra.

Una pieza, dos beneficios: presencia/distribución para el negocio + oferta
descubrible para VeChat.

## 2. Alcance v1 (lo que SÍ entra)

- Registro del negocio (cuenta + ficha).
- Página pública link-in-bio con su link compartible.
- Indexación automática hacia la data que consume VeChat.
- Edición básica de la ficha desde un panel mínimo.
- Gratis.

**Fuera de v1** (fases siguientes): catálogo visual con fotos/precios (B),
carrito de pedidos (C), suscripción, patrocinado/destacado, estadísticas.

## 3. Actores

- **Dueño del negocio** — se registra, crea/edita su ficha, comparte su link.
- **Cliente final** — abre la página pública (desde Instagram o desde VeChat).
- **VeChat** — consume la data indexada para recomendar (no escribe aquí).

## 4. Flujo principal

1. El dueño entra a la página del producto → **Registrar mi negocio**.
2. Crea cuenta (Clerk) y llena un **formulario corto**: nombre, categoría,
   ciudad/zona, ubicación (mapa), WhatsApp, horario, logo, foto del menú,
   redes, descripción corta.
3. Al guardar: se genera su **página pública** con un **link único**
   (`<dominio>/<slug>`).
4. El dueño copia el link y lo pone en su bio de Instagram.
5. En el mismo guardado, la ficha **queda indexada** en la base que VeChat lee →
   aparece en "Cerca de ti"/recomendaciones (orgánico).

## 5. La página pública (anatomía v1)

Mobile-first (se abre desde Instagram). Tomar el boceto aprobado como base:

- Portada + logo + nombre del negocio.
- Estado **Abierto/Cerrado** calculado por horario + ciudad.
- Categoría (pizzería, lonchería, etc.).
- **Botones de acción:** *Pedir por WhatsApp* (protagonista) · Ver menú
  (imagen/PDF) · Cómo llegar (mapa) · redes (Instagram…).
- Descripción corta + horario.
- Galería de fotos *(opcional)*.
- Pie discreto: "Página por Mulfex · descubrible en VeChat".

## 6. Panel del negocio (mínimo v1)

Una sola vista de edición de la ficha (mismos campos del formulario) + ver/copiar
el link público + previsualización. Nada más en v1.

## 7. Datos e indexación en VeChat (la pieza clave)

- El producto **escribe en el mismo proyecto Supabase de VeChat** (sin puentes).
- La ficha del negocio vive en una tabla que el **descubrimiento de VeChat ya
  lee** (hoy `places`/`categories`/`cities` alimentan "Cerca de ti").
- **Decisión a resolver en el plan:** reutilizar/extender `places` vs. crear una
  tabla `businesses` (o `vitrinas`) dedicada que el feed pase a leer. Recomendado:
  tabla dedicada del producto + que el descubrimiento de VeChat la consuma, para
  no enredar el modelo viejo. Requiere revisar el esquema actual.
- Ranking en VeChat: **orgánico por relevancia/calidad**; lo patrocinado
  (etiquetado) llega en una fase posterior, no en v1.

## 8. Stack e infraestructura

- **Repo y deploy propios** (marca propia), separados de `mente-ai`.
- Next.js (App Router) + Tailwind, en Vercel.
- **Mismo proyecto Supabase** que VeChat (`swioimqjygpolttiequz`).
- Auth con Clerk para la cuenta del negocio *(reusar instancia vs. app nueva:
  decisión abierta)*.
- Storage para logo/menú/fotos: Supabase Storage.
- Directo a producción (sin localhost), como el resto de la familia.

## 9. Modelo de negocio (v1)

Gratis. La presencia es el imán y el canal de distribución (cada link en
Instagram riega la marca y llena el índice de VeChat). El cobro entra con las
fases B/C (catálogo, carrito, patrocinado, suscripción).

## 10. Decisiones abiertas

- **Dominio** del producto (nombre ya definido: **VeLocal**).
- **Modelo de datos** exacto e integración con `places` (sección 7).
- **Clerk:** instancia compartida con VeChat vs. app/instancia nueva.
- **Slug:** formato, unicidad y cómo se reclama (p. ej. `/elbudare`).
- **Horario → Abierto/Cerrado:** estructura de horarios y zona horaria VE.
- **Verificación** del negocio (¿en v1 o después?).

## 11. Métrica de éxito v1

- Negocios que **completan** su ficha y **comparten** el link.
- Fichas que **aparecen** en las recomendaciones de VeChat (indexación efectiva).
- (Cualitativo) dueños que ponen el link en su bio de Instagram.

## 12. Beachhead

Comida, en **Maracay**. Guiado por datos para el siguiente vertical.
