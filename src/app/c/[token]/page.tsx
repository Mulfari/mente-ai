import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SharedConversation from "@/components/share/SharedConversation";

// Página PÚBLICA de una conversación compartida (solo lectura, sin cuenta).
// Lee la "foto fija" por token con el service role. Marca VeChat + CTA de
// registro = embudo de crecimiento. Ruta pública (no está en el middleware).
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

type Share = { title: string; messages: { role: string; content: string }[] };

async function getShare(token: string): Promise<Share | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("shared_conversations")
    .select("title, messages")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;
  return { title: data.title as string, messages: (data.messages as Share["messages"]) ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = await getShare(token);
  if (!share) return { title: "Enlace no disponible — VeChat" };
  const firstUser = share.messages.find((m) => m.role === "user")?.content?.slice(0, 150) ?? "";
  const description = firstUser || "Una conversación compartida desde VeChat, la IA que sí sabe de Venezuela.";
  const title = `${share.title} — VeChat`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: "VeChat" },
    twitter: { card: "summary", title, description },
  };
}

function Brand() {
  return (
    <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--primary)" }}>
        <path d="M4 5l8 14L20 5" />
      </svg>
      VeChat
    </span>
  );
}

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const share = await getShare(token);

  if (!share) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: "var(--background)" }}>
        <Brand />
        <p className="text-lg font-semibold mt-6" style={{ color: "var(--text-primary)" }}>Este enlace ya no está disponible</p>
        <p className="text-sm mt-1.5 mb-6" style={{ color: "var(--text-secondary)" }}>
          Puede que quien lo compartió lo haya desactivado.
        </p>
        <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
          Ir a VeChat
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "var(--background)" }}>
      {/* Header: marca + CTA */}
      <header className="sticky top-0 z-10 h-14 flex items-center justify-between px-5 sm:px-7"
        style={{ backgroundColor: "color-mix(in srgb, var(--background) 92%, transparent)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)" }}>
        <Link href="/"><Brand /></Link>
        <Link href="/sign-up" className="text-[13px] font-medium text-white px-4 py-2 rounded-full transition-opacity hover:opacity-90" style={{ backgroundColor: "var(--primary)" }}>
          Pruébalo gratis
        </Link>
      </header>

      <main className="flex-1">
        <SharedConversation title={share.title} messages={share.messages} />
      </main>

      {/* Footer CTA — embudo de registro */}
      <footer className="px-4 py-10 text-center" style={{ borderTop: "1px solid var(--border)" }}>
        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
          Esta conversación se creó con VeChat.
        </p>
        <p className="text-[13px] mb-5" style={{ color: "var(--text-tertiary)" }}>
          La IA que sí sabe de Venezuela — gratis para empezar.
        </p>
        <Link href="/" className="inline-block px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}>
          Empieza tu propia conversación →
        </Link>
      </footer>
    </div>
  );
}
