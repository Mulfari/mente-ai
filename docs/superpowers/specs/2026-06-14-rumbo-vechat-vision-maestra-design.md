# Rumbo VeChat — Visión maestra

- **Fecha:** 2026-06-14
- **Estado:** Borrador para revisión
- **Autor:** Jose Mulfari (con asistencia de Claude)
- **Tipo:** Documento de norte (vision-led). NO es un spec de implementación.

---

## 0. Para qué sirve este documento

Este es el **norte** de VeChat: hacia dónde va el producto, por qué, y en qué
orden se construye. No describe *cómo* implementar nada en detalle — de aquí
**nacen specs hijos** (uno por pieza), cada uno con su propio ciclo
spec → plan → implementación.

Cuando haya que decidir algo del día a día, este documento es la vara: *¿esto
nos acerca al norte o nos dispersa?*

---

## 1. El norte (la tesis)

> **VeChat es el asistente conversacional para resolver la vida local en
> Venezuela.** El chat es la puerta de entrada; **resolver y conectar con el
> servicio** es el destino.

No competimos con ChatGPT. Competimos contra *"no tener una forma fácil de
encontrar, pedir y resolver cosas en Venezuela"*. Eso último es ganable.

---

## 2. El cambio de marco (de dónde venimos, a dónde vamos)

| Antes | Ahora |
|---|---|
| "ChatGPT venezolano" | "El asistente que te resuelve la vida local" |
| Se define por su **audiencia** | Se define por lo que **logra** |
| El usuario paga por chatear | El usuario chatea gratis/barato; **los negocios pagan** |
| Compite contra modelos gigantes (imposible) | Compite contra el caos de Instagram + WhatsApp (ganable) |

El chat freemium de hoy **no es el negocio**: es el **imán** que trae a la
gente. El negocio de verdad aparece cuando esa gente empieza a *buscar y
resolver cosas locales*, y los negocios pagan por estar ahí.

---

## 3. El problema (los dos lados)

**Para el venezolano (demanda):** encontrar y pedir cosas es un fastidio.
"¿Qué está abierto?", "¿quién hace delivery cerca?", "¿dónde consigo X
servicio?" se resuelve cazando cuentas de Instagram, pidiendo recomendaciones
en grupos de WhatsApp, o sin resolverse. No hay un buscador local confiable y
actualizado.

**Para el negocio (oferta):** miles de negocios **solo viven en Instagram**.
Su "tienda" es el link de la bio, un Linktree improvisado, un menú en fotos,
un "escríbenos por WhatsApp". No tienen página de verdad, no salen en ningún
buscador, y cada cliente nuevo depende de que el algoritmo de Instagram los
muestre. **No tienen una forma barata y predecible de conseguir clientes.**

VeChat conecta ambos lados.

---

## 4. La idea central: la Vitrina indexable

*(Nombre tentativo: "Vitrina". También vale "Ficha".)*

Esta es la pieza que une todo. VeChat **le arma al negocio su página real** —
menú, horarios, ubicación, WhatsApp, forma de pedir — hosteada por VeChat. Es
la página que hoy resuelven mal con Linktree + fotos + Instagram, pero hecha
bien, local, y sobre todo: **descubrible**.

Lo clave es que **la página del negocio y el motor de descubrimiento son la
misma cosa**:

- Lo que le sirve al negocio para **presentarse** (su Vitrina)…
- …es exactamente lo que VeChat **indexa** para responderle al usuario.

Cuando alguien en Maracay le pregunta al chat *"¿dónde como una pizza cerca?"*,
VeChat responde con Vitrinas reales — abiertas ahora, cercanas, con su contacto
directo. Una sola pieza, dos beneficios:

- 🧑‍🍳 **Al negocio:** presencia digital de verdad + clientes que le llegan.
- 🙋 **Al usuario:** resuelve sin cazar cuentas en Instagram.

> Nota: este es el mismo músculo que el proyecto **Express Printer** ya ejercita
> (storefront + admin sobre Next.js/Supabase). La capacidad de construir
> "vitrinas para negocios" ya existe en la casa.

---

## 5. Los dos lados y el flywheel

```
  Chat freemium  ─►  trae usuarios  ─►  los usuarios buscan/resuelven
        ▲                                         │
        │                                         ▼
   mejor producto                        se genera DEMANDA local
        ▲                                         │
        │                                         ▼
  más y mejor oferta  ◄─  los negocios pagan por estar donde está la demanda
```

Cada vuelta refuerza la siguiente: más usuarios → más demanda visible → más
negocios quieren entrar → mejor cobertura → producto más útil → más usuarios.

