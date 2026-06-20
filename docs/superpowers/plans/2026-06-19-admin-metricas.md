# Admin · tab "Métricas" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Agregar una pestaña "Métricas" a `/admin` con un dashboard de estadísticas (KPIs + crecimiento + uso + negocio/geografía/contenido), portando el diseño del export de Claude Design.

**Architecture:** Endpoint `GET /api/admin/data?type=stats` computa `MetricsData` (números crudos, vía `src/lib/adminStats.ts`); el componente `MetricsTab.tsx` hace la visualización (helpers del export); `AdminPanelClient` agrega la tab. Sin dependencias nuevas.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase (service role), `resolveTier` (src/lib/plans.ts), `getAppConfig` (src/lib/appConfig.ts).

**Spec:** `docs/superpowers/specs/2026-06-19-admin-metricas-design.md`
**Referencia visual:** `C:\tmp\showcase-variantes\VeChatMetrics.dc.html` (export).

---

## Hechos verificados (no re-investigar)
- `resolveTier(p: {status, subscription_weeks, subscription_end}, now): "banned"|"unlimited"|"paid"|"free"`. La división Semanal/Mensual sale de `profiles.plan` ('weekly'/'monthly').
- Columnas: `profiles(created_at, last_message_at, subscription_end, daily_msg_count, status, subscription_weeks, plan)`, `conversations(created_at)`, `messages(created_at)`, `query_events(created_at, prompt, city)`, `user_context(city)`.
- `AdminPanelClient`: `type Tab = "users"|"coupons"|"places"|"config"` (línea 49), `activeTab` state (línea 62), barra de tabs (línea ~525, `if (t==="config") loadConfig()`).
- El endpoint admin ya está gateado por `requireAdmin()`.
- `getAppConfig()` devuelve `{ free_daily_limit, ... }`.
- Series/top: supabase-js no agrupa por día/columna → se traen las filas (filtradas) y se agrupan en JS. Con la data actual (≤126 filas) es trivial; a escala, mover a un RPC/agregado SQL (YAGNI hoy).
- Mapeo de tokens del export → reales: `--ink→--text-primary`, `--ink-3→--text-tertiary`, `--brand→--primary`, `--surface→--surface`, `--border→--border`, `--track→color-mix(in srgb, var(--text-primary) 7%, transparent)`.

## File Structure
- **Create** `src/lib/adminStats.ts` — `getStats(supabase) → MetricsData` + tipos. Toda la agregación.
- **Create** `src/components/admin/MetricsTab.tsx` — visualización (porta el export).
- **Modify** `src/app/api/admin/data/route.ts` — rama `type === "stats"`.
- **Modify** `src/components/AdminPanelClient.tsx` — tab + carga + render.

---

## Task 1: `adminStats.ts` (agregaciones → MetricsData)

**Files:** Create `src/lib/adminStats.ts`

- [ ] **Step 1: Escribir el archivo completo**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTier } from "@/lib/plans";
import { getAppConfig } from "@/lib/appConfig";

export type Kpi = { label: string; value: number; delta?: string };
export type NamedCount = { name: string; count: number };
export type MetricsData = {
  kpis: Kpi[];
  registros: number[];   // 30 (hoy-29 … hoy), hora VE
  mensajes: number[];    // 30
  consultas: number[];   // 30
  planes: NamedCount[];  // Free, Semanal, Mensual, Ilimitado, Bloqueado
  ciudades: NamedCount[];      // top 10
  topConsultas: NamedCount[];  // top 10
};

const DAYS = 30;
const VE = 4 * 3600 * 1000; // UTC-4
const dayKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

