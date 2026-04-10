import { describe, expect, it } from "vitest";

import { mapXiaohongshuVideoFormats } from "@/lib/providers/xiaohongshu/extract-video";

describe("mapXiaohongshuVideoFormats", () => {
  it("prefers higher resolution and normalizes URLs to https", () => {
    const formats = mapXiaohongshuVideoFormats([
      {
        masterUrl: "http://example.com/720.mp4",
        width: 720,
        height: 1280,
        avgBitrate: 1500000,
        qualityType: "HD",
      },
      {
        masterUrl: "http://example.com/1080.mp4",
        width: 1080,
        height: 1920,
        avgBitrate: 2500000,
        qualityType: "FHD",
      },
    ]);

    expect(formats.map((item) => item.url)).toEqual([
      "https://example.com/1080.mp4",
      "https://example.com/720.mp4",
    ]);
    expect(formats[0]).toEqual(
      expect.objectContaining({
        definition: "1920p",
        watermark: "none",
      }),
    );
  });
});
