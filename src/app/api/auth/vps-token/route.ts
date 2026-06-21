import { auth } from "@clerk/nextjs/server";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import * as jose from "jose";
import { getProfileByClerkId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkDailyAccess, consumeDailyQuota } from "@/lib/dailyGate";
import { checkAnonAccess, consumeAnon, getAnonRemaining } from "@/lib/anonGate";

const VPS_SECRET = process.env.VPS_SHARED_SECRET || "";

function getBaseUrl() {
  // Hardcode www to avoid redirect from mulfai.com.ve → www.mulfai.com.ve
  // which would break SSE streaming (307 loses the stream)
  return "https://www.mulfai.com.ve";
}

const ANON_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 días
};

export async function POST() {
  if (!VPS_SECRET) {
    return NextResponse.json({ error: "VPS_SECRET no configurado" }, { status: 500 });
  }
  const secret = new TextEncoder().encode(VPS_SECRET);
  const { userId } = await auth();

  // ===== Flujo LOGUEADO (sin cambios respecto al original) =====
  if (userId) {
    const profile = await getProfileByClerkId(userId);
    if (!profile) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

    const now = new Date();
    const denied = await checkDailyAccess(profile, now);
    if (denied) return NextResponse.json(denied, { status: denied.code });

    const supabase = createClient();
    await consumeDailyQuota(supabase, profile as typeof profile & { id: string }, now);

    const token = await new jose.SignJWT({ userId: profile.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("30s")
      .sign(secret);
    return NextResponse.json({ token, vpsUrl: getBaseUrl(), expiresIn: 30 });
  }

  // ===== Flujo ANÓNIMO (trial de N mensajes antes del muro de registro) =====
  const jar = await cookies();
  let anonId = jar.get("vechat_anon")?.value;
  const needsCookie = !anonId;
  if (!anonId) anonId = crypto.randomUUID();
  const ip = ((await headers()).get("x-forwarded-for") || "").split(",")[0].trim() || null;

  const supabase = createClient();
  const denied = await checkAnonAccess(supabase, anonId, ip);
  if (denied) {
    const res = NextResponse.json(denied, { status: denied.code });
    if (needsCookie) res.cookies.set("vechat_anon", anonId, ANON_COOKIE_OPTS);
    return res;
  }

  await consumeAnon(supabase, anonId, ip);
  const left = await getAnonRemaining(supabase, anonId);
  const token = await new jose.SignJWT({ userId: "anon_" + anonId, anon: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);
  const res = NextResponse.json({ token, vpsUrl: getBaseUrl(), expiresIn: 30, anon: true, anonLeft: left });
  if (needsCookie) res.cookies.set("vechat_anon", anonId, ANON_COOKIE_OPTS);
  return res;
}
