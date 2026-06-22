# VeLocal — Rediseño (sistema de diseño + 3 superficies)

- **Fecha:** 2026-06-14
- **Estado:** Borrador para revisión
- **Contexto:** El v1 de VeLocal se desplegó con UI de scaffold (genérica). Este
  spec define la identidad visual y el rediseño de las 3 superficies a calidad
  de producción. Producto: `velocal-proyecto` (memoria). No toca VeChat.

---

## 1. Dirección (decidida con el usuario)

- **Marca propia** (no familia VeChat).
- **Premium minimal / editorial × Instagram-native:** la familiaridad y lo visual
  de Instagram (de donde llega el cliente), con la contención y el gusto de una
  marca boutique — tipografía protagonista, mucho aire, foto-primero, cero ruido.
- **Vitrina = dirección B** (perfil tipo Instagram: avatar, historias
  destacadas, grid de fotos).
- **Color configurable por negocio** vía **temas curados** (~8 temas premium; el
  negocio elige uno; imposible que quede feo).
- **Alcance:** Vitrina pública + Landing + Panel.

**Principio anti-genérico:** nada de morados degradados, glassmorphism de relleno,
todo-centrado-igual, ni stock corporativo. Tipografía fuerte, foto real, jerarquía
clara, asimetría editorial donde aporte, detalle artesanal.

## 2. Identidad de marca VeLocal

El producto (landing + panel + chrome) tiene su propia identidad fija; la Vitrina
de cada negocio se pinta con su tema elegido.

- **Tipografía:**
  - Display/editorial: **Fraunces** (serif óptico) — nombres, títulos, momentos de marca.
  - UI/cuerpo: **Inter** (grotesca limpia) — todo lo funcional.
  - Pareja = editorial + moderno. Dos pesos por familia (400/600).
- **Paleta de marca VeLocal** (landing/panel):
  - `--ink` #1B1815 (texto), `--ivory` #FAF7F1 (fondo), `--paper` #F3EEE4
    (superficie), `--muted` #8A8073, `--line` #E7DFD2,
    `--brand` #D24B2C (terracota), `--brand-press` #B23C20.
- **Voz visual:** cálida, segura, con criterio. Frases cortas. Foto manda.

## 3. Sistema de diseño (tokens)

- **Escala tipográfica (px):** display 36 · h1 24 · h2 18 · body 15.5 · small 13 ·
  micro 11. Line-height 1.15 títulos / 1.55 cuerpo. Tracking -0.01em en display.
- **Espaciado (4-base):** 4, 8, 12, 16, 24, 32, 48, 64. Generoso por defecto.
- **Radios:** sm 10 · md 14 · lg 20 · pill 999.
- **Bordes/sombra:** líneas 1px `--line`; sombras solo funcionales y suaves
  (`0 1px 2px rgba(0,0,0,.04)`, `0 8px 30px rgba(0,0,0,.08)` en flotantes). Plano > brillante.
- **Motion:** 160–240ms `cubic-bezier(.2,.6,.2,1)`; entradas sutiles (fade+rise 8px);
  respeta `prefers-reduced-motion`.
- **Iconos:** set lineal consistente (p. ej. Lucide), grosor 1.5px. Sin emojis.
- **Implementación:** todo en CSS variables; Tailwind v4 `@theme` mapea los tokens.

## 4. Temas curados de la Vitrina

Cada tema = `{ bg, surface, ink, muted, accent, accentInk }`. El negocio elige uno
(se guarda en `velocal_businesses.theme`). Set inicial (8):

| key | nombre | bg | superficie | acento |
|---|---|---|---|---|
| `crema` | Crema (default) | #FAF7F1 | #FFFFFF | #D24B2C |
| `carbon` | Carbón | #16140F | #211E18 | #E8A13C |
| `esmeralda` | Esmeralda | #F4F6F2 | #FFFFFF | #1F7A53 |
| `cobalto` | Cobalto | #F3F5F8 | #FFFFFF | #2B5BD7 |
| `vino` | Vino | #F7F1F0 | #FFFFFF | #8E2B3F |
| `durazno` | Durazno | #FCF1EA | #FFFFFF | #E5613B |
| `noche` | Noche | #10131B | #1A1F2B | #C9A24B |
| `menta` | Menta | #F0F6F3 | #FFFFFF | #157A6E |

Reglas: el acento siempre pasa contraste AA sobre su superficie; los temas oscuros
invierten texto. El tipo y la estructura NO cambian entre temas (solo color) → marca
consistente, personalización segura.

## 5. Rediseño por superficie

### 5a. Vitrina pública `/[slug]` (dirección B)

Mobile-first, centrada, una sola columna, pintada por el tema del negocio.