// Cuenta timestamps en 30 buckets diarios (hora VE), del más viejo al de hoy.
function bucket30(timestamps: (string | null)[]): number[] {
  const out = new Array(DAYS).fill(0);
  const nowVE = new Date(Date.now() - VE);
  const idx = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(nowVE);
    d.setUTCDate(nowVE.getUTCDate() - (DAYS - 1 - i));
    idx.set(dayKey(d), i);
  }
  for (const ts of timestamps) {
    if (!ts) continue;
    const i = idx.get(dayKey(new Date(new Date(ts).getTime() - VE)));
    if (i != null) out[i]++;
  }
  return out;
}

function topCounts(values: (string | null)[], limit = 10): NamedCount[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (!s) continue;
    m.set(s, (m.get(s) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function getStats(supabase: SupabaseClient): Promise<MetricsData> {
  const now = new Date();
  const cfg = await getAppConfig();
  const sinceISO = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  const thirty = sinceISO(DAYS);

  const count = async (table: string, build?: (q: any) => any): Promise<number> => {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count } = await q;
    return count ?? 0;
  };
  const series = async (table: string): Promise<number[]> => {
    const { data } = await supabase.from(table).select("created_at").gte("created_at", thirty).limit(50000);
    return bucket30((data ?? []).map((r: any) => r.created_at));
  };

  const [users, new7, new30, active7, paid, convs, msgs, queries, atLimit] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.gte("created_at", sinceISO(7))),
    count("profiles", (q) => q.gte("created_at", sinceISO(30))),
    count("profiles", (q) => q.gte("last_message_at", sinceISO(7))),
    count("profiles", (q) => q.gt("subscription_end", now.toISOString())),
    count("conversations"),
    count("messages"),
    count("query_events"),
    count("profiles", (q) => q.gte("daily_msg_count", cfg.free_daily_limit)),
  ]);

  const [registros, mensajes, consultas] = await Promise.all([
    series("profiles"), series("messages"), series("query_events"),
  ]);

  const { data: profs } = await supabase
    .from("profiles")
    .select("status, subscription_weeks, subscription_end, plan")
    .limit(100000);
  const pc: Record<string, number> = { Free: 0, Semanal: 0, Mensual: 0, Ilimitado: 0, Bloqueado: 0 };
  for (const p of profs ?? []) {
    const t = resolveTier(p as any, now);
    if (t === "banned") pc.Bloqueado++;
    else if (t === "unlimited") pc.Ilimitado++;
    else if (t === "free") pc.Free++;
    else pc[(p as any).plan === "weekly" ? "Semanal" : "Mensual"]++;
  }
  const planes = ["Free", "Semanal", "Mensual", "Ilimitado", "Bloqueado"].map((name) => ({ name, count: pc[name] }));

  const { data: ctxs } = await supabase.from("user_context").select("city").limit(100000);
  const ciudades = topCounts((ctxs ?? []).map((r: any) => r.city));

  const { data: qs } = await supabase.from("query_events").select("prompt").not("prompt", "is", null).limit(50000);
  const topConsultas = topCounts((qs ?? []).map((r: any) => r.prompt));

  const kpis: Kpi[] = [
    { label: "Usuarios totales", value: users },
    { label: "Nuevos · 7 días", value: new7 },
    { label: "Nuevos · 30 días", value: new30 },
    { label: "Activos · 7 días", value: active7 },
    { label: "De pago · vigentes", value: paid },
    { label: "Conversaciones", value: convs },
    { label: "Mensajes", value: msgs },
    { label: "Consultas", value: queries },
    { label: "Tocaron el límite · hoy", value: atLimit },
  ];

  return { kpis, registros, mensajes, consultas, planes, ciudades, topConsultas };
}
```

- [ ] **Step 2: Validar la lógica de buckets (node)**

```bash
node --input-type=module <<'EOF'
const DAYS=30, VE=4*3600*1000;
const dayKey=d=>`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
function bucket30(ts){const out=new Array(DAYS).fill(0);const nowVE=new Date(Date.now()-VE);const idx=new Map();for(let i=0;i<DAYS;i++){const d=new Date(nowVE);d.setUTCDate(nowVE.getUTCDate()-(DAYS-1-i));idx.set(dayKey(d),i);}for(const t of ts){if(!t)continue;const i=idx.get(dayKey(new Date(new Date(t).getTime()-VE)));if(i!=null)out[i]++;}return out;}
const today=new Date().toISOString();
const r=bucket30([today,today,null]);
console.log("len30:", r.length===30, "hoy(last)>=2:", r[29]>=2, "sum:", r.reduce((a,b)=>a+b,0));
EOF
```
Expected: `len30: true hoy(last)>=2: true sum: 2`

