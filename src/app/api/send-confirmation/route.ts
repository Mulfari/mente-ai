import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function POST(request: Request) {
  try {
    const { email, user_id } = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Only admin can send confirmation emails
    if (user.email !== "jscmulfari@gmail.com") {
      return new Response("Forbidden", { status: 403 });
    }

    if (!email || !user_id) {
      return new Response("Missing email or user_id", { status: 400 });
    }

    // Generate email confirmation link via Supabase
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email: email,
      password: "dummy", // required by type but not used for resending
    });

    if (error || !data?.properties?.action_link) {
      return Response.json({ error: error?.message || "Failed to generate link" }, { status: 500 });
    }

    const confirmUrl = data.properties.action_link;

    const resend = getResend();
    const { error: sendError } = await resend.emails.send({
      from: "VeChat <noreply@mulfai.com.ve>",
      to: email,
      subject: "Confirma tu correo - VeChat",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background:#0f0f0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
          <div style="max-width:480px;margin:0 auto;padding:40px 20px">
            <div style="text-align:center;margin-bottom:32px">
              <div style="width:56px;height:56px;background:linear-gradient(135deg,#10A37F,#0d8b6a);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </div>
              <h1 style="color:#f0f0f0;font-size:28px;font-weight:700;margin:0 0 8px">Confirma tu correo</h1>
              <p style="color:#888;font-size:15px;margin:0">Accede a VeChat confirmando tu dirección de correo electrónico.</p>
            </div>
            <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:16px;padding:32px;text-align:center">
              <a href="${confirmUrl}" style="display:inline-block;background:linear-gradient(135deg,#10A37F,#0d8b6a);color:white;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:12px">
                Confirmar correo
              </a>
              <p style="color:#666;font-size:13px;margin:24px 0 0">Este enlace expira en 1 hora.</p>
            </div>
            <p style="color:#555;font-size:13px;text-align:center;margin:32px 0 0">Si no solicitaste este correo, ignóralo.</p>
          </div>
        </body>
        </html>
      `,
    });

    if (sendError) {
      return Response.json({ error: sendError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}