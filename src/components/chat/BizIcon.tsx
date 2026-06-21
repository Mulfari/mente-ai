import type { GlyphKey } from "@/lib/businessVisual";

// Set de íconos SVG inline (sin librería). Glyphs de categoría (mosaico-logo) +
// íconos de acción (whatsapp/pin/arrow). Stroke = currentColor; WhatsApp = fill.
export type IconName = GlyphKey | "whatsapp" | "pin" | "arrow";

const STROKE: Record<string, string> = {
  coffee: "M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8zM6 2v2M10 2v2M14 2v2",
  wine: "M8 22h8M12 15v7M7 2h10s0 6-2 8a4 4 0 0 1-6 0C7 8 7 2 7 2z",
  fork: "M7 3v6M10 3v6M13 3v6M7 9h6M10 9v12",
  wrench: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.7-3.7a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9l-3.7 3.7z",
  scissors: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
  stethoscope: "M4.5 3A2 2 0 0 0 3 5v4a6 6 0 0 0 12 0V5a2 2 0 0 0-1.5-2M9 15v1a6 6 0 0 0 12 0v-3M20 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  bag: "M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0",
  store: "M3 9l1.5-5h15L21 9M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M3 9h18M9 20v-6h6v6",
  pin: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  arrow: "M7 17 17 7M7 7h10v10",
};

const WHATSAPP =
  "M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 0 1 0 16 8 8 0 0 1-4.1-1.1l-.3-.2-2.5.7.7-2.4-.2-.3A8 8 0 0 1 12 4zm-2.6 4.3c-.1 0-.3 0-.5.2-.2.2-.7.7-.7 1.7s.7 2 .8 2.1c.1.2 1.4 2.3 3.5 3.1 1.7.7 2.1.6 2.5.5.4 0 1.2-.5 1.4-1 .2-.5.2-.9.1-1l-.4-.2s-1.1-.5-1.3-.6c-.2 0-.3-.1-.4.1l-.6.7c-.1.1-.2.1-.4 0-.2-.1-.9-.3-1.7-1-.6-.6-1-1.2-1.2-1.4-.1-.2 0-.3.1-.4l.3-.3.2-.3v-.4l-.6-1.4c-.1-.3-.2-.3-.4-.3h-.4z";

export default function BizIcon({ name, size = 18 }: { name: IconName; size?: number }) {
  if (name === "whatsapp") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d={WHATSAPP} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={STROKE[name] ?? STROKE.store} />
    </svg>
  );
}
