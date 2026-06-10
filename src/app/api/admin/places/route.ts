import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !supabaseUrl) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    if (type === "cities") {
      const res = await fetch(`${supabaseUrl}/rest/v1/cities?select=*&order=name.asc`, { headers });
      return NextResponse.json({ data: await res.json() });
    }

    if (type === "categories") {
      const res = await fetch(`${supabaseUrl}/rest/v1/categories?select=*&active=eq.true&order=sort_order.asc`, { headers });
      return NextResponse.json({ data: await res.json() });
    }

    if (type === "places") {
      const city = searchParams.get("city");
      const category = searchParams.get("category");
      const featured = searchParams.get("featured");
      let url = `${supabaseUrl}/rest/v1/places?select=*,cities(name,slug),categories(name,slug,icon,color)&active=eq.true&order=rating.desc`;
      if (city) url += `&city_id=eq.${city}`;
      if (category) url += `&category_id=eq.${category}`;
      if (featured === "true") url += `&featured=eq.true`;
      const res = await fetch(url, { headers });
      return NextResponse.json({ data: await res.json() });
    }

    if (type === "knowledge-rules") {
      const res = await fetch(`${supabaseUrl}/rest/v1/knowledge_rules?select=*&active=eq.true&order=priority.desc`, { headers });
      return NextResponse.json({ data: await res.json() });
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = await createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("clerk_user_id", userId)
      .single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { type, data: row } = body;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };

    const tableMap: Record<string, string> = {
      place: "places",
      city: "cities",
      category: "categories",
      "knowledge-rule": "knowledge_rules",
      submission: "place_submissions",
    };

    const table = tableMap[type];
    if (!table || !row) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Generate slug if not provided
    if (row.name && !row.slug) {
      row.slug = row.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    }
    if (row.id) {
      row.updated_at = new Date().toISOString();
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: row.id ? "PATCH" : "POST",
      headers,
      body: JSON.stringify(row),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase: ${res.status} ${text}` }, { status: 500 });
    }

    return NextResponse.json({ data: await res.json() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = await createClient();

    const { data: profile } = await supabase.from("profiles").select("role").eq("clerk_user_id", userId).single();
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const id = searchParams.get("id");

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

    const tableMap: Record<string, string> = {
      place: "places",
      city: "cities",
      category: "categories",
      "knowledge-rule": "knowledge_rules",
      submission: "place_submissions",
      "feedback": "recommendation_feedback",
    };

    const table = tableMap[type || ""];
    if (!table || !id) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!res.ok) return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
