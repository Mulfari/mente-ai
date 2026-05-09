import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const code = params.code as string | undefined;
  const type = params.type as string | undefined;
  const supabase = await createClient();

  let confirmed = false;
  let error = "";

  if (code && type === "signup" || type === "email_change") {
    const { error: confirmError } = await supabase.auth.verifyOtp({
      type: "email",
      email: "",
      token: code,
    } as any);
    // Try to get user from session
    const { data: { user } } = await supabase.auth.getUser();
    confirmed = !!user;
    if (confirmError) error = confirmError.message;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-sm rounded-2xl p-8 shadow-2xl text-center animate-fade-in"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
        {/* Logo */}
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
          style={{ background: "linear-gradient(135deg, var(--primary), #0d8b6a)" }}>
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          <span style={{ color: "var(--primary)" }}>M</span>ulfai
        </h1>

        {code ? (
          <>
            {confirmed || type === "recovery" ? (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 mt-4"
                  style={{ backgroundColor: "rgba(16,163,127,0.15)" }}>
                  <svg className="w-6 h-6" fill="none" stroke="var(--primary)" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>¡Email confirmado!</h2>
                <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
                  Tu correo ha sido confirmado exitosamente.
                </p>
                <Link href="/chat"
                  className="inline-block px-6 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={{ backgroundColor: "var(--primary)", color: "white" }}>
                  Ir al chat
                </Link>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 mt-4"
                  style={{ backgroundColor: "rgba(16,163,127,0.15)" }}>
                  <svg className="w-6 h-6" fill="none" stroke="var(--primary)" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Revisa tu correo</h2>
                <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                  Te hemos enviado un enlace de confirmación. Haz click en el enlace para activar tu cuenta.
                </p>
                {error && (
                  <div className="px-4 py-3 rounded-xl mb-4"
                    style={{ backgroundColor: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    <span className="text-xs" style={{ color: "var(--danger)" }}>{error}</span>
                  </div>
                )}
                <Link href="/"
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "var(--primary)" }}>
                  Volver al inicio
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 mt-4"
              style={{ backgroundColor: "rgba(16,163,127,0.15)" }}>
              <svg className="w-6 h-6" fill="none" stroke="var(--primary)" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>Revisa tu correo</h2>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
              Te hemos enviado un enlace de confirmación. Revisa tu bandeja de entrada y haz click en el enlace.
            </p>
            <Link href="/"
              className="text-xs transition-colors hover:underline"
              style={{ color: "var(--primary)" }}>
              Volver al inicio
            </Link>
          </>
        )}
      </div>
    </main>
  );
}