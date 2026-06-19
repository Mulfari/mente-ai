# Brief para el agente de VeLocal — preparar la data para alimentar VeChat

> Este documento es para quien trabaja en **VeLocal** (repo `Mulfari/velocal`).
> Es autocontenido: no necesitas conocer VeChat por dentro.

## Contexto (por qué)

VeLocal y VeChat **comparten el mismo Supabase**. VeChat (la IA venezolana) va a
**descubrir negocios de VeLocal dentro del chat**: cuando un usuario pregunta
"¿dónde ceno cerca?", "hamburguesas en Maracay" o "un café para trabajar",
VeChat busca en `velocal_businesses` y muestra los negocios reales como tarjetas
(con WhatsApp, "Abierto ahora", "Ver perfil" → la página VeLocal del negocio).

Para que eso funcione bien, la data de VeLocal tiene que ser **buscable**
(encontrarse por lo que la gente realmente pregunta) y **ubicable** (saber
cuáles están cerca). Este brief lista los cambios necesarios, por prioridad.

## Contrato — lo que VeChat LEE (no romper)

VeChat lee `velocal_businesses` (solo lectura, service role) filtrando
`active = true` y `visible_in_vechat = true`, usando estos campos:
`name, category, tags, description, city, neighborhood, lat, lng, hours,
whatsapp, instagram, maps_url, logo_url, slug`.
Mantén estos campos poblados y con su forma; si renombras algo, avísale a VeChat.

## Cambios necesarios

### 1. Búsqueda: categoría CONTROLADA + tags  — lo #1
Hoy `category` es **texto libre** ("Café & cocina"), así que "hamburguesas" o
"desayuno" no encuentran al negocio aunque lo venda. Sin esto el descubrimiento
falla seguido. Cambios:

- **`category` → taxonomía fija** (el negocio elige de una lista, no escribe
  libre). Taxonomía propuesta (ajústala a tu mercado):
  `Comida` · `Café & panadería` · `Bar & tasca` · `Postres & dulces` ·
  `Comida rápida` · `Servicios` · `Salud` · `Belleza & estética` · `Tienda` ·
  `Tecnología` · `Hogar` · `Educación` · `Otros`.
  Migra los valores actuales ("Café & cocina"→`Café & panadería`, "Tasca &
  vinos"→`Bar & tasca`).
- **Nuevo `tags text[]`** — palabras clave libres por negocio: "hamburguesa",
  "delivery", "vegano", "desayuno", "parrilla", "vinos", "brunch"… En el editor:
  input de **chips**, idealmente con **sugerencias según la categoría**. Esto es
  lo que sube el "recall" de las búsquedas.

### 2. Ubicación: lat/lng  — para "los cercanos primero"
VeChat quiere mostrar los **más cercanos primero** (p. ej. "cenar rápido"). Para
eso necesita coordenadas:

- **Nuevos `lat double precision`, `lng double precision`.**
- En el editor: un **selector de mapa** (arrastrar pin / buscar dirección) que
  guarde lat/lng.
- **Backfill de los negocios actuales:** muchos `maps_url` de Google ya traen las
  coordenadas en la URL (`@lat,lng` o `?q=lat,lng`); extráelas donde se pueda.
  Para los que no, pide el pin.
- **Nuevo `neighborhood text`** (zona/barrio) — útil en ciudades grandes.
- Normaliza `city` (evita variantes "maracay" / "Maracay, Aragua").

### 3. Perfiles completos (onboarding)
Para descubrimiento, asegura que el negocio llene: **categoría, descripción
(qué ofrece, con palabras reales), horario (`hours`) y whatsapp**. Mete una
validación/nudge suave en el editor (un perfil pelado no sirve para VeChat).

### 4. Frescura y estado
- **Nuevo `temporarily_closed boolean default false`** (o un `status`) — VeChat
  calcula "Abierto ahora" desde `hours`, así que necesita saber si el negocio
  está cerrado temporalmente aunque el horario diga abierto.

### 5. Visibilidad / calidad
- **Nuevo `visible_in_vechat boolean default true`** — que el negocio pueda
  optar por NO aparecer en el descubrimiento de VeChat.
- (Opcional) un mínimo de calidad para aparecer (categoría + descripción + al
  menos un contacto).

## Migración SQL (ajústala a tus convenciones)

```sql
alter table velocal_businesses
  add column if not exists tags text[] default '{}',
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists neighborhood text,
  add column if not exists temporarily_closed boolean default false,
  add column if not exists visible_in_vechat boolean default true;

-- categoría: migrar a la taxonomía controlada (mapear los valores actuales).

-- índices para que VeChat busque rápido:
create index if not exists velocal_biz_tags_gin
  on velocal_businesses using gin (tags);
create index if not exists velocal_biz_fts
  on velocal_businesses using gin (
    to_tsvector('spanish',
      coalesce(name,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(category,'') || ' ' || array_to_string(tags,' ')));
create index if not exists velocal_biz_city_active
  on velocal_businesses (city, active);
```

## Lo que NO te toca (lo hace VeChat)
- Obtener la ubicación del usuario (geolocalización del navegador) y el ranking
  por distancia.
- El render de las tarjetas y el flujo del chat.
Tu trabajo es que `velocal_businesses` tenga **categoría controlada, tags,
lat/lng y perfiles completos**.

## Prioridad — "antes del tráfico"
Haz **1 (categoría + tags)** y **2 (lat/lng)** ANTES de captar muchos negocios:
así cada negocio nace **buscable y ubicable**, y te ahorras rellenar 100 a mano
después. El resto (3–5) puede ir en paralelo.
