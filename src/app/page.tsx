import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: "var(--background)" }}>
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-4 shrink-0"
        style={{ backgroundColor: "var(--surface)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: "var(--primary)" }}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Mente AI</span>
        </div>
        <a href="#login" className="text-sm px-4 py-1.5 rounded-md font-medium transition-colors"
          style={{ backgroundColor: "var(--primary)", color: "white" }}>
          Iniciar sesión
        </a>
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 -mt-14">
        <div className="text-center max-w-lg animate-fade-in">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ backgroundColor: "var(--surface)" }}>
            <svg className="w-9 h-9" style={{ color: "var(--primary)" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.58 4.75C9.24 3.47 10.72 2.5 12.5 2.5c1.78 0 3.26.97 3.92 2.25M16.5 8c-2.17 0-4.23.75-5.77 2.13M15.5 16c0 5.25-4.5 9-9.5 9C6.5 25 2 21.25 2 16c0-2.5 1-4.77 2.63-6.33M14.5 12c1.88 0 3.41.97 4.27 2.44" />
            </svg>
          </div>

          <h1 className="text-4xl font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
            Mente AI
          </h1>
          <p className="text-lg mb-2" style={{ color: "var(--text-secondary)" }}>
            Conversa con inteligencia artificial avanzada.
          </p>
          <p className="text-base mb-8" style={{ color: "var(--text-tertiary)" }}>
            Inicia sesión para comenzar.
          </p>

          <a href="#login" className="inline-flex items-center gap-2 text-base px-6 py-3 rounded-xl font-medium transition-colors"
            style={{ backgroundColor: "var(--primary)", color: "white" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Comenzar ahora
          </a>
        </div>
      </div>

      <footer className="py-4 text-center text-xs shrink-0" style={{ color: "var(--text-tertiary)" }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}