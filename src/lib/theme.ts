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

export function applyThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch { /* storage bloqueado */ }
  const resolved = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", resolved);
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
          document.documentElement.setAttribute("data-theme", systemTheme());
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