---

## 6. Modelo de negocio (cómo evoluciona el ingreso)

**Principio:** el usuario tiende a gratis/barato; **el negocio es quien paga**,
porque VeChat le entrega lo que más necesita: **clientes**.

| Fuente de ingreso | Cuándo | Rol |
|---|---|---|
| Freemium de usuario (chat) | Hoy (ya existe) | Imán + ingreso puente. No es el motor. |
| **Suscripción de negocios** | Etapa 2 en adelante | **Motor principal.** Estar en VeChat, verificado, con su Vitrina. |
| **Patrocinio / destacados** | Etapa 2+ | Aparecer primero, "recomendado", prioridad en el chat. |
| Comisión por pedido | Etapa 3 (opcional) | Cuando VeChat maneje la transacción/logística. |

La transición es deliberada: el freemium de usuario sostiene mientras se
construye la oferta; cuando hay masa crítica de negocios y demanda, el peso del
ingreso se mueve hacia el lado de la oferta.

---

## 7. Las tres profundidades

Cuando alguien dice *"tengo hambre"* o *"necesito X servicio"*, VeChat puede
llegar a tres niveles. Se construyen **en este orden**:

1. **Informar y recomendar** — te dice qué hay cerca/abierto, opciones, precios,
   y te entrega el contacto. Tú cierras por fuera. *(VeChat = "el que sabe".)*
2. **Facilitar el pedido** — arma el pedido/contacto listo (mensaje de WhatsApp
   pre-armado, avisar al local, reservar). El negocio cobra y entrega.
   *(VeChat = "el intermediario inteligente".)*
3. **Transacción completa** — pago + delivery coordinados dentro de VeChat.
   *(VeChat = "resuélvelo aquí".)*

---

## 8. El roadmap por etapas (el corazón)

**Beachhead:** **comida**, elegida deliberadamente (alta frecuencia y recompra,
fácil de venderle a un negocio — todo restaurante quiere clientes), **guiada por
datos** para confirmar y para descubrir el segundo vertical.
**Ciudad piloto:** **Maracay**.

| Etapa | Nombre | Profundidad | Vitrina | Ingreso |
|---|---|---|---|---|
| **0 — Hoy** | El imán | — | — | Freemium usuario (ya existe) |
| **1** | "El que sabe de comida" | Informar y recomendar | Llave en mano | Negocios gratis (llenar el directorio) |
| **2** | "El intermediario + los negocios pagan" | Facilitar el pedido | Editable | **Suscripción + patrocinio** |
| **3** | "Resuélvelo dentro de VeChat" | Transacción completa | Constructor completo | + comisión por pedido (opcional) |

### Etapa 0 — Hoy (ya construido)
Chat freemium + feed de tendencias + landing de venta + panel admin. VeChat ya
atrae gente y ya sabe cobrarle al usuario. Es la base sobre la que se monta todo.

### Etapa 1 — "El que sabe de comida"
- **Objetivo:** que un maracayero le pregunte al chat por comida y reciba
  negocios reales, abiertos ahora, cercanos, con su WhatsApp directo.
- **Vitrina (llave en mano):** el negocio manda lo mínimo (nombre, logo, menú/
  fotos, WhatsApp, horario) por formulario simple, por WhatsApp, o conversando
  con el propio chat. VeChat le genera la página lista. **Cero técnico para el
  negocio.**
