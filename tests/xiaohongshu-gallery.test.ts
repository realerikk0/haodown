import { describe, expect, it } from "vitest";

import { mapXiaohongshuGalleryImages } from "@/lib/providers/xiaohongshu/extract-gallery";

describe("mapXiaohongshuGalleryImages", () => {
  it("keeps WB_DFT images and attaches live photo motion urls", () => {
    const images = mapXiaohongshuGalleryImages([
      {
        width: 1792,
        height: 2400,
        urlDefault: "http://example.com/default.jpg",
        infoList: [
          {
            imageScene: "WB_PRV",
            url: "http://example.com/preview.jpg",
          },
          {
            imageScene: "WB_DFT",
            url: "http://example.com/original.jpg",
          },
        ],
      },
      {
        width: 1080,
        height: 1440,
        urlDefault: "http://example.com/live.jpg",
        livePhoto: true,
        stream: {
          h264: [
            {
              masterUrl: "http://example.com/live.mp4",
            },
          ],
        },
      },
    ]);

    expect(images).toEqual([
      {
        index: 1,
        width: 1792,
        height: 2400,
        url: "https://example.com/original.jpg",
        livePhoto: false,
        motionUrl: null,
      },
      {
        index: 2,
        width: 1080,
        height: 1440,
        url: "https://example.com/live.jpg",
        livePhoto: true,
        motionUrl: "https://example.com/live.mp4",
      },
    ]);
  });
});
