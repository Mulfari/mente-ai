# Mente AI — Especificación de Diseño

## Concepto

Plataforma de chat AI tipo ChatGPT, con cuentas gestionadas por un administrador. Usuarios inician sesión y acceden al chat con límites semanales de mensajes. Sin registro público — el admin crea y activa cuentas.

**Modelo de negocio:**
- Admin gestiona cuentas, apikeys y activación
- Una vendedora ofrece el servicio a sus clientes
- Clientes se auto-registran, admin verifica y activa
- 1 apikey compartida entre N cuentas
- Límite: mensajes por semana por cuenta

## Tech Stack

- **Frontend:** Next.js (App Router)
- **Auth:** Supabase (email/contraseña)
- **Chat API:** Custom con la API proxy existente (`api.selectapi.vip`)
- **Deploy:** Vercel

## Diseño Visual

### Nombre: Mente AI

### Paleta de colores
- Primary: `#2563EB`
- Secondary: `#1E40AF`
- Accent: `#60A5FA`
- Background: `#0F172A` (dark slate)
- Surface: `#1E293B`
- Border: `#334155`
- Text primary: `#F8FAFC`
- Text secondary: `#94A3B8`

### Tipografía
- Font principal: Inter (Google Fonts)
- Título: 600 weight, 2xl
- Body: 400 weight, base

### Layout

#### Página principal (sin login)
1. **Header fijo** (altura ~64px)
   - Logo "Mente AI" (texto con color accent)
   - Botón "Iniciar sesión" (outline, blanco)

2. **Área del chat**
   - Centrado vertical
   - Mensaje de bienvenida: "Inicia sesión para comenzar a chatear con Mente AI"
   - Input de mensaje deshabilitado con tooltip "Inicia sesión para continuar"

3. **Footer** (mínimo)
   - Copyright "© 2025 Mente AI"
   - Texto gris pequeño

#### Modal de login/registro
- Aparece al hacer click en input o botón "Iniciar sesión"
- Tabs: "Iniciar sesión" | "Registrarse"
- Campos: email + contraseña
- Botón submit
- Sin link de "olvidé mi contraseña" (admin gestiona)

#### Chat (loguedo)
- **Sidebar izquierda** (colapsable en móvil):
  - Logo + nombre
  - Botón "Nueva conversación"
  - Lista de conversaciones (últimas 20)
- **Área de chat central:**
  - Header con nombre del modelo "Mente AI"
  - Mensajes flotantes (user alineado derecha, AI alineado izquierda)
  - Input fijo abajo con contador de msgs restantes: "X mensajes restantes esta semana"
- **Sin perfil de usuario visible** — sesión simple

## Features

### Usuario
- [ ] Registro (email + contraseña)
- [ ] Login
- [ ] Ver chat (solo con cuenta activa)
- [ ] Enviar mensajes (si tiene msgs disponibles)
- [ ] Ver contador msgs restantes / usados
- [ ] Historial de conversaciones en sidebar
- [ ] Nueva conversación
- [ ] Logout

### Admin
- [ ] Panel admin (ruta protegida `/admin`)
- [ ] Ver lista de usuarios (pendientes, activos, rechazados)
- [ ] Activar cuenta
- [ ] Rechazar cuenta
- [ ] Ver uso por usuario (msgs consumidos, última actividad)
- [ ] Crear usuario manualmente
- [ ] Verificar cuenta (email verificado o no)

### Límite semanal
- Contador por usuario: msgs usados / msgs total
- Reseteo: cada lunes 00:00 UTC
- Si se agotan → mensaje "Has alcanzado tu límite semanal. Espera hasta el próximo lunes o contacta al administrador."

### Modelo de mensajes
- Límite por cuenta: configurable (empezamos con X msgs/semana, TBD tras cálculos)
- No limitamos por tokens — solo por cantidad de mensajes enviados
- 1 mensaje = 1 request a la API

### API integration
- Todas las requests pasan por el API proxy (`api.selectapi.vip`)
- API key almacenada en variable de entorno (`ANTHROPIC_API_KEY`)
- El servidor hace de proxy — usuarios no ven la key

## Estructura de datos (Supabase)

### Tabla: users (extends auth.users)
- id (uuid, FK auth.users)
- full_name (text, nullable)
- status (text: pending | active | rejected)
- role (text: user | admin)
- weekly_msg_limit (int, default 1000)
- weekly_used (int, default 0)
- week_start (timestamptz)
- created_at (timestamptz)
- activated_by (uuid, FK auth.users)

### Tabla: conversations
- id (uuid)
- user_id (uuid)
- title (text, default "Nueva conversación")
- created_at (timestamptz)
- updated_at (timestamptz)

### Tabla: messages
- id (uuid)
- conversation_id (uuid)
- role (text: user | assistant)
- content (text)
- created_at (timestamptz)

## API Routes

- `POST /api/chat` — Envía mensaje al proxy de Anthropic
  - Body: { message: string, conversation_id: string }
  - Valida: usuario activo, msgs disponibles
  - Decrementa contador
  - Devuelve respuesta del modelo

- `GET /api/conversations` — Lista del usuario
- `POST /api/conversations` — Nueva conversación
- `GET /api/conversations/[id]/messages` — Mensajes de una conversación

## Flujo de activación

1. Usuario se registra → status = "pending"
2. Admin ve lista de pendientes en `/admin`
3. Admin activa → status = "active"
4. Usuario puede usar el chat

## Pendiente (TBD por calcular)
- Precio del plan semanal
- Límite exacto de msgs/semana por cuenta
- Cómo le cobra la vendedora a sus clientes

## Status del proyecto

- [ ] Crear repo en GitHub
- [ ] Scaffolding Next.js
- [ ] Configurar Supabase (tablas, RLS, auth)
- [ ] Implementar UI del landing
- [ ] Implementar auth (login/register)
- [ ] Implementar chat funcional
- [ ] Implementar límites semanales
- [ ] Implementar panel admin
- [ ] Deploy a Vercel
- [ ] Conectar dominio