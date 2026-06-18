# Login/registro v2 — generador

Las páginas `/sign-in` y `/sign-up` usan un diseño split de **Claude Design**
(export "auth"), con los lados **invertidos** respecto al export: el
**formulario va a la izquierda** y el **panel de marca (oscuro) a la derecha**.

El formulario NO es estático: lo dibuja el componente real de **Clerk**
(`<SignIn>`/`<SignUp>`), embebido en `.formpane` y estilizado con
`vechatAuthPageAppearance` (`src/lib/clerkAppearance.ts`) para pegar con el
diseño. El panel de marca + el layout sí son fieles al export. El modal de auth
de dentro de la app (apariencia global) **no se toca**.

## Fuente
- `auth-layout.css` — CSS crudo del export (extraído del bundle JS-inyectado).

## Generar
```bash
node scripts/auth/build-auth.mjs
```
Produce `src/components/auth/authDesign.css` con cada selector scoped bajo `.av`
+ parches (contenedor de scroll, swap de lados). No editar el `.css` a mano.

El markup (paneles) vive en `src/components/auth/AuthShell.tsx`.
