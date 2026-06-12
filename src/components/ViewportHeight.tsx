"use client";

import { useEffect } from "react";

/**
 * Tracks the visible viewport height via the Visual Viewport API and
 * exposes it as a CSS custom property `--vh` (= 1% of visible height).
 * The chat container uses `calc(var(--vh, 1vh) * 100)` for its height,
 * so when the on-screen keyboard opens on iOS / Android, the container
 * smoothly shrinks to the new visible area and the input stays anchored
 * just above the keyboard instead of jumping.
 *
 * Falls back to window.innerHeight for browsers without
 * `window.visualViewport` (very old, but the innerHeight path also works
 * for the initial mount — subsequent resizes won't be tracked, which is
 * fine because such browsers don't have the keyboard-resize issue).
 */
export default function ViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    function setVh() {
      // Caja real de la página (100dvh en <html>) — llega hasta el borde
      // físico inferior. El visual viewport puede ser unos px más corto
      // (zonas de barras del navegador) y usarlo siempre dejaba una franja
      // del fondo descubierta abajo en móvil. Regla: recorte GRANDE =
      // teclado en pantalla → seguirlo (el input queda sobre el teclado);
      // recorte chico = barras del navegador → ocupar la página completa.
      const layoutH = document.documentElement.clientHeight;
      const visualH = window.visualViewport?.height ?? layoutH;
      const height = layoutH - visualH > 150 ? visualH : layoutH;
      document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
    }

    setVh();

    const vv = window.visualViewport;
    vv?.addEventListener("resize", setVh);
    vv?.addEventListener("scroll", setVh);
    window.addEventListener("resize", setVh);
    // `orientationchange` covers the iOS rotation case where the
    // visualViewport may not fire resize before paint.
    window.addEventListener("orientationchange", setVh);

    return () => {
      vv?.removeEventListener("resize", setVh);
      vv?.removeEventListener("scroll", setVh);
      window.removeEventListener("resize", setVh);
      window.removeEventListener("orientationchange", setVh);
    };
  }, []);

  return null;
}
