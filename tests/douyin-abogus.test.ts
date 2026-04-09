import { describe, expect, it } from "vitest";

import {
  buildDouyinDetailParams,
  createDouyinABogus,
  debugDouyinSm3Available,
} from "@/lib/providers/douyin/abogus";

describe("Douyin web detail signing", () => {
  it("builds detail params with the expected field order", () => {
    const params = buildDouyinDetailParams("7626023271838721188");
    const entries = [...params.entries()];

    expect(entries[0]).toEqual(["device_platform", "webapp"]);
    expect(entries.at(-2)).toEqual(["msToken", ""]);
    expect(entries.at(-1)).toEqual(["aweme_id", "7626023271838721188"]);
  });

  it("generates a non-empty a_bogus value", () => {
    const params = buildDouyinDetailParams("7626023271838721188");
    const value = createDouyinABogus(params);

    expect(value.length).toBeGreaterThan(40);
    expect(value).not.toContain(" ");
  });

  it("has SM3 support available for signing", () => {
    expect(debugDouyinSm3Available()).toBe(true);
  });
});
