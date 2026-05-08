import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 shrink-0 border-b"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold" style={{ color: "var(--accent)" }}>Mente</span>
          <span className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>AI</span>
        </div>
      </header>

      {/* Welcome */}
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-2xl text-center space-y-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M8.58 4.75C9.24 3.47 10.72 2.5 12.5 2.5c1.78 0 3.26.97 3.92 2.25M16.5 8c-2.17 0-4.23.75-5.77 2.13M15.5 16c0 5.25-4.5 9-9.5 9C6.5 25 2 21.25 2 16c0-2.5 1-4.77 2.63-6.33M14.5 12c1.88 0 3.41.97 4.27 2.44" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
              Mente<span style={{ color: "var(--accent)" }}>AI</span>
            </h1>
          </div>

          <p className="text-lg font-medium" style={{ color: "var(--text-primary)" }}>
            Tu asistente inteligente de chat
          </p>

          <p className="text-base max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            Inicia sesión para comenzar a conversar con Mente AI
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-10 max-w-xl mx-auto">
            {[
              { icon: "💬", text: "Conversaciones inteligentes" },
              { icon: "⚡", text: "Respuestas instantáneas" },
              { icon: "🔒", text: "Privacidad garantizada" },
            ].map((f) => (
              <div key={f.text}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>
                <span>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="py-3 text-center text-xs shrink-0" style={{ color: "var(--text-secondary)" }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}