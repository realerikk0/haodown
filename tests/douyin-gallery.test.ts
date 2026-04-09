import { describe, expect, it } from "vitest";

import { filterDouyinGalleryImages } from "@/lib/providers/douyin/extract-gallery";

describe("filterDouyinGalleryImages", () => {
  it("keeps only note images and deduplicates them", () => {
    const images = filterDouyinGalleryImages([
      {
        src: "https://example.com/avatar.webp",
        width: 120,
        height: 120,
      },
      {
        src: "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c000-ce/test~tplv-dy-aweme-images:q75.webp?biz_tag=aweme_images&from=327834062&s=PackSourceEnum_AWEME_DETAIL&sc=image&x-expires=1770000000",
        width: 2160,
        height: 3240,
      },
      {
        src: "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c000-ce/test~tplv-dy-aweme-images:q75.webp?biz_tag=aweme_images&from=327834062&s=PackSourceEnum_AWEME_DETAIL&sc=image&x-expires=1770000000",
        width: 2160,
        height: 3240,
      },
    ]);

    expect(images).toEqual([
      {
        index: 1,
        width: 2160,
        height: 3240,
        url: "https://p9-pc-sign.douyinpic.com/tos-cn-i-0813c000-ce/test~tplv-dy-aweme-images:q75.webp?biz_tag=aweme_images&from=327834062&s=PackSourceEnum_AWEME_DETAIL&sc=image&x-expires=1770000000",
      },
    ]);
  });
});
