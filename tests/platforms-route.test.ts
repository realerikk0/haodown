import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/platforms/route";

describe("/api/platforms", () => {
  it("returns enabled providers", async () => {
    const response = await GET();
    const body = (await response.json()) as { ok: boolean; platforms: unknown[] };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.platforms).toHaveLength(1);
  });
});
