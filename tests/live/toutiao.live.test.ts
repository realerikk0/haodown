import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/extract/route";

const describeLive =
  process.env.LIVE_TOUTIAO_TESTS === "1" ? describe : describe.skip;

describeLive("Toutiao live extraction", () => {
  it("extracts best available video formats", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "https://m.toutiao.com/is/RICcKIVG_oc/",
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as {
      ok: boolean;
      platform: string;
      contentType: string;
      video?: { best?: { definition?: string } };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.platform).toBe("toutiao");
    expect(body.contentType).toBe("video");
    expect(body.video?.best?.definition).toBe("1080p");
  });

  it("extracts original gallery images", async () => {
    const request = new Request("http://localhost/api/extract", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: "https://m.toutiao.com/is/JS6MXZTs2vA/",
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
    expect(body.platform).toBe("toutiao");
    expect(body.contentType).toBe("gallery");
    expect((body.images?.length ?? 0) > 0).toBe(true);
  });
});
