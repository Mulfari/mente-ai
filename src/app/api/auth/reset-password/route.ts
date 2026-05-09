import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email requerido" }, { status: 400 });
    }

    const supabase = await createClient();

    // Always return success to prevent email enumeration
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "https://mulfai.com.ve"}/reset-password`,
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error. Por favor intente nuevamente." }, { status: 500 });
  }
}