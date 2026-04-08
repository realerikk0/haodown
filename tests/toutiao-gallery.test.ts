import { describe, expect, it } from "vitest";

import { filterGalleryImages } from "@/lib/providers/toutiao/extract-gallery";

describe("filterGalleryImages", () => {
  it("keeps only正文图片 and deduplicates them", () => {
    const images = filterGalleryImages(
      [
        {
          src: "https://example.com/avatar.png",
          width: 300,
          height: 300,
        },
        {
          src: "https://p3-sign.toutiaoimg.com/tos-cn/test~tplv-obj:3344:5016.image?from=post&gid=1861714943209472",
          width: 3344,
          height: 5016,
        },
        {
          src: "https://p3-sign.toutiaoimg.com/tos-cn/test~tplv-obj:3344:5016.image?from=post&gid=1861714943209472",
          width: 3344,
          height: 5016,
        },
      ],
      "1861714943209472",
    );

    expect(images).toEqual([
      {
        index: 1,
        width: 3344,
        height: 5016,
        url: "https://p3-sign.toutiaoimg.com/tos-cn/test~tplv-obj:3344:5016.image?from=post&gid=1861714943209472",
      },
    ]);
  });
});
