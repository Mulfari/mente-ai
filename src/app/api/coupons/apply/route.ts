import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code?.trim()) {
      return NextResponse.json({ error: "Código requerido." }, { status: 400 });
    }

    const supabase = await createClient();

    // Buscar cupón
    const { data: coupon } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (!coupon) {
      return NextResponse.json({ error: "Código de cupón inválido." }, { status: 404 });
    }

    if (coupon.used_by) {
      return NextResponse.json({ error: "Este cupón ya ha sido utilizado." }, { status: 400 });
    }

    // Obtener perfil actual (usando clerk_user_id)
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, email, subscription_weeks, subscription_end, status")
      .eq("clerk_user_id", userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    }

    // Calcular nuevas semanas
    let newWeeks = profile.subscription_weeks ?? 0;
    let newStatus = profile.status ?? "inactive";
    let label = coupon.label ?? "Suscripción";
    let color = coupon.color ?? "#10A37F";
    let subscriptionEnd: string | null = null;
    const prevEnd = profile.subscription_end;

    if (coupon.is_unlimited) {
      newWeeks = -1; // -1 = ilimitado
      label = coupon.label ?? "Acceso ilimitado";
      subscriptionEnd = null;
    } else {
      const days = coupon.duration_days ?? 7;
      const weeksToAdd = Math.ceil(days / 7);
      newWeeks = newWeeks <= 0 ? weeksToAdd : newWeeks + weeksToAdd;

      // Sumar sobre el tiempo restante, no desde ahora
      const baseTime = prevEnd ? new Date(prevEnd).getTime() : Date.now();
      subscriptionEnd = new Date(baseTime + days * 24 * 60 * 60 * 1000).toISOString();
    }

    // Si estaba inactivo, activar
    if (newStatus === "inactive" && newWeeks > 0) {
      newStatus = "active";
    }

    // Actualizar perfil
    await supabase.from("profiles").update({
      subscription_weeks: newWeeks,
      subscription_end: subscriptionEnd,
      status: newStatus,
      used_coupon_label: label,
      used_coupon_color: color,
    }).eq("id", profile.id);

    // Marcar cupón como usado
    await supabase.from("coupons").update({
      used_by: profile.id,
      used_by_email: profile.email,
      used_by_name: profile.email,
      used_at: new Date().toISOString(),
    }).eq("id", coupon.id);

    return NextResponse.json({
      success: true,
      weeks: newWeeks,
      weeks_added: coupon.is_unlimited ? null : (coupon.duration_days ?? 7),
      subscription_end: subscriptionEnd,
      label,
      color,
    });

  } catch {
    return NextResponse.json({ error: "Error. Por favor intente nuevamente." }, { status: 500 });
  }
}
