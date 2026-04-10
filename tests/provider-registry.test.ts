import { describe, expect, it } from "vitest";

import { getProviderForUrl, listPlatforms } from "@/lib/providers";

describe("provider registry", () => {
  it("matches Toutiao URLs", () => {
    const provider = getProviderForUrl(new URL("https://m.toutiao.com/is/foo/"));
    expect(provider.descriptor.platform).toBe("toutiao");
  });

  it("matches Douyin URLs", () => {
    const provider = getProviderForUrl(new URL("https://v.douyin.com/test/"));
    expect(provider.descriptor.platform).toBe("douyin");
  });

  it("matches Xiaohongshu URLs", () => {
    const provider = getProviderForUrl(new URL("https://xhslink.com/o/test"));
    expect(provider.descriptor.platform).toBe("xiaohongshu");
  });

  it("lists enabled platforms", () => {
    expect(listPlatforms()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: "toutiao",
          enabled: true,
        }),
        expect.objectContaining({
          platform: "douyin",
          enabled: true,
        }),
        expect.objectContaining({
          platform: "xiaohongshu",
          enabled: true,
        }),
      ]),
    );
  });
});