- [ ] **Step 3: Commit**

```bash
git add src/lib/adminStats.ts
git commit -m "feat(admin): adminStats.getStats -> MetricsData (KPIs, series 30d, planes, top ciudades/consultas)"
```

---

## Task 2: rama `type === "stats"` en la ruta admin

**Files:** Modify `src/app/api/admin/data/route.ts`

- [ ] **Step 1: Import + rama (dentro del `GET`, junto a las otras ramas `type`)**

Agregar el import arriba:
```ts
import { getStats } from "@/lib/adminStats";
```
Y antes de `return NextResponse.json({ error: "Invalid type" }, { status: 400 });` del `GET`:
```ts
    if (type === "stats") {
      const stats = await getStats(supabase);
      return NextResponse.json({ data: stats });
    }
```

- [ ] **Step 2: Build** — `npm run build`. Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/data/route.ts
git commit -m "feat(admin): endpoint GET /api/admin/data?type=stats"
```

---

## Task 3: Componente `MetricsTab.tsx` (porta el export)

**Files:** Create `src/components/admin/MetricsTab.tsx`

- [ ] **Step 1: Escribir el archivo completo**

```tsx
"use client";

import type { CSSProperties } from "react";
import type { MetricsData, NamedCount } from "@/lib/adminStats";

const INK = "var(--text-primary)";
const INK3 = "var(--text-tertiary)";
const BRAND = "var(--primary)";
const SURFACE = "var(--surface)";
const BORDER = "var(--border)";
const TRACK = "color-mix(in srgb, var(--text-primary) 7%, transparent)";
const DISP = "'Bricolage Grotesque', Inter, sans-serif";

const card: CSSProperties = { background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 };
const sectionLabel: CSSProperties = { font: "600 11px Inter", letterSpacing: ".08em", textTransform: "uppercase", color: INK3 };
const cardTitle: CSSProperties = { font: `600 14px ${DISP}`, color: INK };

function bars(arr: number[]) {
  const m = Math.max(1, ...arr);
  return arr.map((v) => ({ h: Math.round((v / m) * 100), on: v > 0 }));
}
function spark(arr: number[]) {
  const n = arr.length, m = Math.max(1, ...arr), W = 300, H = 100, pad = 14;
  const pts = arr.map((v, i) => {
    const x = n === 1 ? W / 2 : Math.round((i / (n - 1)) * W * 10) / 10;
    const y = Math.round((H - (v / m) * (H - pad)) * 10) / 10;
    return `${x},${y}`;
  });
  const line = "M" + pts.join(" L");
  return { line, area: `${line} L${W},${H} L0,${H} Z` };
}
function withWidth(items: NamedCount[]) {
  const m = Math.max(1, ...items.map((i) => i.count));
  return items.map((i) => ({ ...i, w: Math.round((i.count / m) * 100) }));
}

function MapIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" /><path d="M9 4v14M15 6v14" /></svg>);
}
function ChatIcon() {
  return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
}

function BarRow({ data }: { data: ReturnType<typeof bars>; height: number }) {
  return null;
}

