import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email?.trim() || !password?.trim()) {
      return NextResponse.json({ error: "Email y contraseña son requeridos." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }

    const supabase = await createClient();
    const adminClient = getAdminClient();

    // Register user via admin (to skip email confirmation suppression if needed)
    const { data: signUpData, error: signUpError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { registered_via: "web" },
    });

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already")) {
        return NextResponse.json({ error: "Este correo ya está registrado." }, { status: 409 });
      }
      return NextResponse.json({ error: signUpError.message }, { status: 400 });
    }

    // Create pending profile
    if (signUpData.user?.id) {
      await supabase.from("profiles").upsert({
        id: signUpData.user.id,
        status: "pending",
        subscription_weeks: 0,
        weekly_limit: 0,
      });
    }

    // Generate confirmation link via admin API
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "signup",
      email,
    });

    if (linkError || !linkData?.properties?.href) {
      return NextResponse.json({ error: linkError?.message || "Error al generar enlace." }, { status: 500 });
    }

    // Replace localhost in the link with our domain
    const confirmUrl = linkData.properties.href.replace(
      /https?:\/\/[^/]+\//,
      "https://mulfai.com.ve/"
    );

    // Send branded email via Resend
    const { error: sendError } = await resend.emails.send({
      from: "Mulfai <noreply@mulfai.com.ve>",
      to: email,
      subject: "Confirma tu correo — Mulfai",
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="max-width:480px;margin:0 auto;padding:48px 24px">
    <div style="text-align:center;margin-bottom:36px">
      <div style="width:56px;height:56px;background:linear-gradient(135deg,#10A37F,#0d8b6a);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:20px">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
        </svg>
      </div>
      <h1 style="color:#f0f0f0;font-size:28px;font-weight:700;margin:0 0 10px"><span style="color:#10A37F">M</span>ulfai</h1>
      <p style="color:#888;font-size:16px;margin:0">Bienvenido a la comunidad Mulfai</p>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:36px;text-align:center">
      <p style="color:#e0e0e0;font-size:16px;margin:0 0 28px;line-height:1.6">
        Solo falta un paso. Confirma tu correo electrónico para activar tu cuenta y empezar a chatear con la inteligencia artificial.
      </p>
      <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#10A37F,#0d8b6a);color:white;text-decoration:none;font-size:16px;font-weight:600;padding:16px 36px;border-radius:14px;box-shadow:0 4px 16px rgba(16,163,127,0.35)">
        Confirmar mi correo
      </a>
      <p style="color:#555;font-size:13px;margin:28px 0 0">Este enlace expira en 1 hora.</p>
    </div>
    <p style="color:#444;font-size:13px;text-align:center;margin:32px 0 0">
      Si no creaste esta cuenta, puedes ignorar este mensaje.
    </p>
  </div>
</body>
</html>
      `,
    });

    if (sendError) {
      return NextResponse.json({ error: "Error al enviar el correo de confirmación." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Error. Por favor intente nuevamente." }, { status: 500 });
  }
}