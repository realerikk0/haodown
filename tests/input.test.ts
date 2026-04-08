import { describe, expect, it } from "vitest";

import { extractFirstUrl, normalizeOptions } from "@/lib/input";

describe("extractFirstUrl", () => {
  it("extracts the first Toutiao URL from share text", () => {
    const text = `【标题】
点击链接打开👉 https://m.toutiao.com/is/RICcKIVG_oc/ RICcKIVG_oc\` Axw:/`;

    expect(extractFirstUrl(text)).toBe("https://m.toutiao.com/is/RICcKIVG_oc/");
  });

  it("returns null when no URL exists", () => {
    expect(extractFirstUrl("just some text")).toBeNull();
  });
});

describe("normalizeOptions", () => {
  it("applies defaults", () => {
    expect(normalizeOptions()).toEqual({
      preferUnwatermarked: true,
      preferHighestQuality: true,
    });
  });
});