function TopList({ title, items, icon }: { title: string; items: NamedCount[]; icon: "map" | "chat" }) {
  const rows = withWidth(items);
  return (
    <div style={card}>
      <span style={cardTitle}>{title}</span>
      {rows.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          {rows.map((t, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ font: "500 13px Inter", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</span>
                <span style={{ font: "600 12.5px Inter", color: INK }}>{t.count}</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: TRACK }}>
                <div style={{ height: "100%", width: `${t.w}%`, borderRadius: 999, background: BRAND, opacity: 0.6 }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", color: INK3, font: "500 13px Inter" }}>
          {icon === "map" ? <MapIcon /> : <ChatIcon />} Sin datos todavía
        </div>
      )}
    </div>
  );
}

export default function MetricsTab({ data }: { data: MetricsData }) {
  const reg = bars(data.registros);
  const con = bars(data.consultas);
  const msg = spark(data.mensajes);
  const planTotal = data.planes.reduce((s, p) => s + p.count, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, color: INK, fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={sectionLabel}>Resumen</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
        {data.kpis.map((k, i) => (
          <div key={i} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: "13px 14px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div style={{ font: "600 10.5px Inter", letterSpacing: ".05em", textTransform: "uppercase", color: INK3, lineHeight: 1.3 }}>{k.label}</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
              <span style={{ font: "600 27px Inter", letterSpacing: "-.02em", color: INK, lineHeight: 1 }}>{k.value}</span>
              {k.delta ? <span style={{ font: "600 11px Inter", color: BRAND }}>↑ {k.delta}</span> : null}
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Crecimiento</div>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <span style={cardTitle}>Registros por día</span>
          <span style={{ font: "500 12px Inter", color: INK3 }}>últimos 30 días</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 112 }}>
          {reg.map((b, i) => (<div key={i} style={{ flex: 1, height: `${b.h}%`, minHeight: 3, borderRadius: "3px 3px 0 0", background: b.on ? BRAND : TRACK }} />))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", font: "500 11px Inter", color: INK3 }}><span>hace 30 días</span><span>hoy</span></div>
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Uso</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <span style={cardTitle}>Mensajes por día</span><span style={{ font: "500 12px Inter", color: INK3 }}>30 días</span>
          </div>
          <svg viewBox="0 0 300 100" preserveAspectRatio="none" style={{ width: "100%", height: 82, display: "block" }}>
            <path d={msg.area} fill={BRAND} fillOpacity={0.12} stroke="none" />
            <path d={msg.line} fill="none" stroke={BRAND} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </svg>
        </div>
        <div style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <span style={cardTitle}>Consultas por día</span><span style={{ font: "500 12px Inter", color: INK3 }}>30 días</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 82 }}>
            {con.map((b, i) => (<div key={i} style={{ flex: 1, height: `${b.h}%`, minHeight: 3, borderRadius: "3px 3px 0 0", background: b.on ? BRAND : TRACK }} />))}
          </div>
        </div>
      </div>

      <div style={{ ...sectionLabel, marginTop: 6 }}>Negocio · geografía · contenido</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: 14 }}>
        <div style={card}>
          <span style={cardTitle}>Usuarios por plan</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {data.planes.map((p, i) => {
              const pct = planTotal ? Math.round((p.count / planTotal) * 100) : 0;
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ font: "500 13px Inter", color: INK }}>{p.name}</span>
                    <span style={{ font: "500 12px Inter", color: INK3 }}>{p.count} · {pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 999, background: TRACK, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, borderRadius: 999, background: BRAND }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <TopList title="Top ciudades" items={data.ciudades} icon="map" />
        <TopList title="Top consultas" items={data.topConsultas} icon="chat" />
      </div>
    </div>
  );
}
```

> Nota: borrar la función muerta `BarRow` antes de commit (quedó de un esbozo).

- [ ] **Step 2: Build** — `npm run build`. Expected: `✓ Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/MetricsTab.tsx
git commit -m "feat(admin): MetricsTab (porta el dashboard del export, tokens VeChat, sin deps)"
```

---

## Task 4: Cablear la tab en `AdminPanelClient`

**Files:** Modify `src/components/AdminPanelClient.tsx`

LEER el archivo alrededor de: el tipo `Tab` (línea ~49), el estado (línea ~62), la barra de tabs (línea ~525) y dónde se renderizan las tabs (`{activeTab === "config" && (…)}`, línea ~1288).

- [ ] **Step 1: Tipo + estado + import**

- Import: `import MetricsTab from "@/components/admin/MetricsTab";` y `import type { MetricsData } from "@/lib/adminStats";`
- Tipo: `type Tab = "users" | "coupons" | "places" | "config" | "stats";`
- Estado: `const [stats, setStats] = useState<MetricsData | null>(null);` y `const [statsLoading, setStatsLoading] = useState(false);`

- [ ] **Step 2: Cargador (junto a los otros `load*`)**

```tsx
async function loadStats() {
  setStatsLoading(true);
  try {
    const res = await fetch("/api/admin/data?type=stats");
    const json = res.ok ? await res.json() : null;
    setStats(json?.data ?? null);
  } finally {
    setStatsLoading(false);
  }
}
```

- [ ] **Step 3: Botón en la barra de tabs**

En el `.map(["users","coupons","places","config"] …)` agregar `"stats"`:
`{(["users", "coupons", "places", "config", "stats"] as const).map(t => (`
y en el onClick: `onClick={() => { setActiveTab(t); if (t === "config") loadConfig(); if (t === "stats") loadStats(); }}`
y en la etiqueta: `… : t === "config" ? "Configuracion" : "Métricas"}` (extender el ternario).

- [ ] **Step 4: Render de la tab**

Donde van los bloques `{activeTab === "X" && (…)}`, agregar:
```tsx
{activeTab === "stats" && (
  statsLoading || !stats
    ? <div style={{ padding: "24px 0", color: "var(--text-tertiary)", fontSize: 13 }}>Cargando métricas…</div>
    : <MetricsTab data={stats} />
)}
```

- [ ] **Step 5: Build** — `npm run build`. Expected: `✓ Compiled successfully`.

- [ ] **Step 6: Commit**

```bash
git add src/components/AdminPanelClient.tsx
git commit -m "feat(admin): tab Metricas en el panel (carga type=stats + render MetricsTab)"
```

---

## Task 5: Build final, merge a main y verificación en prod

- [ ] **Step 1:** `npm run build` en `main` tras mergear. Expected: verde.
- [ ] **Step 2:** push a `main` (deploy). Esperar READY.
- [ ] **Step 3: Verificación** (cuenta admin, en prod):
  - `/admin` → tab "Métricas" → KPIs cuadran con los conteos reales (Usuarios, Conversaciones, Mensajes, Consultas).
  - Las barras (registros/consultas) y la sparkline (mensajes) se ven; "Usuarios por plan" suma el total; "Top ciudades"/"Top consultas" muestran datos o "Sin datos todavía".
  - Probar en móvil (tarjetas reapilan) y en tema oscuro.
  - Regresión: las tabs Usuarios/Cupones/Lugares/Config siguen igual.

---

## Self-review
- **Cobertura del spec:** endpoint+contrato (T1,T2), componente/viz (T3), tab+carga+render (T4), build/merge/verify (T5). KPIs, series 30d, planes (resolveTier+plan), ciudades, top consultas, estados vacíos → todos cubiertos. ✔
- **Sin placeholders de lógica:** `getStats` y `MetricsTab` van con código real. T4 indica LEER el archivo (cambios de cableado sobre patrón existente `loadConfig`). El único pendiente explícito (borrar `BarRow` muerta) está señalado. ✔
- **Consistencia de tipos:** `MetricsData`/`NamedCount`/`Kpi` definidos en T1 (`adminStats.ts`) y consumidos igual en T3 (`MetricsTab`) y T4 (estado). El endpoint devuelve `{ data: MetricsData }`; el cargador lee `json.data`. ✔
