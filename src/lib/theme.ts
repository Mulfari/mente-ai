"use client";

import { useSyncExternalStore } from "react";

// Sistema de temas: claro / oscuro / sistema (default). La preferencia vive
// en localStorage ("vechat-theme"); el tema RESUELTO se refleja en el
// atributo data-theme de <html> (los tokens de globals.css hacen el resto).
// Un script inline en layout.tsx aplica el tema antes del primer paint para
// evitar el flash.

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "vechat-theme";
const EVENT = "vechat-theme-change";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch { /* storage bloqueado */ }
  return "system";
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === "system" ? systemTheme() : pref;
}

// Marco del navegador móvil (barra de URL, barra de gestos): el script
// inline del layout lo aplica pre-paint; esto lo mantiene en sincronía al
// cambiar de tema. OJO: en oscuro va NEGRO PURO, no el --background
// (#0B1418): ese tono azul-verdoso pintado en la barra de gestos del
// teléfono se veía como una "raya verde" en el borde de abajo.
const CHROME_COLORS: Record<ResolvedTheme, string> = {
  light: "#DBE4DF",
  dark: "#000000",
};

function syncBrowserChrome(resolved: ResolvedTheme) {
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", CHROME_COLORS[resolved]);
}

export function applyThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch { /* storage bloqueado */ }
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
  syncBrowserChrome(resolved);
  window.dispatchEvent(new CustomEvent(EVENT));
}

// Hook: tema resuelto actual, reactivo a cambios del selector y del sistema.
export function useResolvedTheme(): ResolvedTheme {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onSystem = () => {
        // Solo re-aplica si la preferencia sigue al sistema.
        if (getThemePreference() === "system") {
          const resolved = systemTheme();
          document.documentElement.setAttribute("data-theme", resolved);
          syncBrowserChrome(resolved);
        }
        onChange();
      };
      window.addEventListener(EVENT, onChange);
      mq.addEventListener("change", onSystem);
      return () => {
        window.removeEventListener(EVENT, onChange);
        mq.removeEventListener("change", onSystem);
      };
    },
    () => resolveTheme(getThemePreference()),
    () => "light" as ResolvedTheme
  );
}
