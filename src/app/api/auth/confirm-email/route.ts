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

    // Use the database function to confirm email AND activate profile in one step
    const { error: rpcError } = await adminClient.rpc("confirm_email_and_activate", {
      p_email: email || "",
    });

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    return NextResponse.json({ confirmed: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}