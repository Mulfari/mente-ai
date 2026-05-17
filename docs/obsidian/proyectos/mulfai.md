# Mulfai

## Qué es
Plataforma de chat AI + directorio local para Venezuela. Asistente AI (Claude via proxy) con directorio curado de lugares.

## Tech Stack
- Next.js 14+ (App Router) + Tailwind + TypeScript
- Supabase (`swioimqjygpolttiequz`) — auth + DB
- AI: Claude via proxy `api.selectapi.vip` (modelo privado)
- Vercel (deployment)
- Resend (emails transaccionales)

## Links
- Repo: https://github.com/Mulfari/mente-ai
- Deploy: https://www.mulfai.com.ve
- Supabase: project `swioimqjygpolttiequz`

## Modelo de negocio
- Admin activa cuentas manualmente (`jscmulfari@gmail.com`)
- Sin registro público
- Sin límites por mensaje — basado en semanas de suscripción
- `subscription_weeks > 0` = activo

## Variables de entorno (Vercel)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
ANTHROPIC_API_KEY
ANTHROPIC_BASE_URL=https://api.selectapi.vip
SUPABASE_SERVICE_ROLE_KEY
```

## DB Schema
- `profiles` — auth.users extendido (status, role, subscription_weeks, etc.)
- `conversations` — historial por usuario
- `messages` — mensajes por conversación
- `coupons` — cupones de suscripción
- `knowledge_rules` — reglas predefinidas de Q&A
- `places` — directorio local
- `categories` — categorías de lugares
- `cities` — ciudades

## RLS
- Deshabilitado en todas las tablas
- Control de acceso en rutas API server-side

## Archivos clave
- `src/app/api/chat/route.ts` — Chat principal con streaming
- `src/app/api/analyze/route.ts` — Análisis de consulta para RAG
- `src/components/ChatInterface.tsx` — UI de chat
- `src/components/AuthModal.tsx` — Login/register
- `src/components/AdminPanelClient.tsx` — Admin panel
- `src/components/Sidebar.tsx` — Sidebar de conversaciones
- `mcp-server/server.js` — MCP server de knowledge rules

## Features
- [x] Streaming de respuestas
- [x] Contexto de conversación (últimos 30 mensajes)
- [x] Syntax highlighting en código
- [x] Temas dark/light
- [x] Retry de respuestas fallidas
- [x] Modo "deep" con extended thinking
- [x] Conversaciones guardadas en Supabase
- [x] Carga de imágenes
- [x] Research command (`investiga X en Y`)
- [x] Branded emails (Resend)

## Pending
- [ ] Fix streaming SSE (frontend espera `chunk/text`, backend envía formato nativo Anthropic)
- [ ] Mejorar pipeline RAG (enriquecer prompt con knowledge_rules + places destacados)
- [ ] Poblar tabla `places` (DB vacía)
- [ ] Re-habilitar RLS con políticas correctas
- [ ] Custom domain
- [ ] Conectar MCP server al chat real
- [ ] Sincronizar reglas DB ↔ `server.js`
- [ ] Sistema de feedback (thumbs up/down)
- [ ] Place submissions (crowdsourcing)
