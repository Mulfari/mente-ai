import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import * as jose from "jose";

const VPS_URL = process.env.VPS_ORCHESTRATOR_URL || "http://177.7.46.156:3000";
const VPS_SECRET = process.env.VPS_SHARED_SECRET || "";

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

  return NextResponse.json({ token, vpsUrl: VPS_URL, expiresIn: 30 });
}