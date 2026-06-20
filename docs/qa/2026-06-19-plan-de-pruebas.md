# VeChat — Plan de pruebas (QA manual)

**Fecha:** 2026-06-19 · **App:** https://www.mulfai.com.ve

La app no tiene framework de tests automatizados; la compuerta automática es
`npm run build`. Todo lo demás es **QA manual**, y la **auth solo se prueba en
producción** (Clerk está domain-locked: no funciona en previews `*.vercel.app`).
Este plan se ejecuta a mano siguiendo los casos; marca ✅/❌ y anota bugs con la
plantilla del final.

## Cómo usar este plan
- **Prioridades:** **P0** = crítico (si falla, se bloquea o se pierde plata);
  **P1** = importante; **P2** = pulido.
- **Plataforma:** 🖥️ escritorio (Chrome) · 📱 móvil (Chrome Android / Safari iOS).
- Antes de un release toca el **Smoke test (P0)**; antes de algo grande, la suite
  completa del área tocada + la **regresión**.

## Cuentas y setup necesarios
1. **Correo nuevo desechable** (o alias `+`) para registrar de cero (verificación + CAPTCHA).
2. **Cuenta free** ya registrada (para el límite diario / gating).
3. **Cuenta pago/ilimitada** (admin le pone semanas o `-1`) para chat sin tope.
4. **Cuenta admin** (`profiles.role='admin'`) para `/admin`.
5. **Cuenta con ciudad = Maracay** en su contexto (para el descubrimiento VeLocal).
6. Probar en **ventana incógnito** (estado limpio) y en **claro y oscuro**.

## Restricciones conocidas (no son bugs)
- Auth: solo prueba real en prod.
- VeLocal: hoy solo **2 negocios reales en Maracay** (Mantuano, La Vid) + 1 de
  prueba sin geo. Fuera de Maracay o sin match → cae a respuesta genérica (correcto).
- Reset de cuota free: a medianoche de Venezuela (04:00 UTC) — caso sensible al tiempo.
- Caducidad de enlaces compartidos: 24h.

---

## 🔥 Smoke test (P0, ~10 min, correr siempre)
1. **Landing** (incógnito): carga, CTAs "Empieza gratis"/"Entrar" llevan a `/sign-up` `/sign-in`.
2. **Registro**: `/sign-up` → el form **aparece al instante** → correo nuevo + clave → llega código → verificar → quedas logueado en `/` (perfil resuelto, no en limbo).
3. **Chat**: enviar "hola" → responde en streaming sin errores.
4. **Pregunta local** (cuenta Maracay): "¿dónde tomo un café en Maracay?" → tarjeta **Mantuano** con WhatsApp/Ver perfil.
5. **Dólar**: "¿a cuánto está el dólar?" → número real + sello "Con fuentes".
6. **Sidebar**: la conversación nueva aparece en el historial.
7. **Logout** → vuelve a deslogueado; entrar de nuevo con `/sign-in` (correo) funciona.

---

## A. Autenticación (P0 — recién reconstruida headless)
- **A1 Registro correo** 🖥️📱: form pinta al instante (sin "render por etapas"); correo+clave → código al correo → CAPTCHA no bloquea → verifica → logueado, server resuelve perfil.
- **A2 Registro Google** 🖥️📱: "Continuar con Google" → `/sso-callback` ("Entrando…") → logueado en `/`.
- **A3 Login correo** 🖥️📱: credenciales correctas → entra. Credenciales malas → "Correo o contraseña incorrectos." (sin romperse).
- **A4 Login Google** 🖥️📱: → `/sso-callback` → entra.
- **A5 Reset contraseña** 🖥️📱 (3 pasos): "¿Olvidaste tu contraseña?" → correo → *Enviar código* → **solo código** → *Verificar* → se renderiza **nueva clave + confirmar** → claves distintas dan "Las contraseñas no coinciden" → claves iguales → entra. "Volver a iniciar sesión" limpia todo.
- **A6 Modal de la app** 🖥️📱 (P0 regresión): desde el chat, abrir login con un CTA → el **modal** de Clerk sigue funcionando (no se tocó).
- **A7 Reenviar código** (registro): botón "Reenviar código" envía otro.
- **A8 redirect_url**: entrar a una ruta protegida deslogueado (`/chat`) → redirige a login → tras loguear vuelve al destino.
- **A9 Logout** 🖥️📱: cierra sesión y limpia estado.
- **A10 Ruta protegida** : `/admin`, `/chat`, `/context` deslogueado → manda a login. `/sso-callback`, `/sign-in`, `/sign-up`, `/c/[token]` → públicas.

