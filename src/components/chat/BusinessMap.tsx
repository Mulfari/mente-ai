"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LocalBusiness } from "@/lib/localBusinesses";
import { useResolvedTheme } from "@/lib/theme";
import { categoryGlyph } from "@/lib/businessVisual";
import LocalBusinessCard from "./LocalBusinessCard";
import "leaflet/dist/leaflet.css";

// Mapa de negocios de VeLocal en el chat (estilo ChatGPT): preview embebido +
// pantalla completa con lista. Leaflet usa `window`, así que se importa
// DINÁMICAMENTE dentro del efecto (nunca en el server) y el componente entra al
// bundle vía next/dynamic{ssr:false} desde MessageBubble (carga diferida).

type WithCoords = LocalBusiness & { lat: number; lng: number };

const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

function pinHtml(color: string, openNow: boolean): string {
  const ring = openNow ? "#10A37F" : "rgba(255,255,255,.92)";
  return `<span style="display:block;width:18px;height:18px;border-radius:50%;background:${color};border:3px solid ${ring};box-shadow:0 1px 5px rgba(0,0,0,.45)"></span>`;
}

// Inicializa un mapa Leaflet en el contenedor. Se re-crea solo cuando cambia la
// lista (key), el tema o el modo interactivo.
function MapCanvas({
  pts, theme, interactive, onPinClick,
}: {
  pts: WithCoords[];
  theme: "light" | "dark";
  interactive: boolean;
  onPinClick?: (slug: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = pts.map((p) => p.slug).join("|");
  useEffect(() => {
    let map: any = null;
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !ref.current) return;
      map = L.map(ref.current, {
        zoomControl: interactive,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: interactive,
        boxZoom: interactive,
        keyboard: interactive,
        touchZoom: interactive,
        attributionControl: true,
      });
      L.tileLayer(theme === "dark" ? TILES.dark : TILES.light, { attribution: ATTR, maxZoom: 19 }).addTo(map);
      for (const b of pts) {
        const { color } = categoryGlyph(b.category);
        const icon = L.divIcon({ html: pinHtml(color, b.openNow), className: "lb-pin", iconSize: [18, 18], iconAnchor: [9, 9] });
        const m = L.marker([b.lat, b.lng], { icon }).addTo(map);
        m.bindPopup(`<b>${escapeHtml(b.name)}</b><br/>${b.openNow ? "Abierto ahora" : "Cerrado"}`);
        if (onPinClick) m.on("click", () => onPinClick(b.slug));
      }
      const coords = pts.map((b) => [b.lat, b.lng] as [number, number]);
      if (coords.length === 1) map.setView(coords[0], 15);
      else map.fitBounds(coords, { padding: [28, 28], maxZoom: 16 });
      // El contenedor puede montar con tamaño 0 (modal/animación) → recalcula.
      setTimeout(() => map && map.invalidateSize(), 80);
    })();
    return () => {
      cancelled = true;
      if (map) map.remove();
    };
  }, [key, theme, interactive]); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className="lb-map-canvas" />;
}

export default function BusinessMap({ businesses }: { businesses: LocalBusiness[] }) {
  const resolved = useResolvedTheme();
  const theme: "light" | "dark" = resolved === "dark" ? "dark" : "light";
  const [fullscreen, setFullscreen] = useState(false);
  // Escape cierra la pantalla completa.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const pts = businesses.filter((b): b is WithCoords => typeof b.lat === "number" && typeof b.lng === "number");
  if (pts.length === 0) return null;

  return (
    <>
      <div
        className="lb-map-wrap"
        onClick={() => setFullscreen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter") setFullscreen(true); }}
        aria-label="Ver mapa de los negocios"
      >
        <MapCanvas pts={pts} theme={theme} interactive={false} />
        <span className="lb-map-expand">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Ver mapa
        </span>
      </div>

      {fullscreen && createPortal(
        <div className="lb-map-modal" role="dialog" aria-modal="true">
          <button className="lb-map-close" onClick={() => setFullscreen(false)} aria-label="Cerrar mapa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
          <div className="lb-map-modal-map">
            <MapCanvas pts={pts} theme={theme} interactive />
          </div>
          <div className="lb-map-modal-list">
            <div className="lb-map-list-head">{pts.length} {pts.length === 1 ? "lugar" : "lugares"}</div>
            {pts.map((b) => <LocalBusinessCard key={b.slug} b={b} />)}
          </div>
        </div>
      )}
    </>
  );
}
