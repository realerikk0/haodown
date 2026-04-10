import { describe, expect, it } from "vitest";

import type { ExtractOptions } from "@/lib/models";
import { getProviderForUrl } from "@/lib/providers";

const describeLive =
  process.env.LIVE_DOUYIN_TESTS === "1" ? describe : describe.skip;

const defaultOptions: ExtractOptions = {
  preferHighestQuality: true,
  preferUnwatermarked: true,
};

async function extractLive(url: string) {
  const provider = getProviderForUrl(new URL(url));
  const resolved = await provider.resolve(new URL(url));

  return provider.extract({
    ...resolved,
    options: defaultOptions,
  });
}

describeLive("Douyin live extraction", () => {
  it("extracts a downloadable no-watermark video link", async () => {
    const body = await extractLive("https://v.douyin.com/zDy0SyBc-d8/");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("douyin");
    expect(body.contentType).toBe("video");
    expect(body.video?.best?.watermark).toBe("none");
    expect(body.video?.best?.url).toMatch(/douyinvod\.com|iesdouyin\.com/);
  }, 15000);

  it("extracts note images", async () => {
    const body = await extractLive("https://v.douyin.com/LsoO5HmemgM/");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("douyin");
    expect(body.contentType).toBe("gallery");
    expect((body.images?.length ?? 0) > 0).toBe(true);
    expect(body.images?.[0]?.url).toContain("douyinpic.com");
  }, 15000);
});
