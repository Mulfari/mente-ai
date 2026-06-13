import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getProfileByClerkId } from "@/lib/profile";
import { materializeInterests, normalizeKey } from "@/lib/feed";

// Chips de interés de "Mi contexto": manuales (los que el usuario agrega) +
// aprendidos (de sus búsquedas, ver /api/track-query). Una sola lista; los
// aprendidos llevan source='learned', los manuales 'manual' (y pinned).
//
// Auth Clerk → resuelve profiles.id; escribe con service role (la tabla tiene
// RLS ON sin policies, igual que el resto de tablas del feed).

type Chip = { tag: string; label: string; source: string; pinned: boolean };

async function resolveUserId(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const profile = await getProfileByClerkId(userId);
  return profile?.id ?? null;
}

export async function GET() {
  const internalUserId = await resolveUserId();
  if (!internalUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient();

  let { data } = await supabase
    .from("user_interests")
    .select("tag, label, source, pinned")
    .eq("user_id", internalUserId)
    .order("pinned", { ascending: false })
    .order("weight", { ascending: false })
    .limit(30);

  // Backfill perezoso: si nunca tuvo chips pero hay texto viejo en el contexto
  // (campos 'interests'/'custom_notes' antiguos), sembrarlos como manuales.
  if (!data || data.length === 0) {
    const { data: ctx } = await supabase
      .from("user_context")
      .select("interests, custom_notes")
      .eq("user_id", internalUserId)
      .maybeSingle();
    const raw = [ctx?.interests, ctx?.custom_notes].filter(Boolean).join(", ");
    const seeds = raw
      .split(/[,\n;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2 && s.length <= 40);
    const seen = new Set<string>();
    const rows = seeds
      .map((label) => ({ tag: normalizeKey(label), label }))
      .filter((r) => r.tag && !seen.has(r.tag) && (seen.add(r.tag), true))
      .slice(0, 20)
      .map((r) => ({ user_id: internalUserId, tag: r.tag, label: r.label, source: "manual", pinned: true, weight: 1 }));
    if (rows.length > 0) {
      await supabase.from("user_interests").upsert(rows, { onConflict: "user_id,tag", ignoreDuplicates: true });
      const res = await supabase
        .from("user_interests")
        .select("tag, label, source, pinned")
        .eq("user_id", internalUserId)
        .order("pinned", { ascending: false })
        .order("weight", { ascending: false })
        .limit(30);
      data = res.data;
    }
  }

  return NextResponse.json({ chips: (data ?? []) as Chip[] });
}

export async function POST(req: NextRequest) {
  const internalUserId = await resolveUserId();
  if (!internalUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createClient();

  const body = (await req.json().catch(() => null)) as
    | { action: "add" | "remove" | "pin" | "unpin"; label?: string; tag?: string }
    | null;
  if (!body?.action) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  if (body.action === "add") {
    const label = (body.label ?? "").trim().slice(0, 40);
    const tag = normalizeKey(label);
    if (!tag || label.length < 2) return NextResponse.json({ error: "Etiqueta inválida" }, { status: 400 });
    const { error } = await supabase.from("user_interests").upsert(
      { user_id: internalUserId, tag, label, source: "manual", pinned: true, weight: 1, updated_at: new Date().toISOString() },
      { onConflict: "user_id,tag" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const tag = (body.tag ?? "").trim();
    if (!tag) return NextResponse.json({ error: "Falta tag" }, { status: 400 });
    if (body.action === "remove") {
      await supabase.from("user_interests").delete().eq("user_id", internalUserId).eq("tag", tag);
    } else {
      await supabase
        .from("user_interests")
        .update({ pinned: body.action === "pin", updated_at: new Date().toISOString() })
        .eq("user_id", internalUserId)
        .eq("tag", tag);
    }
  }

  const interests = await materializeInterests(supabase, internalUserId);
  return NextResponse.json({ success: true, interests });
}
