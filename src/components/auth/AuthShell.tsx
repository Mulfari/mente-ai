import React from "react";
import "./authDesign.css";

// Marco de /sign-in y /sign-up — diseño split importado de Claude Design (auth),
// con los lados INVERTIDOS respecto al export: el FORMULARIO va a la izquierda y
// el panel de MARCA (oscuro) a la derecha. El formulario lo dibuja el componente
// real de Clerk (<SignIn>/<SignUp>), embebido en .formpane y estilizado vía
// `vechatAuthPageAppearance` (sin tarjeta propia). El CSS va scoped bajo `.av`
// (src/components/auth/authDesign.css). OJO: el flujo principal de auth dentro de
// la app sigue siendo el MODAL de Clerk (apariencia global), que NO se toca.
// Re-generar CSS: scripts/auth/build-auth.mjs.
const GREEN = "#10A37F";

export default function AuthShell({
  heading,
  sub,
  children,
}: {
  heading: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="av">
      <div className="shell">
        {/* ── Formulario (IZQUIERDA, swap) ─────────────────────────────── */}
        <section className="formpane">
          <div className="formcard">
            <h1 className="f-h disp">{heading}</h1>
            <p className="f-sub">{sub}</p>
            <div className="av-clerk">{children}</div>
          </div>
        </section>

        {/* ── Marca (DERECHA, swap) — panel oscuro ─────────────────────── */}
        <section className="brandpane">
          <span className="glow" aria-hidden />
          <div className="bp-top">
            <span className="brand">
              <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5l8 14L20 5" />
              </svg>
              VeChat
            </span>
            <a className="bp-back" href="/">
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M11 18l-6-6 6-6" />
              </svg>
              Volver al inicio
            </a>
          </div>
          <div className="bp-mid">
            <span className="bp-kick"><span className="ln" /> La IA hecha en Venezuela</span>
            <h2 className="bp-h disp">
              Tu pana digital, <span className="slab">aquí</span>.
            </h2>
            <div className="bp-chat">
              <div className="bp-cb u">¿A cuánto está el dólar hoy?</div>
              <div className="bp-cb a">
                Hoy el BCV marca <b>Bs. 38,20</b>. ¿Te lo convierto a lo que necesites? 👇
              </div>
            </div>
          </div>
          <div className="bp-foot">
            <span>Gratis para empezar</span>
            <span className="dot" />
            <span>Sin tarjeta</span>
            <span className="dot" />
            <span>En 10 segundos</span>
          </div>
        </section>
      </div>
    </div>
  );
}
