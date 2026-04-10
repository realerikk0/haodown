import { describe, expect, it } from "vitest";

import type { ExtractOptions } from "@/lib/models";
import { getProviderForUrl } from "@/lib/providers";

const describeLive =
  process.env.LIVE_TOUTIAO_TESTS === "1" ? describe : describe.skip;

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

describeLive("Toutiao live extraction", () => {
  it("extracts best available video formats", async () => {
    const body = await extractLive("https://m.toutiao.com/is/RICcKIVG_oc/");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("toutiao");
    expect(body.contentType).toBe("video");
    expect(body.video?.best?.definition).toBe("1080p");
  }, 15000);

  it("extracts original gallery images", async () => {
    const body = await extractLive("https://m.toutiao.com/is/JS6MXZTs2vA/");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("toutiao");
    expect(body.contentType).toBe("gallery");
    expect((body.images?.length ?? 0) > 0).toBe(true);
  }, 15000);
});
