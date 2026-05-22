import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as jose from "jose";

const VPS_SECRET = process.env.VPS_SHARED_SECRET || "";

function getBaseUrl() {
  // Hardcode www to avoid redirect from mulfai.com.ve → www.mulfai.com.ve
  // which would break SSE streaming (307 loses the stream)
  return "https://www.mulfai.com.ve";
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  if (!VPS_SECRET) {
    return NextResponse.json({ error: "VPS_SECRET no configurado" }, { status: 500 });
  }

  const secret = new TextEncoder().encode(VPS_SECRET);
  const token = await new jose.SignJWT({ userId: user.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30s")
    .sign(secret);

  // Browser connects to /api/stream on Vercel (HTTPS), Vercel proxies to VPS
  return NextResponse.json({ token, vpsUrl: getBaseUrl(), expiresIn: 30 });
}