import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/errors";

const {
  findProfileByApiToken,
  readApiTokenFromRequest,
  getProfileQuotaSnapshot,
} = vi.hoisted(() => ({
  findProfileByApiToken: vi.fn(),
  readApiTokenFromRequest: vi.fn(),
  getProfileQuotaSnapshot: vi.fn(),
}));

vi.mock("@/lib/auth/api-token", () => ({
  findProfileByApiToken,
  readApiTokenFromRequest,
}));

vi.mock("@/lib/auth/usage", () => ({
  getProfileQuotaSnapshot,
}));

import { POST } from "@/app/api/shortcut/verify-token/route";
import type { ShortcutTokenVerificationResult } from "@/lib/models";

describe("/api/shortcut/verify-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns quota info for a valid bearer token", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_test");
    findProfileByApiToken.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      credits_balance: 3,
    });
    getProfileQuotaSnapshot.mockResolvedValue({
      usedToday: 2,
      dailyLimit: 5,
      dailyRemaining: 3,
      creditsBalance: 3,
    });

    const response = await POST(
      new Request("https://haodown.test/api/shortcut/verify-token", {
        method: "POST",
        headers: {
          authorization: "Bearer hd_test",
        },
      }),
    );
    const body = (await response.json()) as ShortcutTokenVerificationResult;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      email: "owner@example.com",
      dailyLimit: 5,
      dailyRemaining: 3,
      creditsBalance: 3,
    });
  });

  it("returns unauthorized when the token is missing", async () => {
    readApiTokenFromRequest.mockReturnValue(null);

    const response = await POST(
      new Request("https://haodown.test/api/shortcut/verify-token", {
        method: "POST",
      }),
    );
    const body = (await response.json()) as {
      ok: false;
      code: string;
      message: string;
    };

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      ok: false,
      code: "UNAUTHORIZED",
    });
  });

  it("surfaces unauthorized errors from token lookup", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_bad");
    findProfileByApiToken.mockRejectedValue(
      new ApiError("UNAUTHORIZED", "API Token 无效或已失效。", 401),
    );

    const response = await POST(
      new Request("https://haodown.test/api/shortcut/verify-token", {
        method: "POST",
        headers: {
          authorization: "Bearer hd_bad",
        },
      }),
    );
    const body = (await response.json()) as {
      ok: false;
      code: string;
      message: string;
    };

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("accepts token from query param code", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_query");
    findProfileByApiToken.mockResolvedValue({
      id: "user-2",
      email: "query@example.com",
      credits_balance: 1,
    });
    getProfileQuotaSnapshot.mockResolvedValue({
      usedToday: 1,
      dailyLimit: 5,
      dailyRemaining: 4,
      creditsBalance: 1,
    });

    const response = await POST(
      new Request("https://haodown.test/api/shortcut/verify-token?code=hd_query", {
        method: "POST",
      }),
    );
    const body = (await response.json()) as ShortcutTokenVerificationResult;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(findProfileByApiToken).toHaveBeenCalledWith("hd_query");
  });
});