## B. Landing (deslogueado) — P1
- **B1** 🖥️📱: todas las secciones cargan (hero, pasos, comparativa, precios, FAQ, footer).
- **B2** 📱: nav móvil correcto (links de sección ocultos ≤768px, solo Entrar + Empieza gratis).
- **B3**: precios mostrados = los de `app_config` (no placeholders).
- **B4**: tema bloqueado en claro; se ve bien; scroll propio sin saltos.

## C. Chat (logueado) — P0
- **C1 Enviar** 🖥️📱: mensaje → streaming → respuesta completa; el input se limpia.
- **C2 Markdown**: tablas, código, listas, negritas se ven bien. 📱 **tabla**: se desliza horizontal y **no parpadea** al streamear.
- **C3 Detener**: botón Stop corta el stream; queda "(detenido)".
- **C4 Persistencia**: recargar la página → la conversación y su historial siguen.
- **C5 Follow-up**: segunda pregunta en la misma conversación mantiene contexto.
- **C6 Adjuntos** (si aplica): subir imagen → se analiza/responde.
- **C7 context_delta**: la respuesta **no** muestra el bloque JSON `{ "context_delta": … }` al final.
- **C8 Empty state**: sin conversación activa muestra el hero criollo + input + feed.

## D. Sidebar / historial — P0 (recién tocado)
- **D1 Carga**: el historial carga agrupado por fecha (Hoy / Ayer / Últimos 7 / 30 días…).
- **D2 Scroll infinito**: bajar trae lotes más viejos; sale el skeleton **solo mientras carga**.
- **D3 Colapso (recién arreglado)** 🖥️📱: colapsar grupos (dejar solo "Hoy") → **NO** sale el skeleton sin parar ni carga todo el historial en segundo plano. El estado colapsado se recuerda al recargar (localStorage).
- **D4 Búsqueda**: buscar trae resultados de **todo** el historial (servidor), con debounce.
- **D5 Acciones ⋮**: Compartir / Renombrar / Eliminar funcionan; eliminar pide confirmación y quita la fila.
- **D6 Colapsar sidebar** 🖥️: el rail angosto; 📱 abrir/cerrar el panel.
- **D7 Activa**: la conversación abierta queda resaltada.

## E. Feed (descubrimiento) — P1
- **E1 Secciones**: Tendencias / Cerca de ti / Para ti aparecen (logueado).
- **E2 Click**: tocar una tarjeta del feed envía esa pregunta directo.
- **E3 Señal**: barras de señal (no "N personas"); "Cerca de ti" solo temas locales reales; "Preguntando ahora" para visitantes.
- **E4 Filtrado**: no aparecen preguntas personales/privadas como tendencia.

## F. VeLocal — negocios locales en el chat — P0 (recién construido)
- **F1 Café** (Maracay): "¿dónde desayuno en Maracay?" → tarjeta **Mantuano** (logo, "Abierto"/"Cerrado" según hora, WhatsApp, Ver perfil, Cómo llegar).
- **F2 Tasca**: "una tasca" / "vinos" → **La Vid**.
- **F3 Recall por tags**: "desayuno" encuentra Mantuano (tag), "cafe" sin acento también.
- **F4 Geolocalización** 📱: al preguntar algo local pide permiso de ubicación; al aceptar, las tarjetas muestran **distancia** y ordenan **cercanos primero**.
- **F5 No-local**: "¿a cuánto el dólar?" → **sin** tarjetas de negocio (no se dispara de más).
- **F6 Acciones**: WhatsApp abre `wa.me/58…` correcto; Ver perfil → `velocal.vercel.app/{slug}`; Cómo llegar → mapa.
- **F7 Indicador**: sale "Buscando negocios cerca…" un instante.
- **F8 Sin match**: "hamburguesas en Maracay" (no hay negocio) → respuesta genérica, sin romperse.

## G. Grounding web — P1
- **G1 Dólar**: número real BCV + paralelo + "Con fuentes".
- **G2 Actualidad**: "¿quién es el presidente de…?" / noticia → busca web + chips de fuentes (dedup por dominio, máx 4).
- **G3 Normal**: pregunta general sin actualidad → NO busca (sin latencia extra).
- **G4 Sin resultados**: si la búsqueda falla, no inventa datos (avisa).

