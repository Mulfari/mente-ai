# Mente AI

Chat AI tipo ChatGPT con cuentas gestionadas por admin. Sin registro público — el admin activa cuentas.

## Tech Stack
- Next.js (App Router) + Tailwind
- Supabase (`swioimqjygpolttiequz`)
- API proxy: `api.selectapi.vip`

## Supabase Schema
- `profiles` — extiende auth.users (status, role, weekly limits)
- `conversations` — historial por usuario
- `messages` — mensajes por conversación

## Variables de entorno
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_BASE_URL`

## RLS
- Usuarios: solo ven sus propios datos
- Admins: ven y gestionan todos los perfiles

## Modelo de negocio
- Admin activa cuentas manualmente
- Límite semanal: mensajes por cuenta
- Sin freemium — un solo plan semanal