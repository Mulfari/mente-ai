import { NextRequest, NextResponse } from "next/server";
import { runFeedDigest } from "@/lib/feedDigest";

// GET /api/cron/feed-digest — canonicaliza preguntas nuevas con el LLM y
// materializa los temas agregados en feed_cache. Lo dispara:
//   - el cron de Vercel (manda Authorization: Bearer CRON_SECRET solo), y
//   - /api/feed en segundo plano cuando ve la caché vieja (?secret=).
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  const qs = req.nextUrl.searchParams.get("secret");
  if (!secret || (authz !== `Bearer ${secret}` && qs !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runFeedDigest();
    return NextResponse.json({ ok: true, ...stats });
  } catch (e) {
    const message = e instanceof Error ? e.message : "digest failed";
    // 503 con pista: el caso típico es la migración de tablas sin aplicar.
    return NextResponse.json({ ok: false, error: message }, { status: 503 });
  }
}
