"use client";

import { useResolvedTheme } from "@/lib/theme";

// Mantiene el data-theme de <html> sincronizado cuando la preferencia es
// "sistema" y el SO cambia de claro a oscuro en caliente. No renderiza nada.
export default function ThemeWatcher() {
  useResolvedTheme();
  return null;
}
