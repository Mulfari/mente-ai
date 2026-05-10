import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function decodeJwtWithoutVerification(token: string): any {
  try {
    // JWT has 3 parts: header.payload.signature
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const { token, email } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const adminClient = getAdminClient();

    // Try to decode the token as JWT to get user ID
    const payload = decodeJwtWithoutVerification(token);
    let userId = payload?.sub as string | undefined;
    let user: any = undefined;

    // Find the user to confirm
    if (userId) {
      // Verify user exists
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ error: "Error al verificar el correo." }, { status: 500 });
      }
      const users = (usersData as any).users;
      user = users.find((u: any) => u.id === userId);
    }

    // Fallback: find by email if no user ID in token
    if (!user && email) {
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users;
      user = users.find((u: any) => u.email === email && !u.email_confirmed_at);
    }

    // Last fallback: find most recent unconfirmed user
    if (!user) {
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const users = (usersData as any).users;
      const unconfirmed = users.filter((u: any) => !u.email_confirmed_at);
      if (unconfirmed.length > 0) {
        // Pick the most recent one
        user = unconfirmed.sort((a: any, b: any) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0];
      }
    }

    if (!user) {
      return NextResponse.json({ error: "No se encontró un usuario pendiente por confirmar." }, { status: 404 });
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ confirmed: true, already_confirmed: true });
    }

    // Confirm the user
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
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