## H. Compartir conversación — P1
- **H1 Crear**: ⋮ → Compartir o botón flotante → "Crear enlace" → enlace + "Enviar por WhatsApp" + horas restantes.
- **H2 Página pública** (incógnito): `/c/[token]` abre solo lectura con burbujas + marca + CTAs "Pruébalo gratis"/"Empieza tu propia conversación". El dueño NO aparece.
- **H3 Reabrir**: volver a compartir reusa el token y refresca el contenido sin reiniciar el reloj.
- **H4 OG**: pegar el link en WhatsApp/Telegram muestra preview.
- **H5 Caducado** (si se puede): token vencido → tratado como inexistente.

## I. Cuenta / contexto / tema — P1
- **I1 AccountMenu**: abre desde el avatar.
- **I2 Tema** 🖥️📱: claro/oscuro/sistema cambia al instante, **persiste** al recargar, sin flash; la barra del navegador (theme-color) acompaña.
- **I3 Contexto**: nombre/ciudad se guardan; chips de intereses (aprendidos con puntito; tocar = fijar).
- **I4 Guardar**: editar nombre/ciudad no pisa los intereses.

## J. Freemium / gating — P0 (toca plata)
- **J1 Límite free**: con cuenta free, al acercarse al tope sale la píldora "Te quedan N" (≤3); al agotar, `LimitReachedCard` con cuenta regresiva reemplaza el input y abre `PlansModal`.
- **J2 Reset**: tras medianoche VE la cuota se reinicia (sensible al tiempo; verificar `daily_reset_at`).
- **J3 Cupón**: canjear cupón válido → sube el plan (semanas) y desbloquea; cupón inválido/usado → error.
- **J4 Pago/ilimitado**: cuenta con plan vigente o `-1` → chatea sin tope.
- **J5 Bloqueada**: `status='inactive'` → no envía, abre AccountMenu.

## K. Admin (`/admin`) — P1
- **K1 Gate**: cuenta no-admin → no entra (página y `/api/admin/*`).
- **K2 Usuarios**: lista; activar/cancelar; agregar semanas; eliminar (borra en Clerk).
- **K3 Cupones**: crear/listar.
- **K4 Config**: editar `free_daily_limit`, precios, días de plan, WhatsApp → se reflejan sin redeploy (landing/plans).

## L. Voz — P2
- **L1 TTS**: bocina en respuestas → reproduce (idle/loading/speaking).
- **L2 STT** (si aplica): micrófono transcribe.

## M. Transversales
- **M1 Móvil** 📱 (P0): todas las superficies clave (auth, chat, sidebar, tarjetas) usables y sin cortes.
- **M2 Oscuro** (P1): todas las superficies legibles en dark (sin blancos hardcodeados fríos).
- **M3 Red lenta/caída** (P1): cortar internet a media respuesta → mensaje de error claro, no crash.
- **M4 Rendimiento** (P2): la home y el login pintan rápido (el login headless = instantáneo).

---

## Regresión rápida (tras cualquier cambio) — P0
1. Login (correo) + modal de la app.
2. Enviar un mensaje (streaming OK).
3. Sidebar: historial + colapsar grupos (sin skeleton infinito).
4. Una pregunta local (tarjeta VeLocal) y una de dólar (con fuentes).
5. Build verde (`npm run build`).

## Plantilla de bug
```
Título:
Prioridad: P0/P1/P2
Plataforma: 🖥️/📱 (navegador, SO)
Cuenta: free / pago / admin / nueva
Pasos: 1) … 2) … 3) …
Esperado:
Obtenido:
Evidencia: (captura/video)
```

## Automatización a futuro (recomendación)
- **Unit** (Vitest) para la lógica pura ya testeable a mano hoy: `isOpenNow`,
  `searchLocalBusinesses` (mock), `localQuery`, `resolveTier`, `clampStreamingTable`,
  `stripContextDelta`, `waLink`. Barato y de alto valor.
- **E2E** (Playwright) para el camino crítico **deslogueado** (landing, `/c/[token]`)
  — la auth con Clerk en CI requiere instancia de test (hoy domain-locked a prod).
- Mantener `npm run build` como compuerta mínima en cada cambio.
