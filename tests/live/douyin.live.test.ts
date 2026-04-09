import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/extract/route";

const describeLive =
  process.env.LIVE_DOUYIN_TESTS === "1" ? describe : describe.skip;

describeLive("Douyin live extraction", () => {
  it("extracts a downloadable no-watermark video link", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "https://v.douyin.com/zDy0SyBc-d8/",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      ok: boolean;
      platform: string;
      contentType: string;
      video?: { best?: { url?: string; watermark?: string } };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.platform).toBe("douyin");
    expect(body.contentType).toBe("video");
    expect(body.video?.best?.watermark).toBe("none");
    expect(body.video?.best?.url).toContain("douyinvod.com");
  });

  it("extracts note images", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "https://v.douyin.com/LsoO5HmemgM/",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      ok: boolean;
      platform: string;
      contentType: string;
      images?: Array<{ url: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.platform).toBe("douyin");
    expect(body.contentType).toBe("gallery");
    expect((body.images?.length ?? 0) > 0).toBe(true);
    expect(body.images?.[0]?.url).toContain("douyinpic.com");
  });
});
