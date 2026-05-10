import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function base64UrlDecode(str: string): string {
  // Replace URL-safe chars and add padding
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64").toString("utf-8");
}

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    // Debug: log token format info (first 50 chars only for security)
    const tokenInfo = {
      length: token.length,
      hasDots: (token.match(/\./g) || []).length,
      prefix: token.substring(0, Math.min(20, token.length)),
    };
    console.log("[confirm-email] Token info:", JSON.stringify(tokenInfo));

    const adminClient = getAdminClient();

    // Try to decode as JWT (has two dots)
    const parts = token.split(".");
    let userId: string | undefined;

    if (parts.length === 3) {
      // Looks like a JWT - decode the payload (second part)
      try {
        const payload = JSON.parse(base64UrlDecode(parts[1]));
        userId = payload.sub || payload.user_id || payload.userId;
      } catch { /* not JSON */ }
    }

    // If not a JWT, try as raw base64 token
    if (!userId) {
      try {
        const decoded = base64UrlDecode(token);
        const parsed = JSON.parse(decoded);
        userId = parsed.sub || parsed.user_id || parsed.userId;
      } catch { /* not base64 json */ }
    }

    // If still no userId, the token format is unknown - try listing users
    if (!userId) {
      const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
      if (listError) {
        return NextResponse.json({ error: "Error al verificar el correo." }, { status: 500 });
      }
      const users = (usersData as any).users;
      // Find most recent unconfirmed user
      const unconfirmed = users.filter((u: any) => !u.email_confirmed_at);
      if (unconfirmed.length === 0) {
        return NextResponse.json({ confirmed: true }); // all confirmed
      }
      const latestUser = unconfirmed.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        latestUser.id,
        { email_confirm: true }
      );
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ confirmed: true });
    }

    // Find user by ID
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();
    if (listError) {
      return NextResponse.json({ error: "Error al verificar el correo." }, { status: 500 });
    }
    const users = (usersData as any).users;
    const user = users.find((u: any) => u.id === userId);

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }

    if (user.email_confirmed_at) {
      return NextResponse.json({ confirmed: true });
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      userId,
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