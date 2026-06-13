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
