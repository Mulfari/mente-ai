import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTier } from "@/lib/plans";
import { getAppConfig } from "@/lib/appConfig";

// Agregaciones del dashboard de métricas del admin. Devuelve números crudos
// (MetricsData); la VISUALIZACIÓN la hace MetricsTab. Service role (RLS off).

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
  demandaSinCobertura: NamedCount[]; // top: pedidos locales SIN negocio en VeLocal (a quién reclutar)
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

  // "Activos": usuarios DISTINTOS con actividad real (query_events) en 7 días.
  // OJO: profiles.last_message_at NO se mantiene (siempre null) → no sirve como
  // señal de actividad; se deriva de query_events.user_id.
  const activeUsers7 = async (): Promise<number> => {
    const { data } = await supabase.from("query_events").select("user_id").gte("created_at", sinceISO(7)).limit(50000);
    return new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean)).size;
  };

  const [users, new7, new30, active7, paid, convs, msgs, queries, atLimit, errores7d] = await Promise.all([
    count("profiles"),
    count("profiles", (q) => q.gte("created_at", sinceISO(7))),
    count("profiles", (q) => q.gte("created_at", sinceISO(30))),
    activeUsers7(),
    count("profiles", (q) => q.gt("subscription_end", now.toISOString())),
    count("conversations"),
    count("messages"),
    count("query_events"),
    count("profiles", (q) => q.gte("daily_msg_count", cfg.freeDailyLimit)),
    count("error_logs", (q) => q.gte("created_at", sinceISO(7))),
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

  // Demanda sin cobertura: lo que la gente pidió y NO tenemos en VeLocal.
  // Agrupado por término + ciudad → la lista de a quién reclutar.
  const { data: dem } = await supabase.from("demand_signals").select("term, city").gte("created_at", thirty).limit(50000);
  const demandaSinCobertura = topCounts((dem ?? []).map((r: any) => {
    const t = (r.term ?? "").trim();
    const c = (r.city ?? "").trim();
    return t ? (c ? `${t} · ${c}` : t) : null;
  }));

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
    { label: "Errores · 7 días", value: errores7d },
  ];

  return { kpis, registros, mensajes, consultas, planes, ciudades, topConsultas, demandaSinCobertura };
}
