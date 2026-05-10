import { Resend } from "resend";
import { NextResponse } from "next/server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Correo requerido" }, { status: 400 });
    }

    // Generate reset link via admin API
    const { createClient } = await import("@supabase/supabase-js");
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });

    if (linkError || !linkData?.properties?.action_link) {
      // Don't reveal if email exists or not - always return success
      return NextResponse.json({ success: true });
    }

    // Extract token from Supabase URL
    const supabaseUrl = linkData.properties.action_link;
    const urlObj = new URL(supabaseUrl);
    const token = urlObj.searchParams.get("token");
    const confirmUrl = `https://mulfai.com.ve/reset-password?token=${token}&email=${encodeURIComponent(email)}&type=recovery`;

    // Send branded email via Resend
    const { error: sendError } = await getResend().emails.send({
      from: "Mulfai <noreply@mulfai.com.ve>",
      to: email,
      subject: "Restablece tu contraseña — Mulfai",
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
      <p style="color:#888;font-size:16px;margin:0">Restablecer contraseña</p>
    </div>
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:20px;padding:36px;text-align:center">
      <p style="color:#e0e0e0;font-size:16px;margin:0 0 28px;line-height:1.6">
        Recibimos una solicitud para restablecer tu contraseña. Haz click en el siguiente botón para crear una nueva contraseña.
      </p>
      <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#10A37F,#0d8b6a);color:white;text-decoration:none;font-size:16px;font-weight:600;padding:16px 36px;border-radius:14px;box-shadow:0 4px 16px rgba(16,163,127,0.35)">
        Restablecer contraseña
      </a>
      <p style="color:#555;font-size:13px;margin:28px 0 0">Este enlace expira en 1 hora.</p>
    </div>
    <p style="color:#444;font-size:13px;text-align:center;margin:32px 0 0">
      Si no solicitaste este cambio, puedes ignorar este mensaje.
    </p>
  </div>
</body>
</html>
      `,
    });

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Error. Por favor intente nuevamente." }, { status: 500 });
  }
}