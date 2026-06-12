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

  const { userId } = await auth();
  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (profile) {
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

  const feed = await getPublicFeed(city);
  return NextResponse.json(feed, {
    headers: { "Cache-Control": "private, max-age=120" },
  });
}
