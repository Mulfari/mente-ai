import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const token = params.token as string | undefined;
  const type = params.type as string | undefined;
  const supabase = await createClient();

  // If there's a recovery token, set it to establish the session
  let sessionEstablished = false;
  if (token && type === "recovery") {
    const { data, error } = await supabase.auth.verifyOtp({
      type: "recovery",
      email: "", // token contains the email
      token,
    }).catch(() => ({ data: null, error: true }));
    if (!error && data?.session) {
      sessionEstablished = true;
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            <span style={{ color: "var(--primary)" }}>M</span>ulfai
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Restablecer contraseña</p>
        </div>

        {(!sessionEstablished && !user) ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>
              <svg className="w-6 h-6" fill="none" stroke="var(--danger)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              El enlace de recuperación ha expirado o es inválido.
            </p>
            <a href="/" className="text-xs transition-colors hover:underline" style={{ color: "var(--primary)" }}>
              Volver al inicio
            </a>
          </div>
        ) : (
          <form action="/api/auth/reset-password/confirm" method="POST">
            <input type="hidden" name="token" value={token || ""} />
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Nueva contraseña
                </label>
                <input type="password" name="password" required minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Confirmar contraseña
                </label>
                <input type="password" name="confirmPassword" required minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)", color: "var(--text-primary)" }} />
              </div>
              <button type="submit"
                className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all"
                style={{ backgroundColor: "var(--primary)", color: "white", boxShadow: "0 4px 14px rgba(16,163,127,0.4)" }}>
                Guardar nueva contraseña
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6">
          <a href="/chat" className="text-xs transition-colors hover:underline" style={{ color: "var(--primary)" }}>
            Volver al chat
          </a>
        </div>
      </div>
    </main>
  );
}