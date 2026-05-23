import { describe, expect, it } from "vitest";
import { expiryFromDays, generateToken, tokenFingerprint } from "@/lib/assessment/tokens";

describe("assessment tokens", () => {
  it("generates URL-safe 256-bit tokens", () => {
    const t = generateToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces unique tokens", () => {
    const set = new Set<string>();
    for (let i = 0; i < 100; i++) set.add(generateToken());
    expect(set.size).toBe(100);
  });

  it("fingerprint is deterministic and short", () => {
    const a = generateToken();
    const f1 = tokenFingerprint(a);
    const f2 = tokenFingerprint(a);
    expect(f1).toBe(f2);
    expect(f1.length).toBe(12);
    expect(f1).toMatch(/^[a-f0-9]+$/);
  });

  it("fingerprint diverges for different tokens", () => {
    const a = tokenFingerprint(generateToken());
    const b = tokenFingerprint(generateToken());
    expect(a).not.toBe(b);
  });

  it("expiry math returns a future date", () => {
    const e = expiryFromDays(14);
    expect(e.getTime()).toBeGreaterThan(Date.now() + 13 * 24 * 60 * 60 * 1000);
    expect(e.getTime()).toBeLessThanOrEqual(Date.now() + 14 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("expiry math clamps to 1 day minimum", () => {
    const e = expiryFromDays(0);
    expect(e.getTime()).toBeGreaterThan(Date.now());
  });
});
