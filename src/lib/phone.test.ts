import { describe, it, expect } from "vitest";
import { waLink } from "./phone";

describe("waLink", () => {
  it("0414… → 58414…", () => expect(waLink("04141234567")).toBe("https://wa.me/584141234567"));
  it("formato con símbolos", () => expect(waLink("+58 414-123 4567")).toBe("https://wa.me/584141234567"));
  it("sin 0 ni 58 antepone 58", () => expect(waLink("4141234567")).toBe("https://wa.me/584141234567"));
  it("null/vacío/sin dígitos → null", () => {
    expect(waLink(null)).toBeNull();
    expect(waLink("")).toBeNull();
    expect(waLink("abc")).toBeNull();
  });
});
