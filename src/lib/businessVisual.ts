// src/lib/businessVisual.ts — helpers PUROS para la presentación de un negocio
// de VeLocal en el chat (server + cliente, sin deps). Mapea la categoría a un
// ícono + color (para el mosaico-logo, evitando el "logo gris") y formatea la
// distancia. Lógica testeable (businessVisual.test.ts).

export type GlyphKey =
  | "coffee" | "wine" | "fork" | "wrench" | "scissors" | "stethoscope" | "bag" | "store";

type Glyph = { icon: GlyphKey; color: string };

// Reglas por palabra clave (la primera que matchea gana). Se evalúan contra la
// categoría normalizada (minúsculas, sin acentos).
const RULES: Array<{ re: RegExp; g: Glyph }> = [
  { re: /caf|coffee|panad|reposter|desayun|arepa/, g: { icon: "coffee", color: "#B45309" } },
  { re: /bar|tasca|vino|licor|cerve|pub|coctel|cocktel/, g: { icon: "wine", color: "#7C3AED" } },
  { re: /restaur|comida|burg|hamburg|pizza|parrilla|pollo|cocina|food|gastro/, g: { icon: "fork", color: "#DC2626" } },
  { re: /ferret|repuest|taller|mecan|caucho|servic|tecnic/, g: { icon: "wrench", color: "#0E8F6F" } },
  { re: /pelu|barber|estetic|spa|salon|una|belleza/, g: { icon: "scissors", color: "#DB2777" } },
  { re: /farmac|salud|clinic|medic|dental|odont/, g: { icon: "stethoscope", color: "#2563EB" } },
  { re: /tienda|boutique|moda|ropa|market|abasto|bodeg|licorer/, g: { icon: "bag", color: "#0891B2" } },
];

const DEFAULT: Glyph = { icon: "store", color: "#10A37F" };

/** Ícono + color de mosaico según la categoría (insensible a acentos/mayúsculas). */
export function categoryGlyph(category: string | null | undefined): Glyph {
  const c = (category ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  for (const r of RULES) if (r.re.test(c)) return r.g;
  return DEFAULT;
}

/** "0.4 km" / "13 km" — 1 decimal bajo 10 km, entero arriba. */
export function formatDistanceKm(km: number): string {
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
