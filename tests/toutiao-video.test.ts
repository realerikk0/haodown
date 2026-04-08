import { describe, expect, it } from "vitest";

import { mapVideoFormats } from "@/lib/providers/toutiao/extract-video";

describe("mapVideoFormats", () => {
  it("sorts Toutiao formats by height then bitrate", () => {
    const formats = mapVideoFormats([
      {
        main_url: "https://example.com/360.mp4?lr=unwatermarked",
        video_meta: {
          definition: "360p",
          vwidth: 640,
          vheight: 360,
          bitrate: 400000,
        },
      },
      {
        main_url: "https://example.com/1080.mp4?lr=unwatermarked",
        video_meta: {
          definition: "1080p",
          vwidth: 1920,
          vheight: 1080,
          bitrate: 2500000,
        },
      },
      {
        main_url: "https://example.com/720.mp4",
        video_meta: {
          definition: "720p",
          vwidth: 1280,
          vheight: 720,
          bitrate: 1200000,
        },
      },
    ]);

    expect(formats.map((item) => item.definition)).toEqual([
      "1080p",
      "720p",
      "360p",
    ]);
    expect(formats[0]).toEqual(
      expect.objectContaining({
        url: "https://example.com/1080.mp4?lr=unwatermarked",
        watermark: "none",
      }),
    );
  });
});
