import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppConfig } from "@/lib/appConfig";
import type { PaidPlan } from "@/lib/plans";

// Activa/extiende un plan pago para un perfil (por profiles.id interno).
// Centraliza la escritura de plan + subscription_*; la llaman cupones, admin
// y (futuro) el webhook de una pasarela — sin tocar UI ni gating.
export async function activatePlan(
  supabase: SupabaseClient,
  profileId: string,
  plan: PaidPlan,
  now: Date = new Date()
): Promise<{ subscriptionEnd: string }> {
  const cfg = await getAppConfig();
  const days = plan === "weekly" ? cfg.planWeeklyDays : cfg.planMonthlyDays;

  const { data: profile } = await supabase
    .from("profiles").select("subscription_end").eq("id", profileId).single();

  const prevEnd = profile?.subscription_end ? new Date(profile.subscription_end).getTime() : 0;
  const base = Math.max(prevEnd, now.getTime());
  const subscriptionEnd = new Date(base + days * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("profiles").update({
    plan,
    status: "active",
    subscription_start: now.toISOString(),
    subscription_end: subscriptionEnd,
    subscription_weeks: Math.ceil(days / 7),
  }).eq("id", profileId);

  return { subscriptionEnd };
}
