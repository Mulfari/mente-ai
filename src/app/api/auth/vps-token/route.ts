import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import * as jose from "jose";
import { getProfileByClerkId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkDailyAccess, consumeDailyQuota } from "@/lib/dailyGate";

const VPS_SECRET = process.env.VPS_SHARED_SECRET || "";

function getBaseUrl() {
  // Hardcode www to avoid redirect from mulfai.com.ve → www.mulfai.com.ve
  // which would break SSE streaming (307 loses the stream)
  return "https://www.mulfai.com.ve";
}

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!VPS_SECRET) {
    return NextResponse.json({ error: "VPS_SECRET no configurado" }, { status: 500 });
  }

  // The VPS identifies users by the internal profile UUID (same id that
  // /api/chat signs), not by the Clerk user id.
  const profile = await getProfileByClerkId(userId);
  if (!profile) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

  // Gate freemium: este endpoint es la puerta real de cada envío (el cliente
  // pide token aquí justo antes de llamar al stream). Sin token no hay chat.
  const now = new Date();
  const denied = await checkDailyAccess(profile, now);
  if (denied) return NextResponse.json(denied, { status: denied.code });

  // Consumir cuota (incrementa solo si es tier free). 1 token ≈ 1 envío.
  const supabase = createClient();
  await consumeDailyQuota(supabase, profile as typeof profile & { id: string }, now);

  const secret = new TextEncoder().encode(VPS_SECRET);
  const token = await new jose.SignJWT({ userId: profile.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);

  // Browser connects to /api/stream on Vercel (HTTPS), Vercel proxies to VPS
  return NextResponse.json({ token, vpsUrl: getBaseUrl(), expiresIn: 30 });
}