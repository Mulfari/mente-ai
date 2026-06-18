// Apariencia global de Clerk (modales openSignIn/openSignUp y las páginas
// /sign-in y /sign-up). Se inyecta UNA sola vez en el ClerkProvider del
// layout — no pasar appearance por componente. Claro a propósito: el auth
// es superficie de marca, igual que el resto del funnel público, aunque el
// chat esté en tema oscuro (tarjeta clara sobre scrim, estilo ChatGPT).
export const vechatAppearance = {
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#10A37F",
    colorText: "#2A2521",
    colorTextSecondary: "#6E655A",
    colorBackground: "#FBF8F2",
    colorInputBackground: "#FEFCF8",
    colorInputText: "#2A2521",
    colorDanger: "#DC2626",
    borderRadius: "12px",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    fontSize: "14px",
  },
  elements: {
    // Scrim idéntico al de los modales propios (AccountMenu, ExpandInput).
    modalBackdrop: {
      backgroundColor: "rgba(17, 24, 39, 0.45)",
      backdropFilter: "blur(4px)",
    },
    cardBox: {
      borderRadius: "16px",
      border: "1px solid #E6DFD2",
      boxShadow: "0 24px 60px rgba(42, 37, 33, 0.14)",
    },
    headerTitle: {
      fontSize: "20px",
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    headerSubtitle: { color: "#6E655A" },
    socialButtonsBlockButton: {
      border: "1px solid #E6DFD2",
      borderRadius: "12px",
      height: "44px",
      "&:hover": { backgroundColor: "#F0EADF" },
    },
    dividerLine: { backgroundColor: "#E6DFD2" },
    dividerText: { color: "#9B9183" },
    formFieldInput: {
      border: "1px solid #E6DFD2",
      borderRadius: "10px",
      "&:focus": {
        borderColor: "#10A37F",
        boxShadow: "0 0 0 3px rgba(16, 163, 127, 0.12)",
      },
    },
    formButtonPrimary: {
      height: "44px",
      fontSize: "14px",
      fontWeight: 600,
      textTransform: "none" as const,
      borderRadius: "12px",
      backgroundColor: "#10A37F",
      boxShadow: "none",
      "&:hover": { backgroundColor: "#0D8B6A" },
    },
    footerActionLink: {
      color: "#10A37F",
      fontWeight: 600,
      "&:hover": { color: "#0D8B6A" },
    },
  },
} as const;

// Apariencia SOLO para las páginas /sign-in y /sign-up (split design): el
// componente de Clerk va EMBEBIDO en el panel del formulario (.formpane) — sin
// tarjeta/sombra propias y sin su header (lo pone AuthShell con .f-h/.f-sub).
// Se pasa por `appearance` al <SignIn>/<SignUp>; NO cambia el modal global.
// Los valores replican el mockup del diseño (inputs/botón verde, social block).
export const vechatAuthPageAppearance = {
  layout: {
    // Como el diseño enviado: campos ARRIBA, "Continuar con Google" ABAJO.
    socialButtonsPlacement: "bottom" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#10A37F",
    colorText: "#221E1A",
    colorTextSecondary: "#6E655A",
    colorBackground: "transparent",
    colorInputBackground: "#FBF8F2",
    borderRadius: "12px",
    fontFamily: "var(--font-landing), var(--font-inter), system-ui, sans-serif",
    spacingUnit: "1rem",
  },
  elements: {
    rootBox: { width: "100%" },
    main: { gap: "18px" },
    form: { gap: "14px" },
    formField: { marginBottom: "2px" },
    dividerRow: { margin: "18px 0" },
    socialButtons: { gap: "10px" },
    cardBox: { width: "100%", border: "none", boxShadow: "none", borderRadius: "0" },
    card: { width: "100%", border: "none", boxShadow: "none", background: "transparent", padding: "0" },
    header: { display: "none" },
    socialButtonsBlockButton: {
      height: "48px",
      border: "1px solid #E2DBCD",
      borderRadius: "12px",
      backgroundColor: "#FBF8F2",
      fontWeight: 600,
      "&:hover": { backgroundColor: "#F0EADF", borderColor: "#9B9183" },
    },
    dividerLine: { backgroundColor: "#E2DBCD" },
    dividerText: { color: "#9B9183", fontSize: "12.5px", letterSpacing: "0.08em", textTransform: "uppercase" as const },
    formFieldLabel: { fontSize: "13px", fontWeight: 600, color: "#6E655A" },
    formFieldInput: {
      height: "48px",
      border: "1px solid #E2DBCD",
      borderRadius: "12px",
      backgroundColor: "#FBF8F2",
      fontSize: "15px",
      "&:focus": { borderColor: "#10A37F", boxShadow: "0 0 0 3px rgba(16, 163, 127, 0.12)" },
    },
    formButtonPrimary: {
      height: "50px",
      fontSize: "15.5px",
      fontWeight: 700,
      textTransform: "none" as const,
      borderRadius: "12px",
      backgroundColor: "#10A37F",
      boxShadow: "0 10px 24px -10px rgba(16, 163, 127, 0.8)",
      "&:hover": { backgroundColor: "#0D8B6A" },
    },
    footer: { background: "transparent" },
    footerActionLink: { color: "#0A7355", fontWeight: 700, "&:hover": { color: "#0D8B6A" } },
  },
} as const;
