import { createClient } from "@/lib/supabase/server";
import { DEFAULT_INTENT_DOMAINS } from "@/lib/webSearch";

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

// Dominios por intención para la búsqueda web (include_domains de Tavily).
// Editable SIN redeploy: fila `web_domains` en app_config con un JSON
// {intención: [dominios]}; cae a DEFAULT_INTENT_DOMAINS si falta o falla.
// Cacheado en memoria del proceso (TTL 5 min) para no leer la BD en cada
// búsqueda. Para editar: actualizar esa fila (admin o SQL).
let _webDomainsCache: { at: number; v: Record<string, string[]> } | null = null;
export async function getWebDomains(): Promise<Record<string, string[]>> {
  if (_webDomainsCache && Date.now() - _webDomainsCache.at < 5 * 60 * 1000) {
    return _webDomainsCache.v;
  }
  let v: Record<string, string[]> = { ...DEFAULT_INTENT_DOMAINS };
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("app_config").select("value").eq("key", "web_domains").maybeSingle();
    if (data?.value) {
      const parsed = JSON.parse(data.value);
      if (parsed && typeof parsed === "object") {
        for (const [k, arr] of Object.entries(parsed)) {
          if (Array.isArray(arr)) v[k] = arr.filter((d): d is string => typeof d === "string");
        }
      }
    }
  } catch {
    // sin fila / JSON inválido / error de red → defaults
  }
  _webDomainsCache = { at: Date.now(), v };
  return v;
}
