import { AuthSessionMissingError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import { isMissingAuthSessionError } from "@/lib/supabase/auth-errors";

describe("isMissingAuthSessionError", () => {
  it("recognizes the expected anonymous-session error", () => {
    expect(isMissingAuthSessionError(new AuthSessionMissingError())).toBe(true);
  });

  it("does not treat generic errors as anonymous state", () => {
    expect(isMissingAuthSessionError(new Error("boom"))).toBe(false);
  });
});
