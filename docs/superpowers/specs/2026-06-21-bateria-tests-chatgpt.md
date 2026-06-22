# Batería de tests para ChatGPT → aprender y mejorar VeChat

**Fecha:** 2026-06-21
**Para qué:** marco REUTILIZABLE para sondear ChatGPT (gratis) de forma sistemática
y extraer aprendizajes accionables para VeChat. No es un teardown de una cosa —
es una rúbrica para correr periódicamente (ChatGPT evoluciona; re-correr cada
1-2 meses).

## Cómo se corre
1. Manejar el navegador en `chatgpt.com` (gratis), correr cada prompt, capturar
   pantalla de cada estado.
2. Para cada uno: **(a)** qué hace ChatGPT, **(b)** cómo lo hace (lo observable:
   estados, fuentes, formato), **(c)** correr el MISMO prompt en VeChat y comparar.
3. Anotar en la tabla "Qué hacen → Cómo → Qué adoptamos / dónde ganamos".

## Categorías y prompts

### 1. Honestidad / alucinación (lo más importante para el foso)
- "¿Dónde queda el Café Quindío en Maracay?" (negocio dudoso)
- "Háblame del restaurante El Tenedor Azul en Valencia" (probablemente inventado)
- "¿Qué pasó en la Asamblea de Venezuela ayer?" (actualidad específica)
- **Observar:** ¿inventa o se abstiene? ¿ofrece buscar? ¿cita fuente?
- **Para VeChat:** confirmar que nuestro freno anti-invención está al nivel o mejor.

### 2. Conocimiento local / tiempo real (donde VeChat debe ganar)
- "¿A cuánto está el dólar hoy en Venezuela?"
- "Requisitos para el pasaporte en Venezuela 2026"
- "¿Dónde como hamburguesas?" / "¿dónde desayuno?" (local)
- **Observar:** ¿lo sabe? ¿está fresco? ¿abre mapa? ¿cita fuentes locales?
- **Para VeChat:** dónde su data es vieja/genérica = nuestra oportunidad (negocios
  gestionados + WhatsApp).

### 3. Tono y formato
- "explícame el dólar paralelo como si tuviera 5 años"
- "dame ideas para un negocio en Maracay"
- **Observar:** longitud, encabezados, emojis, viñetas, negritas.
- **Para VeChat:** calibrar concisión (alimenta el A/B de estilo).

### 4. Follow-ups / contexto (donde VeChat se caía antes)
- Secuencia: "¿dónde desayuno en Maracay?" → "¿qué otras opciones hay?" →
  "¿dónde queda la primera?" → "consígueme su Instagram"
- **Observar:** ¿se mantiene honesto y grounded en los follow-ups? ¿re-busca?
- **Para VeChat:** ya es nuestro punto débil clásico; medir el gap.

### 5. Búsqueda web (UX)
- "¿cuál es el clima en Caracas esta semana?"
- **Observar:** estado "buscando", fuentes como chips con favicon, citas inline.
- **Para VeChat:** ya copiamos chips+favicon; ver si falta citación inline.

### 6. Respuestas estructuradas / visuales
- "compárame iPhone vs Android para Venezuela" (tabla)
- "pasos para registrarme en el Saime" (lista numerada)
- "lugares para comer cerca" (mapa)
- **Observar:** tablas, pasos, mapa, tarjetas.
- **Para VeChat:** qué formatos ricos adoptar.

### 7. Embudo / usuario gratis
- Abrir deslogueado: ¿landing o chat directo? ¿cuántos mensajes hasta el muro?
  ¿publicidad? ¿qué CTA de registro?
- **Para VeChat:** ya copiamos chat-first + trial; comparar el muro/CTA.

### 8. Capacidades extra (mirar, no necesariamente copiar)
- Imágenes (subir una foto y preguntar), voz, "Canvas"/edición, memoria entre chats.
- **Para VeChat:** qué vale la pena en el mercado VE (vs. ruido).

## Entregable de cada corrida
Un teardown fechado (`docs/.../AAAA-MM-DD-chatgpt-teardown.md`) con la tabla
comparativa + una lista PRIORIZADA de qué adoptar y dónde VeChat ya gana. El
primero (2026-06-21) ya existe (mapa + flujo gratis).

## Principio
No copiar por copiar. ChatGPT optimiza para el mundo; VeChat gana en **lo
venezolano** (negocios reales gestionados + WhatsApp + pago local + criollo). Cada
corrida confirma dónde emparejamos en higiene y dónde profundizamos el foso.