- **Descubrimiento:** el chat entiende intención local ("tengo hambre", "pizza
  cerca", "qué está abierto") y responde con Vitrinas. Reutiliza
  `places/cities/categories` + "Cerca de ti".
- **Negocio:** gratis para el usuario (parte del freemium); negocios entran
  gratis para llenar el directorio.
- **Datos:** instrumentar qué pide la gente → confirmar comida como vertical y
  detectar el **segundo** vertical.
- **Salida de la etapa:** masa crítica de Vitrinas de comida en Maracay + señal
  de que la gente usa VeChat para resolver comida.

### Etapa 2 — "El intermediario + los negocios pagan"
- **Facilitar:** VeChat arma el pedido/contacto listo (WhatsApp pre-armado,
  avisar al local, reservas).
- **Vitrina (editable):** panel para que el negocio retoque su página (menú,
  fotos, orden, horarios).
- **Monetización de la oferta:** **suscripción** (estar listado, verificado) +
  **patrocinio** (destacado, prioridad en recomendaciones) + estadísticas de
  cuántos clientes le llegaron por VeChat.
- **Expansión:** abrir el **segundo vertical** guiado por los datos de Etapa 1.
- **Salida de la etapa:** primeros negocios **pagando**.

### Etapa 3 — "Resuélvelo dentro de VeChat"
- **Transacción:** pago + delivery coordinados (pasarela local / repartidores o
  partners).
- **Vitrina (constructor completo)** para el plan grande.
- **Escala:** multi-vertical, multi-ciudad.
- **Plan completo para negocios:** presencia + pedidos + pagos + analítica.

---

## 9. Qué ya existe y se reutiliza

VeChat no parte de cero hacia este rumbo. Ya hay cimientos:

- **`places / cities / categories`** — base del directorio de negocios/Vitrinas.
- **"Cerca de ti"** (feed) — ya hay lógica de localidad por `user_context`/IP.
- **`user_interests`** — señales aprendidas del usuario, útiles para personalizar
  recomendaciones locales.
- **Infra freemium** (`resolveTier`, gating, `app_config`) — el modelo de cobro
  y los planes ya tienen costura; se extiende al lado de los negocios.
- **Panel admin** (`/admin`) — base del futuro **panel de negocios**.
- **El propio chat con streaming** (VPS + modelo) — la puerta de entrada.

---

## 10. Métricas de éxito (por etapa)

- **Etapa 1:** nº de Vitrinas activas en Maracay; % de chats con intención local
  que terminan entregando un contacto de negocio; usuarios que vuelven a usar
  VeChat para comida.
- **Etapa 2:** nº de negocios **pagando**; pedidos/contactos referidos por
  VeChat a cada negocio (la prueba de valor que justifica la suscripción);
  retención de negocios mes a mes.
- **Etapa 3:** transacciones completadas dentro de VeChat; GMV; ciudades/
  verticales activos.

---

## 11. Riesgos y decisiones abiertas

- **Cold-start de la oferta:** sin Vitrinas no hay qué recomendar; sin usuarios
  no hay por qué entrar. Mitigación: arrancar en una sola ciudad (Maracay), un
  solo vertical (comida), Vitrina llave-en-mano (fricción casi cero), negocios
  gratis al inicio. *(Decisión tomada.)*
- **Curaduría / calidad de datos de negocios:** horarios desactualizados,
  cierres, info falsa. ¿Quién mantiene la Vitrina al día? (¿el negocio, VeChat,
  la comunidad?) — **abierto**.
- **Confianza del chat:** el modelo no puede "inventar" negocios o precios. Las
  respuestas locales deben venir de Vitrinas reales indexadas, no de la memoria
  del modelo. (Diseño técnico de Etapa 1.)
- **Pagos en Venezuela:** para la Etapa 3 (transacción). Fuera de alcance por
  ahora — **abierto**.
- **Logística/delivery:** ¿repartidores propios, acuerdos, o el negocio entrega?
  Etapa 3 — **abierto**.
- **Segundo vertical:** se decide con los datos de Etapa 1 — **abierto a
  propósito**.
- **Modelo de adquisición de negocios:** ¿venta directa puerta a puerta en
  Maracay, self-service, referidos? — **abierto**.

---

## 12. Specs hijos (lo que nace de este documento)

A medida que avancemos, cada pieza tendrá su propio ciclo brainstorm → spec →
plan. Candidatos previsibles:

- **Spec: la Vitrina (Etapa 1, llave en mano)** — modelo de datos, onboarding
  del negocio, página pública, cómo se indexa.
- **Spec: descubrimiento local en el chat** — cómo el chat entiende intención
  local y responde con Vitrinas reales (grounding, no alucinación).
- **Spec: instrumentación de demanda** — qué se mide para confirmar el vertical
  y descubrir el siguiente.
- **Spec: panel de negocios + suscripción (Etapa 2)** — edición de Vitrina,
  cobro a negocios, patrocinio, estadísticas.
- **Spec: facilitar el pedido (Etapa 2)** — WhatsApp pre-armado, reservas.
- *(Etapa 3 se especifica cuando lleguemos.)*

---

## 13. Lo que VeChat NO es (anti-alcance / YAGNI)

- **No** es un competidor de ChatGPT en calidad bruta del modelo. La gracia es
  lo local y resolver, no ser "el modelo más inteligente".
- **No** es una super-app genérica que hace de todo desde el día uno. Es
  **comida en Maracay** primero; lo demás se gana con datos.
- **No** construye pasarela de pagos ni flota de delivery hasta la Etapa 3.
- **No** le pide al dueño del negocio que "construya" nada en la Etapa 1: se lo
  entregamos hecho.
- **No** se abren más ciudades hasta probar el molde en una.
