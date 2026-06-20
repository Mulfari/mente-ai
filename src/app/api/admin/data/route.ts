import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { activatePlan } from "@/lib/activatePlan";
import { getStats } from "@/lib/adminStats";

// Claves de app_config que el admin puede editar (whitelist anti-basura).
const CONFIG_KEYS = [
  "free_daily_limit", "price_weekly_usd", "price_monthly_usd",
  "plan_weekly_days", "plan_monthly_days", "whatsapp_number",
];

// GET /api/admin/data?type=profiles | coupons | coupon-history&userId=xxx
// Every handler is gatekept here with Clerk: only profiles.role === "admin".
// Uses the service role key so RLS (disabled project-wide) never interferes.

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("clerk_user_id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "admin") return null;
  return profile;
}

export async function GET(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");

    const supabase = createClient();

    if (type === "profiles") {
      // profiles.email is populated by the Clerk webhook — no auth lookup needed
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (type === "coupons") {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (type === "coupon-history" && userId) {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("used_by", userId)
        .order("used_at", { ascending: false });
      if (error) return NextResponse.json({ error: "Failed to fetch coupon history" }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (type === "config") {
      const { data, error } = await supabase.from("app_config").select("key, value");
      if (error) return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (type === "stats") {
      const stats = await getStats(supabase);
      return NextResponse.json({ data: stats });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/admin/data GET]", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// PATCH /api/admin/data — update a user's profile
export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const body = await request.json();
    const { userId, updates } = body;
    if (!userId || !updates) {
      return NextResponse.json({ error: "Missing userId or updates" }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
    if (error) {
      return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/admin/data?type=coupon&id=xxx
// DELETE /api/admin/data?type=profile&id=xxx
export async function DELETE(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    const supabase = createClient();

    if (type === "coupon" && id) {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (type === "profile" && id) {
      // Look up the profile to get its Clerk user id before removing anything
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, clerk_user_id")
        .eq("id", id)
        .maybeSingle();
      if (!profile) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });

      // 1. Release coupons referencing this profile (FK would block otherwise)
      await supabase
        .from("coupons")
        .update({ used_by: null, used_by_email: null, used_by_name: null, used_at: null })
        .eq("used_by", id);

      // 2. Delete conversations (FK cascades to messages)
      await supabase.from("conversations").delete().eq("user_id", id);

      // 3. Delete user context
      await supabase.from("user_context").delete().eq("user_id", id);

      // 4. Delete the Clerk user (auth account). The user.deleted webhook may
      //    fire afterwards; its soft-delete update finds no row, which is fine.
      if (profile.clerk_user_id && !profile.clerk_user_id.startsWith("legacy_")) {
        try {
          const client = await clerkClient();
          await client.users.deleteUser(profile.clerk_user_id);
        } catch (err: any) {
          // 404 = already gone in Clerk; anything else should surface
          if (err?.status !== 404) {
            console.error("[admin/data DELETE] Clerk delete failed:", err?.message ?? err);
            return NextResponse.json({ error: "No se pudo eliminar la cuenta en Clerk" }, { status: 500 });
          }
        }
      }

      // 5. Delete the profile row itself
      const { error } = await supabase.from("profiles").delete().eq("id", id);
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/data?type=generate-coupons
export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const body = await request.json();

    if (type === "generate-coupons") {
      const { codes, config } = body;
      if (!codes || !Array.isArray(codes) || !config) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      const inserts = codes.map((c: string) => ({
        code: c,
        created_by: admin.id,
        ...config,
      }));

      const supabase = createClient();
      const { error } = await supabase.from("coupons").insert(inserts);
      if (error) {
        return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Activación centralizada de un plan nominal (semanal/mensual) para un
    // usuario. Único punto que escribe la vigencia vía activatePlan; mañana
    // la pasarela llamará la misma función.
    if (type === "activate-plan") {
      const { userId, plan } = body;
      if (!userId || (plan !== "weekly" && plan !== "monthly")) {
        return NextResponse.json({ error: "userId y plan (weekly|monthly) requeridos" }, { status: 400 });
      }
      const supabase = createClient();
      const { subscriptionEnd } = await activatePlan(supabase, userId, plan, new Date());
      return NextResponse.json({ success: true, subscriptionEnd });
    }

    // Editar app_config (precios, límite diario, días, WhatsApp).
    if (type === "config") {
      const { updates } = body;
      if (!updates || typeof updates !== "object") {
        return NextResponse.json({ error: "updates requerido" }, { status: 400 });
      }
      const supabase = createClient();
      for (const [key, value] of Object.entries(updates)) {
        if (!CONFIG_KEYS.includes(key)) continue;
        await supabase.from("app_config")
          .update({ value: String(value), updated_at: new Date().toISOString() })
          .eq("key", key);
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
