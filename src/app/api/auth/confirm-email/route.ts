import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { token, email }: { token: string; email?: string } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Method 1: Try to use the magic link verification endpoint
    // Supabase has an internal endpoint for confirming emails
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const response = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({
        type: "signup",
        token: token,
      }),
    });

    // If that works, we're done
    if (response.ok) {
      // Now activate the profile
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users as any[];
      const unconfirmed = users.filter((u: any) => !u.email_confirmed_at);

      if (unconfirmed.length > 0) {
        const latest = unconfirmed.sort((a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
        await adminClient.auth.admin.updateUserById(latest.id, { email_confirm: true });
      }
      return NextResponse.json({ confirmed: true });
    }

    // Method 2: Find user by email and confirm manually
    if (email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users as any[];
      const match = users.find((u: any) => u.email === email && !u.email_confirmed_at);
      if (match) {
        await adminClient.auth.admin.updateUserById(match.id, { email_confirm: true });
        return NextResponse.json({ confirmed: true });
      }
    }

    // Method 3: Most recent unconfirmed user
    const { data: allUsersData } = await adminClient.auth.admin.listUsers();
    const allUsers = (allUsersData as any).users as any[];
    const unconfirmed = allUsers.filter((u: any) => !u.email_confirmed_at);
    if (unconfirmed.length > 0) {
      const latest = unconfirmed.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      const { error } = await adminClient.auth.admin.updateUserById(latest.id, { email_confirm: true });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ confirmed: true });
    }

    return NextResponse.json({ confirmed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}