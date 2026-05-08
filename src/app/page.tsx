import { createClient } from "@/lib/supabase/server";

export default function Home() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold" style={{ color: 'var(--accent)' }}>Mente</span>
          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>AI</span>
        </div>
      </header>

      {/* Chat area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Bienvenido a Mente AI
          </h2>
          <p className="text-base mb-2" style={{ color: 'var(--text-secondary)' }}>
            Tu asistente inteligente de chat.
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Inicia sesión para comenzar a chatear.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-3 text-center text-xs" style={{ color: 'var(--text-secondary)' }}>
        © 2025 Mente AI
      </footer>
    </div>
  );
}