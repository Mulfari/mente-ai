import { describe, it, expect } from "vitest";
import { categoryGlyph, formatDistanceKm } from "./businessVisual";

describe("categoryGlyph", () => {
  it("café/panadería → coffee", () => expect(categoryGlyph("Café & panadería").icon).toBe("coffee"));
  it("tasca/vinos → wine", () => expect(categoryGlyph("Tasca & vinos").icon).toBe("wine"));
  it("hamburguesería → fork", () => expect(categoryGlyph("Hamburguesería").icon).toBe("fork"));
  it("farmacia → stethoscope", () => expect(categoryGlyph("Farmacia").icon).toBe("stethoscope"));
  it("acentos/mayúsculas insensible", () => expect(categoryGlyph("CAFÉ").icon).toBe("coffee"));
  it("desconocido → store (default)", () => expect(categoryGlyph("xyz").icon).toBe("store"));
  it("null → store (default)", () => expect(categoryGlyph(null).icon).toBe("store"));
  it("trae color hex", () => expect(categoryGlyph("café").color).toMatch(/^#[0-9A-Fa-f]{6}$/));
});

describe("formatDistanceKm", () => {
  it("<10 → 1 decimal", () => expect(formatDistanceKm(0.4)).toBe("0.4 km"));
  it(">=10 → entero redondeado", () => expect(formatDistanceKm(12.6)).toBe("13 km"));
});
