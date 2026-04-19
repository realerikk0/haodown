import { afterEach, describe, expect, it } from "vitest";

import {
  SHORTCUT_LATEST_VERSION,
  compareShortcutVersions,
  isShortcutUpdateAvailable,
  listShortcutAuthModes,
} from "@/lib/shortcut/config";

const ORIGINAL_ENV = {
  nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  nextPublicSupabasePublishableKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

describe("shortcut config", () => {
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV.nextPublicSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY =
      ORIGINAL_ENV.nextPublicSupabasePublishableKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV.supabaseServiceRoleKey;
  });

  it("compares semantic shortcut versions", () => {
    expect(compareShortcutVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareShortcutVersions("1.2.0", "1.1.9")).toBe(1);
    expect(compareShortcutVersions("0.9.9", SHORTCUT_LATEST_VERSION)).toBe(-1);
  });

  it("treats missing or older versions as update available", () => {
    expect(isShortcutUpdateAvailable()).toBe(true);
    expect(isShortcutUpdateAvailable("0.9.0")).toBe(true);
    expect(isShortcutUpdateAvailable(SHORTCUT_LATEST_VERSION)).toBe(false);
  });

  it("only exposes bearer-token mode when admin access is enabled", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xxx";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";

    expect(listShortcutAuthModes()).toEqual(["anonymous-session"]);

    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    expect(listShortcutAuthModes()).toEqual([
      "anonymous-session",
      "bearer-token",
    ]);
  });
});
