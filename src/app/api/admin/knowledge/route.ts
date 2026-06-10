import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("role, id").eq("clerk_user_id", userId).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const internalUserId = profile.id;

  const { id, status, ...rest } = await req.json();

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

  try {
    if (id && status) {
      const updates: Record<string, any> = { status, updated_at: new Date().toISOString() };
      const res = await fetch(`${supabaseUrl}/rest/v1/knowledge?id=eq.${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updates),
      });
      if (!res.ok) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
      return NextResponse.json({ success: true });
    }

    if (!id && rest.query) {
      const res = await fetch(`${supabaseUrl}/rest/v1/knowledge`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ ...rest, status: rest.status || "pending", created_by: internalUserId }),
      });
      if (!res.ok) return NextResponse.json({ error: "Failed to create" }, { status: 500 });
      return NextResponse.json({ success: true, data: await res.json() });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = await createClient();

  const { data: profile } = await supabase.from("profiles").select("role").eq("clerk_user_id", userId).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  const res = await fetch(`${supabaseUrl}/rest/v1/knowledge?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  if (!res.ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  return NextResponse.json({ success: true });
}
