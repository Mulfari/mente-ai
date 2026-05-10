import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { token, type } = await request.json();

    if (!token) {
      return NextResponse.json({ error: "Token requerido" }, { status: 400 });
    }

    const supabase = await createClient();

    // Use verifyOtp to validate the token
    const { data, error } = await supabase.auth.verifyOtp({
      type: type === "recovery" ? "recovery" : "email",
      email: "",
      token,
    } as any);

    if (error) {
      return NextResponse.json({ error: error.message, confirmed: false }, { status: 400 });
    }

    return NextResponse.json({ confirmed: true, user: data.user });
  } catch (err: any) {
    return NextResponse.json({ error: "Error al confirmar el correo." }, { status: 500 });
  }
}