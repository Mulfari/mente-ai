# Verificación de las mejoras (sesión 2026-06-19)

Plan + resultados de verificar lo construido hoy. Dos columnas: **lo que verifiqué
yo** (navegador contra prod + SQL contra la BD real + asserts node) y **lo que
necesita tu login** (flujos completos detrás de auth). La auth de Clerk solo
corre en prod, y `/admin`, el chat y el sidebar son privados → esos los pruebas tú.

Leyenda: ✅ verificado · 🔑 requiere tu login · 🐛 bug hallado · 🔧 arreglado.

---

## Resumen ejecutivo
- **Render de auth** (sign-in/sign-up/reset) y **landing**: ✅ pintan al instante, **0 errores de consola**.
- **VeLocal** (recuperación): ✅ matching y datos correctos contra la BD.
- **Admin Métricas**: ✅ los números cuadran con la BD. 🐛 encontré que "Activos 7d" daba **0** (la columna `last_message_at` nunca se rellena) → 🔧 **arreglado** (ahora usa actividad real de `query_events`; valor correcto = 3). Desplegado `6e46ce0`.
- **Lógica pura**: ✅ asserts pasan.
- Lo demás (flujos completos) → 🔑 checklist tuyo abajo.

---

## A. Verificado automáticamente

### A1 · Auth headless (navegador, prod) ✅
- `/sign-in`: el formulario está en el DOM **al cargar** (Correo, Contraseña + ver/ocultar, "¿Olvidaste tu contraseña?", "Iniciar sesión", "Continuar con Google", "Crear cuenta") + panel de marca. → confirma la corrección estrella (render instantáneo).
- `/sign-up`: idem (Google + correo/clave + "Crear cuenta").
- **Reset 3 pasos**: "¿Olvidaste?" → paso 1 = **solo correo** + "Enviar código" (no junta la clave). ✅
- **0 errores de consola** en sign-in / sign-up / landing.
- 🔑 Falta: registro real (correo+código+CAPTCHA), login, Google end-to-end, reset completo, modal de la app.

### A2 · VeLocal — recuperación (SQL, BD real) ✅
- 2 negocios `active` **y** `visible_in_vechat`, **con coordenadas**: Mantuano (Maracay/Centro), La Vid (Maracay/La Soledad).
- `search_tsv` (unaccent + tags): **café/desayuno → Mantuano**; **tasca/vino → La Vid**. Matching correcto.
- `temporarily_closed=false`, `has_coords=true` en ambos → "Abierto ahora" y distancia funcionan.
- 🔑 Falta: ver las tarjetas en el chat (cuenta Maracay), permiso de ubicación → orden por distancia.

### A3 · Admin Métricas — números (SQL cross-check) ✅
Cruzados contra la BD, cuadran con lo que mostrará el dashboard:
- KPIs: usuarios **4**, nuevos 7d **2**, nuevos 30d **4**, conversaciones **42**, mensajes **126**, consultas **116**, de pago **0**.
- Planes: **Free 3 · Bloqueado 1** (resolveTier).
- Top ciudades: Maracay, Santa Cruz (la ciudad guardada vacía se **filtra** bien).
- Top consultas: pobladas (desayunar 20 · dólar 13 · plomero 11 · pizzerías 9 · postres 7 · SAIME 5…).
- 🐛🔧 **"Activos 7d" daba 0**: `profiles.last_message_at` está **NULL en los 4 perfiles** (el chat nunca lo escribe), aunque hay mensajes de hoy. Arreglado: ahora "Activos" = usuarios **distintos** con `query_events` en 7 días → **3**. (`6e46ce0`)
- 🔑 Falta: abrir la tab en `/admin` y ver el render (gráficos, móvil, oscuro).

### A4 · Lógica pura (asserts node, durante el build) ✅
`isOpenNow` 6/6 · `localQuery` 9/9 · `bucket30` (series 30d) OK.

### A5 · Sidebar — fix de colapso (código + build) ✅ parcial
El cambio (no auto-paginar cuando hay grupos colapsados) compila y la lógica está
verificada; la prueba **en vivo** (colapsar grupos y ver que no spamea el skeleton
ni carga todo el historial) es 🔑 (requiere login).

---

## B. Checklist para ti (🔑 requiere login)

**Auth**
- [ ] Registro: correo nuevo → código al correo → CAPTCHA no bloquea → verifica → entras (perfil resuelto).
- [ ] Login correo (clave mala → "Correo o contraseña incorrectos").
- [ ] Google en sign-in y sign-up → `/sso-callback` → entras.
- [ ] Reset completo: código real → **nueva + confirmar** (probá claves distintas → "no coinciden").
- [ ] El **modal** de la app (CTA del chat) sigue funcionando.

**VeLocal (cuenta con ciudad = Maracay)**
- [ ] "¿dónde desayuno en Maracay?" → **Mantuano**; "vinos"/"una tasca" → **La Vid**.
- [ ] Permitir ubicación → tarjetas con **distancia**, cercanos primero.
- [ ] "¿a cuánto el dólar?" → **sin** tarjetas de negocio.

**Sidebar**
- [ ] Colapsar grupos (dejar solo "Hoy") → **sin** skeleton infinito ni carga de todo el historial.
- [ ] Ya no aparece "Has visto todo tu historial" al final.

**Admin Métricas** (`/admin` → Métricas)
- [ ] KPIs cuadran (usuarios 4, conv 42, msg 126, consultas 116). **Activos 7d = 3** (ya no 0).
- [ ] Se ven barras (registros/consultas), sparkline (mensajes), "Usuarios por plan" (Free 75% · Bloqueado 25%), top ciudades/consultas.
- [ ] Móvil (tarjetas reapilan) + tema oscuro.

**Chat**
- [ ] Enviar mensaje → streaming OK. Tablas se ven/deslizan (móvil). No aparece el bloque `context_delta` al final.

---

## C. Hallazgos / notas
- 🔧 **Activos 7d** corregido (arriba).
- ℹ️ `profiles.last_message_at` no se mantiene en ningún lado. No se usa para nada crítico hoy (el gating es por `daily_msg_count`), pero si se quiere una métrica de "última actividad" fiable, habría que escribirla en el flujo del chat o derivarla siempre de `query_events`/`messages`.
- ℹ️ Hay **0 usuarios de pago** y una ciudad guardada vacía (se filtra). Normal en data temprana.
- Pendientes no-bug: actualizar `CLAUDE.md` (sección auth, aún describe el `<SignIn>` viejo) cuando confirmes el login; opción de portar el diseño `VeChatBizCard` a las tarjetas de VeLocal.
