import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_REQUEST_LIMIT,
  anonymousQuotaReached,
  getAnonymousRemaining,
  parseAnonymousUsageCount,
  parseAnonymousUsageState,
  serializeAnonymousUsageCount,
} from "@/lib/auth/anonymous";

describe("anonymous auth helpers", () => {
  it("clamps invalid cookie counts to zero", () => {
    expect(parseAnonymousUsageCount(undefined)).toBe(0);
    expect(parseAnonymousUsageCount("nope")).toBe(0);
    expect(parseAnonymousUsageCount("-1")).toBe(0);
  });

  it("caps cookie counts at the anonymous limit", () => {
    expect(parseAnonymousUsageCount(String(ANONYMOUS_REQUEST_LIMIT + 9))).toBe(
      ANONYMOUS_REQUEST_LIMIT,
    );
  });

  it("computes remaining quota correctly", () => {
    expect(getAnonymousRemaining(0)).toBe(ANONYMOUS_REQUEST_LIMIT);
    expect(getAnonymousRemaining(1)).toBe(1);
    expect(getAnonymousRemaining(99)).toBe(0);
  });

  it("marks quota as exhausted only at zero remaining", () => {
    expect(anonymousQuotaReached(ANONYMOUS_REQUEST_LIMIT - 1)).toBe(false);
    expect(anonymousQuotaReached(ANONYMOUS_REQUEST_LIMIT)).toBe(true);
  });

  it("resets stale cookie usage when the stored day is not today", () => {
    expect(parseAnonymousUsageState("2026-04-07:2", "2026-04-08")).toEqual({
      dayKey: "2026-04-08",
      used: 0,
    });
  });

  it("serializes usage with a day key", () => {
    expect(serializeAnonymousUsageCount(1, "2026-04-08")).toBe("2026-04-08:1");
  });
});
