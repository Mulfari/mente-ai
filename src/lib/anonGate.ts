import type { SupabaseClient } from "@supabase/supabase-js";

// Trial anónimo: los visitantes deslogueados pueden enviar unos pocos mensajes
// antes del muro de registro. Cap por visitante (cookie) + guardia anti-abuso
// por IP. No hay perfil; nada se persiste. La lógica de decisión es PURA
// (testeable); las funciones async solo cuentan en `anon_usage` y delegan.

export const ANON_TRIAL_LIMIT = 3; // mensajes gratis por visitante (cookie)
export const ANON_IP_DAILY_LIMIT = 20; // guardia anti-abuso por IP / 24h

export type AnonDenied = { error: string; code: 429; register: true };

// PURO: null = puede enviar; si no, el 429 con register:true (dispara el muro).
export function anonDecision(byAnon: number, byIp: number | null): AnonDenied | null {
  if (byAnon >= ANON_TRIAL_LIMIT) {
    return { error: "Regístrate gratis para seguir chateando.", code: 429, register: true };
  }
  if (byIp != null && byIp >= ANON_IP_DAILY_LIMIT) {
    return { error: "Demasiados mensajes desde tu red hoy. Regístrate gratis para seguir.", code: 429, register: true };
  }
  return null;
}

// PURO: cuántos mensajes le quedan al visitante (para el pill).
export function anonRemaining(byAnon: number): number {
  return Math.max(0, ANON_TRIAL_LIMIT - byAnon);
}

const DAY_MS = 24 * 3600 * 1000;

async function countSince(
  supabase: SupabaseClient,
  col: "anon_id" | "ip",
  val: string,
  since: string
): Promise<number> {
  const { count } = await supabase
    .from("anon_usage")
    .select("*", { count: "exact", head: true })
    .eq(col, val)
    .gte("created_at", since);
  return count ?? 0;
}

// null = puede enviar; si no, el denied (429 register).
export async function checkAnonAccess(
  supabase: SupabaseClient,
  anonId: string,
  ip: string | null,
  now: Date = new Date()
): Promise<AnonDenied | null> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const byAnon = await countSince(supabase, "anon_id", anonId, since);
  const byIp = ip ? await countSince(supabase, "ip", ip, since) : null;
  return anonDecision(byAnon, byIp);
}

// Registra un mensaje anónimo consumido (best-effort lo llama el caller).
export async function consumeAnon(
  supabase: SupabaseClient,
  anonId: string,
  ip: string | null
): Promise<void> {
  await supabase.from("anon_usage").insert({ anon_id: anonId, ip });
}

export async function getAnonRemaining(
  supabase: SupabaseClient,
  anonId: string,
  now: Date = new Date()
): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  return anonRemaining(await countSince(supabase, "anon_id", anonId, since));
}
