import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function base64UrlDecode(str: string): string {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf-8");
}

export async function POST(request: Request) {
  try {
    const { token, email }: { token: string; email?: string } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Try to decode token as JWT to get user ID
    const parts = token.split(".");
    let userId: string | undefined = undefined;

    if (parts.length === 3) {
      try {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        userId = payload.sub;
      } catch { /* not a JWT */ }
    }

    // If no userId from token, search by email
    if (!userId && email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users as any[];
      const match = users.find((u: any) =>
        u.email === email && !u.email_confirmed_at
      );
      if (match) userId = match.id;
    }

    // Last resort: most recent unconfirmed user
    if (!userId) {
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users as any[];
      const unconfirmed = users.filter((u: any) => !u.email_confirmed_at);
      if (unconfirmed.length === 0) {
        return NextResponse.json({ confirmed: true });
      }
      const latest = unconfirmed.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      userId = latest.id;
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId!,
      { email_confirm: true }
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ confirmed: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Error al confirmar el correo." }, { status: 500 });
  }
}