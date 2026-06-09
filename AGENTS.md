<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Infraestructura (leer antes de tocar el backend)

**El backend de producción está en `203.161.47.133`.** NO es `177.7.46.156`.
- `177.7.46.156` (puerto 22) era un VPS viejo / de desarrollo. Las contraseñas
  en scripts viejos (`L3l'cyvqq4M;uGhd@Jf@`) son de ESE, no del prod.
- `203.161.47.133` (puerto 3000 = orchestrator) es el VPS real. **SSH NO está
  en el puerto 22** — está en **22022** y solo accesible con la clave
  pública de `C:\Users\joses\.mavis\ssh\mavis_id_ed25519` ya instalada en
  `~/.ssh/authorized_keys` del server.
- Dominio público de la app: `mulfai.com.ve` (NO `mente-ai.com`).
- Vercel: `VPS_ORCHESTRATOR_URL=http://203.161.47.133:3000` apunta al
  orchestrator de prod. Cualquier proxy / servicio nuevo debe correr en
  ESE VPS, no en otro.

**Regla de oro:** antes de instalar algo o escribir un script de deploy,
verificar contra el env real de Vercel (`npx vercel env pull`) Y contra
la IP que Vercel tiene configurada para `VPS_ORCHESTRATOR_URL`. Si no
coinciden, preguntar al usuario antes de actuar.
