// Captura GLOBAL de errores del servidor (route handlers, server components,
// render) vía el hook onRequestError de Next. Best-effort: NUNCA debe lanzar ni
// bloquear la respuesta. Persiste en la tabla `error_logs` (Supabase, service
// role) para que el admin pueda ver qué se rompe. Para ALERTAS en tiempo real
// (email/Slack) se enchufaría Sentry cuando haya cuenta + DSN.

type RequestInfo = { path?: string; method?: string };
type ErrorContext = { routerKind?: string; routePath?: string; renderSource?: string };

export async function onRequestError(error: unknown, request: RequestInfo, context: ErrorContext) {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = createClient();
    const e = error as { message?: string; stack?: string; digest?: string };
    await supabase.from("error_logs").insert({
      message: String(e?.message ?? error).slice(0, 2000),
      stack: (e?.stack ?? "").slice(0, 8000) || null,
      route: request?.path ?? null,
      method: request?.method ?? null,
      digest: e?.digest ?? null,
      context: {
        routerKind: context?.routerKind ?? null,
        routePath: context?.routePath ?? null,
        renderSource: context?.renderSource ?? null,
      },
    });
  } catch {
    // El logger jamás debe romper nada; si falla, se ignora en silencio.
  }
}