- **Cabecera:** cover (foto del negocio, banda corta) + **avatar** redondo
  superpuesto (logo) con borde de superficie.
- **Identidad:** nombre (Fraunces, 24) · handle `@usuario` (muted) · **estado**
  (punto + “Abierto · cierra 10:00 pm”, calculado en hora Venezuela) · categoría/ciudad.
- **Historias destacadas:** fila de círculos (Menú · Promos · Horario · Mapa);
  tocar abre una hoja (sheet) con ese contenido. (En v1 de rediseño: Menú = imagen/PDF,
  Horario = tabla, Mapa = link, Promos opcional.)
- **Acción protagonista:** botón **Pedir por WhatsApp** (acento del tema, full-width).
- **Acciones secundarias:** Cómo llegar · Instagram (botones outline).
- **Grid de fotos:** 3 columnas, fotos reales del negocio, tap → lightbox.
- **Descripción:** 1–2 líneas, cuerpo.
- **Pie:** “Página por **VeLocal**” discreto + (si aplica) “descubrible en VeChat”.
- Foto real obligatoria para sentirse premium; placeholders elegantes si faltan.

### 5b. Landing `velocal.vercel.app`

Página de venta editorial dirigida al **dueño de negocio**.

- **Hero:** titular grande en Fraunces + subtítulo + CTA “Registrar mi negocio”,
  con un **mockup de Vitrina real** (teléfono) al lado, foto-primero. Asimétrico, no centrado.
- **Prueba/− valor:** “tu link para la bio de Instagram”, “apareces en VeChat”,
  “gratis”, en 3 bloques con micro-ilustración/foto.
- **Cómo funciona:** 3 pasos (registra → llena → comparte) con visual por paso.
- **Galería de ejemplos:** 3–4 Vitrinas de muestra con distintos temas (enseña la personalización).
- **CTA final** + footer (marca, links).
- Claro/sobrio, mucho aire, foto real, motion sutil al hacer scroll.

### 5c. Panel del dueño `/panel`

Crear/editar la ficha tiene que sentirse fácil y gratificante (el dueño solo sabe IG).

- **Layout dos zonas (desktop):** formulario a la izquierda, **vista previa EN VIVO**
  de la Vitrina a la derecha (se actualiza al escribir). En móvil: formulario + botón “Ver”.
- **Formulario por secciones** (no un muro de campos): Identidad (nombre, logo, categoría) ·
  Contacto (WhatsApp, Instagram, ubicación/mapa) · Horario (editor por día claro) ·
  Fotos (logo, portada, galería con drag/preview) · **Tema** (selector de los 8 con swatches).
- Subidas con preview y estados; validación amable; autosave o “Guardar” claro.
- Al guardar: tarjeta de éxito con el **link** + “Copiar” + “Enviar por WhatsApp”.
- Header con marca VeLocal + UserButton.

## 6. Implementación técnica

- **Fuentes:** `next/font/google` (Fraunces, Inter) con variables CSS.
- **Tokens:** `globals.css` define `:root` (marca VeLocal) + clases/atributos de tema
  (`[data-theme="crema"]` … o variables inline por tema en la Vitrina). Tailwind v4 `@theme`.
- **Tema por negocio:** nueva columna `velocal_businesses.theme text default 'crema'`;
  la Vitrina aplica el tema vía variables CSS en el contenedor raíz (no recarga).
- **Componentes:** extraer UI reutilizable (Button, Field, Sheet, ThemePicker,
  StoryHighlight, PhotoGrid, PhonePreview) en `src/components/` con responsabilidad única.
- **Imágenes:** `next/image` donde aplique; lightbox propio liviano.
- **Sin dependencias pesadas nuevas** salvo un set de iconos (Lucide) — evaluable.

## 7. Accesibilidad y responsive

- Contraste AA en todos los temas (acento/texto sobre superficie).
- Mobile-first real (la Vitrina se ve casi siempre en teléfono); landing/panel responsivos.
- Foco visible, navegación por teclado, `alt` en fotos, `prefers-reduced-motion`.

## 8. Fuera de alcance (este spec es SOLO diseño)

- No agrega features de producto (catálogo con precios B, carrito C, suscripción,
  indexación en VeChat) — eso vive en otros specs.
- No cambia el modelo de datos salvo la columna `theme`.
- Dominio propio / Clerk production: aparte.

## 9. Éxito

- Una persona ajena diría “esto se ve profesional / premium”, no “esto es una plantilla”.
- El dueño completa su Vitrina sin fricción y queda orgulloso de compartir el link.
- Coherencia total de marca entre las 3 superficies; la Vitrina personalizable pero siempre bonita.
