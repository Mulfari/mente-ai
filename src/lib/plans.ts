// Tier resuelto: única fuente de verdad de acceso, usada por servidor y cliente.
export type Tier = "banned" | "unlimited" | "paid" | "free";
export type PaidPlan = "weekly" | "monthly";

export type TierInput = {
  status?: string | null;
  subscription_weeks?: number | null;
  subscription_end?: string | null;
};

// banned: el admin lo desactivó. unlimited: admin (-1). paid: plan vigente.
// free: todo lo demás (cuenta nueva, o plan vencido que cae a gratis).
export function resolveTier(p: TierInput, now: Date): Tier {
  if (p.status && p.status !== "active") return "banned";
  if ((p.subscription_weeks ?? 0) === -1) return "unlimited";
  if (p.subscription_end && new Date(p.subscription_end).getTime() > now.getTime()) return "paid";
  return "free";
}

// Medianoche del próximo día en hora Venezuela (UTC-4), expresada en UTC.
// VET no tiene horario de verano, así que el offset es fijo.
export function nextVenezuelaMidnightUTC(now: Date): Date {
  const VET_OFFSET_MS = 4 * 60 * 60 * 1000; // UTC-4
  const vetNow = new Date(now.getTime() - VET_OFFSET_MS);
  const vetMidnight = Date.UTC(
    vetNow.getUTCFullYear(), vetNow.getUTCMonth(), vetNow.getUTCDate() + 1, 0, 0, 0, 0
  );
  return new Date(vetMidnight + VET_OFFSET_MS);
}

export const PLAN_DURATION_KEY: Record<PaidPlan, string> = {
  weekly: "plan_weekly_days",
  monthly: "plan_monthly_days",
};
