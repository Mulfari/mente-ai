import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!userId || !password || !confirmPassword) {
      return NextResponse.redirect(new URL("/?reset=error", request.url));
    }

    if (password !== confirmPassword) {
      return NextResponse.redirect(new URL("/?reset=missmatch", request.url));
    }

    if (password.length < 6) {
      return NextResponse.redirect(new URL("/?reset=short", request.url));
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.redirect(new URL("/?reset=error", request.url));
    }

    return NextResponse.redirect(new URL("/?reset=success", request.url));
  } catch {
    return NextResponse.redirect(new URL("/?reset=error", request.url));
  }
}