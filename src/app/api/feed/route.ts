import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";
import { getPublicFeed } from "@/lib/feed";

// GET /api/feed — el feed de tendencias compartido por toda la app
// (home deslogueada y empty state del chat). Ciudad: la declarada por el
// usuario (user_context) o la de la IP (header de Vercel).
export async function GET(req: NextRequest) {
  let city: string | null = null;
  let internalUserId: string | null = null;

  const { userId } = await auth();
  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (profile) {
      internalUserId = profile.id;
      const supabase = createClient();
      const { data: ctx } = await supabase
        .from("user_context")
        .select("city")
        .eq("user_id", profile.id)
        .maybeSingle();
      city = ((ctx?.city ?? "").trim()) || null;
    }
  }

  if (!city) {
    const ipCity = req.headers.get("x-vercel-ip-city");
    if (ipCity) {
      try {
        city = decodeURIComponent(ipCity).trim() || null;
      } catch { /* header malformado */ }
    }
  }

  // El UUID interno habilita la sección "Para ti" (personalizada por el
  // historial del usuario); null para visitantes.
  const feed = await getPublicFeed(city, internalUserId);

  // Refresco en segundo plano: si la caché materializada del cron tiene más
  // de 6h (o existe la tabla pero aún no hay fila), disparamos el digest sin
  // esperar la respuesta. El cron diario es el piso; con tráfico real la
  // frescura efectiva es de horas.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    try {
      const supabase = createClient();
      const { data: cacheRow, error } = await supabase
        .from("feed_cache")
        .select("updated_at")
        .eq("id", "topics")
        .maybeSingle();
      const stale =
        !error && (!cacheRow || Date.now() - new Date(cacheRow.updated_at).getTime() > 6 * 3600_000);
      if (stale) {
        void fetch(`${req.nextUrl.origin}/api/cron/feed-digest?secret=${cronSecret}`).catch(() => {});
        // micro-espera para que el request alcance a salir antes de cerrar
        await new Promise((r) => setTimeout(r, 150));
      }
    } catch { /* tabla sin migrar — el cron diario lo intentará igual */ }
  }

  return NextResponse.json(feed, {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
