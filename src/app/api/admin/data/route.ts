import { NextResponse } from "next/server";

// GET /api/admin/data?type=profiles | coupons | coupon-history&userId=xxx
// Admin access is gatekept at the /admin page server-component level.
// This route uses the service role key so RLS is bypassed.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userId = searchParams.get("userId");

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing env vars", supabase: !!supabaseUrl, service: !!serviceKey }, { status: 500 });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    if (type === "profiles") {
      const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=*&order=created_at.desc`, { headers });
      if (!res.ok) return NextResponse.json({ error: "Failed to fetch profiles" }, { status: 500 });
      return NextResponse.json({ data: await res.json() });
    }

    if (type === "coupons") {
      const res = await fetch(`${supabaseUrl}/rest/v1/coupons?select=*&order=created_at.desc`, { headers });
      if (!res.ok) return NextResponse.json({ error: "Failed to fetch coupons" }, { status: 500 });
      return NextResponse.json({ data: await res.json() });
    }

    if (type === "coupon-history" && userId) {
      const res = await fetch(`${supabaseUrl}/rest/v1/coupons?select=*&used_by=eq.${userId}&order=used_at.desc`, { headers });
      if (!res.ok) return NextResponse.json({ error: "Failed to fetch coupon history" }, { status: 500 });
      return NextResponse.json({ data: await res.json() });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    console.error("[/api/admin/data GET]", err.message, err.stack);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}

// PATCH /api/admin/data?type=profile
// Update a user's profile
export async function PATCH(request: Request) {
  try {
    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const body = await request.json();
    const { userId, updates } = body;
    if (!userId || !updates) {
      return NextResponse.json({ error: "Missing userId or updates" }, { status: 400 });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    const res = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const headers: Record<string, string> = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    if (type === "coupon" && id) {
      const res = await fetch(`${supabaseUrl}/rest/v1/coupons?id=eq.${id}`, {
        method: "DELETE",
        headers,
      });
      if (!res.ok) return NextResponse.json({ error: "Failed to delete coupon" }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (type === "profile" && id) {
      // 1. Clear coupons first (FK RESTRICT blocks auth user deletion otherwise)
      await fetch(`${supabaseUrl}/rest/v1/coupons?used_by=eq.${id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ used_by: null, used_by_email: null, used_by_name: null, used_at: null }),
      }).catch(() => {});
      // 2. Delete conversations (user_id FK cascades to messages)
      await fetch(`${supabaseUrl}/rest/v1/conversations?user_id=eq.${id}`, {
        method: "DELETE",
        headers,
      }).catch(() => {});
      // 3. Delete auth user — cascades to profile deletion
      const authRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
        method: "DELETE",
        headers,
      });
      if (!authRes.ok) {
        const body = await authRes.text();
        console.error("[admin/data DELETE] Auth delete failed:", authRes.status, body);
        return NextResponse.json({ error: `Auth delete failed: ${authRes.status} ${body}` }, { status: 500 });
      }
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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const body = await request.json();

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    };

    if (type === "generate-coupons") {
      const { codes, config, adminId } = body;
      if (!codes || !Array.isArray(codes) || !config || !adminId) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
      }

      const inserts = codes.map((c: string) => ({
        code: c,
        created_by: adminId,
        ...config,
      }));

      const res = await fetch(`${supabaseUrl}/rest/v1/coupons`, {
        method: "POST",
        headers,
        body: JSON.stringify(inserts),
      });

      if (!res.ok) {
        const text = await res.text();
        return NextResponse.json({ error: `Supabase error: ${res.status} ${text}` }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
