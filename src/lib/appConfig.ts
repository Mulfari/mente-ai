import { createClient } from "@/lib/supabase/server";

export type AppConfig = {
  freeDailyLimit: number;
  priceWeeklyUsd: number;
  priceMonthlyUsd: number;
  planWeeklyDays: number;
  planMonthlyDays: number;
  whatsappNumber: string;
};

const DEFAULTS: AppConfig = {
  freeDailyLimit: 10,
  priceWeeklyUsd: 2,
  priceMonthlyUsd: 6,
  planWeeklyDays: 7,
  planMonthlyDays: 30,
  whatsappNumber: "",
};

// Lee app_config y cae a DEFAULTS si falta una clave o falla la query.
export async function getAppConfig(): Promise<AppConfig> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_config").select("key, value");
    if (!data) return DEFAULTS;
    const m = new Map(data.map((r: { key: string; value: string }) => [r.key, r.value]));
    const num = (k: string, d: number) => {
      const v = Number(m.get(k));
      return Number.isFinite(v) ? v : d;
    };
    return {
      freeDailyLimit: num("free_daily_limit", DEFAULTS.freeDailyLimit),
      priceWeeklyUsd: num("price_weekly_usd", DEFAULTS.priceWeeklyUsd),
      priceMonthlyUsd: num("price_monthly_usd", DEFAULTS.priceMonthlyUsd),
      planWeeklyDays: num("plan_weekly_days", DEFAULTS.planWeeklyDays),
      planMonthlyDays: num("plan_monthly_days", DEFAULTS.planMonthlyDays),
      whatsappNumber: String(m.get("whatsapp_number") ?? DEFAULTS.whatsappNumber),
    };
  } catch {
    return DEFAULTS;
  }
}

export { DEFAULTS as APP_CONFIG_DEFAULTS };
