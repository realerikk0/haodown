import { describe, expect, it } from "vitest";

import { mapDouyinVideoFormats } from "@/lib/providers/douyin/extract-video";

describe("mapDouyinVideoFormats", () => {
  it("sorts Douyin formats by height then bitrate and marks them as no-watermark", () => {
    const formats = mapDouyinVideoFormats(
      [
        {
          gear_name: "normal_540_0",
          bit_rate: 1381894,
          play_addr: {
            url_list: ["https://example.com/540.mp4"],
            width: 1024,
            height: 576,
          },
        },
        {
          gear_name: "normal_720_0",
          bit_rate: 1213122,
          play_addr: {
            url_list: ["https://example.com/720.mp4"],
            width: 1280,
            height: 720,
          },
        },
        {
          gear_name: "low_720_0",
          bit_rate: 1115486,
          play_addr: {
            url_list: ["https://example.com/720-low.mp4"],
            width: 1280,
            height: 720,
          },
        },
      ],
      "720p",
    );

    expect(formats.map((item) => item.url)).toEqual([
      "https://example.com/720.mp4",
      "https://example.com/720-low.mp4",
      "https://example.com/540.mp4",
    ]);
    expect(formats[0]).toEqual(
      expect.objectContaining({
        definition: "720p",
        watermark: "none",
      }),
    );
  });
});
