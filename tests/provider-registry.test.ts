import { describe, expect, it } from "vitest";

import { getProviderForUrl, listPlatforms } from "@/lib/providers";

describe("provider registry", () => {
  it("matches Toutiao URLs", () => {
    const provider = getProviderForUrl(new URL("https://m.toutiao.com/is/foo/"));
    expect(provider.descriptor.platform).toBe("toutiao");
  });

  it("lists enabled platforms", () => {
    expect(listPlatforms()).toEqual([
      expect.objectContaining({
        platform: "toutiao",
        enabled: true,
      }),
    ]);
  });
});
