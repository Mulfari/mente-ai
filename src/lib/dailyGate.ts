import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTier, nextVenezuelaMidnightUTC } from "@/lib/plans";
import { getAppConfig } from "@/lib/appConfig";

// Gate del tope diario freemium, compartido por las rutas server-side que
// autorizan un envío. OJO: el flujo real de chat NO pasa por /api/chat — el
// cliente pide token a /api/auth/vps-token (una vez por envío) y luego llama
// a /api/stream. Por eso el gate + consumo viven en vps-token (la verdad).

type GateProfile = {
  status?: string | null;
  subscription_weeks?: number | null;
  subscription_end?: string | null;
  daily_msg_count?: number | null;
  daily_reset_at?: string | null;
};

// null = puede enviar. Si no, el error con su code (403 baneado / 429 sin cuota).
export async function checkDailyAccess(profile: GateProfile, now: Date) {
  const tier = resolveTier(profile, now);
  if (tier === "banned") return { error: "Tu cuenta está inactiva.", code: 403 as const };
  if (tier === "unlimited" || tier === "paid") return null;
  const cfg = await getAppConfig();
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  const count = !resetAt || now >= resetAt ? 0 : (profile.daily_msg_count ?? 0);
  if (count >= cfg.freeDailyLimit) {
    const next = resetAt && now < resetAt ? resetAt : nextVenezuelaMidnightUTC(now);
    return { error: "Llegaste a tu límite diario gratis.", code: 429 as const, resetAt: next.toISOString() };
  }
  return null;
}

// Incrementa la cuota diaria si el perfil es tier free (no-op para pago/admin).
// Resetea la ventana si ya pasó la medianoche Venezuela.
export async function consumeDailyQuota(
  supabase: SupabaseClient,
  profile: GateProfile & { id: string },
  now: Date
) {
  if (resolveTier(profile, now) !== "free") return;
  const resetAt = profile.daily_reset_at ? new Date(profile.daily_reset_at) : null;
  const fresh = !resetAt || now >= resetAt;
  await supabase.from("profiles").update({
    daily_msg_count: fresh ? 1 : (profile.daily_msg_count ?? 0) + 1,
    daily_reset_at: fresh ? nextVenezuelaMidnightUTC(now).toISOString() : profile.daily_reset_at,
  }).eq("id", profile.id);
}
