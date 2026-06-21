import { describe, it, expect } from "vitest";
import { anonDecision, anonRemaining, ANON_TRIAL_LIMIT, ANON_IP_DAILY_LIMIT } from "./anonGate";

describe("anonDecision", () => {
  it("sin uso → null (puede enviar)", () => expect(anonDecision(0, 0)).toBeNull());
  it("justo bajo el cap del visitante → null", () => expect(anonDecision(ANON_TRIAL_LIMIT - 1, 0)).toBeNull());
  it("en el cap del visitante → 429 register", () => {
    const d = anonDecision(ANON_TRIAL_LIMIT, 0);
    expect(d?.code).toBe(429);
    expect(d?.register).toBe(true);
  });
  it("en el cap de IP → 429 register", () => {
    expect(anonDecision(0, ANON_IP_DAILY_LIMIT)?.register).toBe(true);
  });
  it("ip null no bloquea por IP", () => expect(anonDecision(0, null)).toBeNull());
});

describe("anonRemaining", () => {
  it("0 usados → TRIAL_LIMIT", () => expect(anonRemaining(0)).toBe(ANON_TRIAL_LIMIT));
  it("todos usados → 0", () => expect(anonRemaining(ANON_TRIAL_LIMIT)).toBe(0));
  it("nunca negativo", () => expect(anonRemaining(ANON_TRIAL_LIMIT + 5)).toBe(0));
});
