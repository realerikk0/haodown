import { describe, expect, it } from "vitest";

import { getProviderForUrl } from "@/lib/providers";
import type { ExtractOptions } from "@/lib/models";

const describeLive =
  process.env.LIVE_XIAOHONGSHU_TESTS === "1" ? describe : describe.skip;

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

describeLive("Xiaohongshu live extraction", () => {
  it("extracts gallery images from a public note", async () => {
    const body = await extractLive("http://xhslink.com/o/9F9PKgQbtcn");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("xiaohongshu");
    expect(body.contentType).toBe("gallery");
    expect((body.images?.length ?? 0) > 0).toBe(true);
    expect(body.images?.[0]?.url).toContain("xhscdn.com");
  });

  it("extracts a downloadable video link", async () => {
    const body = await extractLive("http://xhslink.com/o/AxDw8qJubJI");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("xiaohongshu");
    expect(body.contentType).toBe("video");
    expect(body.video?.best?.url).toContain("xhscdn.com");
  });

  it("extracts live photo motion urls from gallery notes", async () => {
    const body = await extractLive("http://xhslink.com/o/3KKxKAOlPCq");

    expect(body.ok).toBe(true);
    expect(body.platform).toBe("xiaohongshu");
    expect(body.contentType).toBe("gallery");
    expect(body.images?.some((image) => image.livePhoto && image.motionUrl)).toBe(true);
  });
});
