import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Query auth.users via the Supabase REST API directly (PostgREST)
    const res = await fetch(`${supabaseUrl}/rest/v1/auth.users?select=id,email,created_at&order=created_at.desc`, {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Supabase API error: ${res.status} ${text}` }, { status: 500 });
    }

    const users = await res.json();
    return NextResponse.json({ users: Array.isArray(users) ? users : [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}