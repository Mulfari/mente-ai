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
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    // Decode the JWT to get the user ID from the token
    const payload = decodeJwtWithoutVerification(token);
    if (!payload || !payload.sub) {
      return NextResponse.json({ error: "Token inválido" }, { status: 400 });
    }

    const userId = payload.sub;

    // Verify this user exists and is not already confirmed
    const adminClient = getAdminClient();
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
      // Already confirmed
      return NextResponse.json({ confirmed: true, already_confirmed: true });
    }

    // Confirm the user
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