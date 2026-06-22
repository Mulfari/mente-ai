import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getProfileByClerkId } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { VARIANT_A, VARIANT_B, winnerLabel } from "@/lib/abTest";

// Registra la preferencia del A/B de respuestas (solo logueados). Alimenta el
// panel admin "% de victoria por estilo".
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { chosen?: string; prompt?: string } = {};
  try { body = await req.json(); } catch {}
  const chosen = body.chosen === "b" ? "b" : body.chosen === "a" ? "a" : null;
  if (!chosen) return NextResponse.json({ ok: false, error: "chosen inválido" }, { status: 400 });

  try {
    const profile = await getProfileByClerkId(userId);
    const supabase = createClient();
    await supabase.from("response_feedback").insert({
      user_id: profile?.id ?? null,
      prompt: typeof body.prompt === "string" ? body.prompt.slice(0, 1000) : null,
      variant_a: VARIANT_A,
      variant_b: VARIANT_B,
      chosen,
      winner: winnerLabel(chosen),
    });
  } catch {
    // best-effort: nunca romper el chat por el logging del feedback
  }
  return NextResponse.json({ ok: true });
}
