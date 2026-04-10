import { describe, expect, it } from "vitest";

import { normalizeXiaohongshuTarget } from "@/lib/providers/xiaohongshu/shared";

describe("normalizeXiaohongshuTarget", () => {
  it("normalizes gallery notes to discovery URLs", () => {
    const normalized = normalizeXiaohongshuTarget(
      new URL(
        "https://www.xiaohongshu.com/discovery/item/69b3fe9a000000001a02a5ce?xsec_token=test",
      ),
    );

    expect(normalized).toEqual({
      canonicalUrl:
        "https://www.xiaohongshu.com/discovery/item/69b3fe9a000000001a02a5ce",
      contentType: "gallery",
      id: "69b3fe9a000000001a02a5ce",
    });
  });

  it("marks typed video notes as video", () => {
    const normalized = normalizeXiaohongshuTarget(
      new URL(
        "https://www.xiaohongshu.com/discovery/item/69d1ce41000000001b001e40?type=video&xsec_token=test",
      ),
    );

    expect(normalized).toEqual({
      canonicalUrl:
        "https://www.xiaohongshu.com/discovery/item/69d1ce41000000001b001e40",
      contentType: "video",
      id: "69d1ce41000000001b001e40",
    });
  });
});
