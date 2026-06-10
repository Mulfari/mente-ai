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
      const height = window.visualViewport?.height ?? window.innerHeight;
      const vh = height * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
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
