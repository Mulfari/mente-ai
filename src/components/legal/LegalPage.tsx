import type { ReactNode } from "react";
import Logo from "@/components/Logo";

// Marco compartido de las páginas legales (/terminos, /privacidad). Tema cálido
// de VeChat (claro/oscuro vía tokens). Contenedor de scroll PROPIO porque el
// body global está bloqueado (igual que la landing y /c/[token]).
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="h-[100dvh] overflow-y-auto" style={{ background: "var(--background)", color: "var(--text-primary)" }}>
      <style>{`
        .legal h2 { font-family: 'Bricolage Grotesque', var(--font-inter), system-ui, sans-serif; font-size: 18px; font-weight: 600; color: var(--text-primary); margin: 30px 0 10px; }
        .legal p, .legal li { font-size: 14.5px; line-height: 1.7; color: var(--text-secondary); }
        .legal p { margin: 0 0 12px; }
        .legal ul { margin: 0 0 14px; padding-left: 20px; display: flex; flex-direction: column; gap: 7px; }
        .legal a { color: var(--primary); text-decoration: underline; text-underline-offset: 2px; }
        .legal strong { color: var(--text-primary); font-weight: 600; }
      `}</style>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "28px 20px 72px", fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 30 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 18, color: "var(--text-primary)", textDecoration: "none" }}>
            <Logo size={24} /> VeChat
          </a>
          <a href="/" style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", textDecoration: "none" }}>← Volver al inicio</a>
        </header>

        <h1 style={{ fontFamily: "'Bricolage Grotesque', var(--font-inter), system-ui, sans-serif", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px", color: "var(--text-primary)" }}>{title}</h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 6px" }}>Última actualización: {updated}</p>

        <div className="legal">{children}</div>

        <footer style={{ marginTop: 44, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", fontSize: 13 }}>
          <a href="/terminos" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Términos</a>
          <a href="/privacidad" style={{ color: "var(--text-secondary)", textDecoration: "none" }}>Privacidad</a>
          <span style={{ color: "var(--text-tertiary)" }}>VeChat · Hecho en Venezuela 🇻🇪</span>
        </footer>
      </div>
    </div>
  );
}
