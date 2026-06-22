import { describe, it, expect } from "vitest";
import { shouldShowAB, winnerLabel, AB_SAMPLE_RATE, VARIANT_A, VARIANT_B } from "./abTest";

describe("shouldShowAB", () => {
  it("deslogueado: nunca", () => expect(shouldShowAB(0, false)).toBe(false));
  it("logueado, bajo el rate → sí", () => expect(shouldShowAB(AB_SAMPLE_RATE - 0.0001, true)).toBe(true));
  it("logueado, justo en el rate → no", () => expect(shouldShowAB(AB_SAMPLE_RATE, true)).toBe(false));
  it("logueado, sobre el rate → no", () => expect(shouldShowAB(0.99, true)).toBe(false));
});

describe("winnerLabel", () => {
  it("a → normal", () => expect(winnerLabel("a")).toBe(VARIANT_A));
  it("b → conciso", () => expect(winnerLabel("b")).toBe(VARIANT_B));
});
