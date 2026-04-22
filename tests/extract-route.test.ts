import { beforeEach, describe, expect, it, vi } from "vitest";

import { getQuotaDayKey } from "@/lib/auth/quota";

const {
  cookiesMock,
  countAnonymousRequests,
  createSupabaseServerClient,
  ensureProfileForUser,
  findProfileByApiToken,
  getProfileQuotaSnapshot,
  getProviderForUrl,
  isSupabaseConfigured,
  isMissingAuthSessionError,
  recordAnonymousRequestUsage,
  recordProfileRequestUsage,
  readApiTokenFromRequest,
  isAdminApiToken,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  countAnonymousRequests: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  ensureProfileForUser: vi.fn(),
  findProfileByApiToken: vi.fn(),
  getProfileQuotaSnapshot: vi.fn(),
  getProviderForUrl: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  isMissingAuthSessionError: vi.fn(),
  recordAnonymousRequestUsage: vi.fn(),
  recordProfileRequestUsage: vi.fn(),
  readApiTokenFromRequest: vi.fn(),
  isAdminApiToken: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/auth/api-token", () => ({
  findProfileByApiToken,
  isAdminApiToken,
  readApiTokenFromRequest,
}));

vi.mock("@/lib/auth/profile", () => ({
  ensureProfileForUser,
}));

vi.mock("@/lib/auth/usage", () => ({
  countAnonymousRequests,
  getProfileQuotaSnapshot,
  recordAnonymousRequestUsage,
  recordProfileRequestUsage,
}));

vi.mock("@/lib/providers", () => ({
  getProviderForUrl,
}));

vi.mock("@/lib/supabase/auth-errors", () => ({
  isMissingAuthSessionError,
}));

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

import { POST } from "@/app/api/extract/route";

function createCookieStore(
  entries: Record<string, string> = {},
): {
  get: (name: string) => { value: string } | undefined;
  getAll: () => { name: string; value: string }[];
  set: ReturnType<typeof vi.fn>;
} {
  return {
    get(name) {
      const value = entries[name];
      return value ? { value } : undefined;
    },
    getAll() {
      return Object.entries(entries).map(([name, value]) => ({ name, value }));
    },
    set: vi.fn(),
  };
}

const provider = {
  resolve: vi.fn(),
  extract: vi.fn(),
};

const successResult = {
  ok: true as const,
  platform: "douyin" as const,
  contentType: "video" as const,
  canonicalUrl: "https://www.douyin.com/video/123",
  title: "Test Video",
  id: "123",
  capabilities: {
    supportsShareText: true,
    supportsDirectUrl: true,
    contentTypes: ["video"],
    unwatermarkedVideo: "best-effort" as const,
    multiFormatVideo: true,
    originalImages: false,
  },
  limitations: [],
  video: {
    best: {
      definition: "1080p",
      width: 1080,
      height: 1920,
      bitrate: 3200000,
      url: "https://cdn.example.com/video.mp4",
      watermark: "none" as const,
    },
    formats: [],
    watermark: "none" as const,
    quality: "1080p",
    durationSeconds: 10,
    poster: null,
  },
};

describe("/api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue(createCookieStore());
    countAnonymousRequests.mockResolvedValue(0);
    createSupabaseServerClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    });
    ensureProfileForUser.mockResolvedValue(null);
    getProfileQuotaSnapshot.mockResolvedValue({
      usedToday: 0,
      dailyLimit: 5,
      dailyRemaining: 5,
      creditsBalance: 2,
    });
    getProviderForUrl.mockReturnValue(provider);
    isMissingAuthSessionError.mockReturnValue(false);
    isSupabaseConfigured.mockReturnValue(true);
    provider.resolve.mockResolvedValue({
      platform: "douyin",
      originalUrl: "https://v.douyin.com/test",
      canonicalUrl: "https://www.douyin.com/video/123",
      contentType: "video",
      id: "123",
      url: new URL("https://www.douyin.com/video/123"),
    });
    provider.extract.mockResolvedValue(successResult);
    recordAnonymousRequestUsage.mockResolvedValue({
      usedToday: 1,
      dailyLimit: 2,
      dailyRemaining: 1,
    });
    recordProfileRequestUsage.mockResolvedValue({
      usedToday: 1,
      dailyLimit: 5,
      dailyRemaining: 4,
      creditsBalance: 1,
      consumedCredit: false,
    });
    readApiTokenFromRequest.mockReturnValue(null);
    isAdminApiToken.mockReturnValue(false);
    findProfileByApiToken.mockResolvedValue(null);
  });

  it("prefers bearer token auth and records shortcut metadata", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_test");
    findProfileByApiToken.mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      credits_balance: 2,
    });

    const response = await POST(
      new Request("https://haodown.test/api/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer hd_test",
        },
        body: JSON.stringify({
          text: "看看这个 https://v.douyin.com/test/",
          anonymousSessionId: "5c8de1d8-aa32-49aa-9ef0-df341fa34fcb",
          client: {
            shortcutVersion: "1.0.0",
            inputSource: "clipboard",
          },
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(recordProfileRequestUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "user-1",
        metadata: expect.objectContaining({
          platform: "douyin",
          contentType: "video",
          shortcutVersion: "1.0.0",
          inputSource: "clipboard",
          creditsBalanceBeforeRequest: 2,
        }),
      }),
    );
    expect(recordAnonymousRequestUsage).not.toHaveBeenCalled();
    expect(countAnonymousRequests).not.toHaveBeenCalled();
  });

  it("allows admin token requests without quota checks or usage deduction", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_admin_test");
    isAdminApiToken.mockReturnValue(true);

    const response = await POST(
      new Request("https://haodown.test/api/extract?code=hd_admin_test", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "https://v.douyin.com/test/",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(findProfileByApiToken).not.toHaveBeenCalled();
    expect(getProfileQuotaSnapshot).not.toHaveBeenCalled();
    expect(countAnonymousRequests).not.toHaveBeenCalled();
    expect(recordProfileRequestUsage).not.toHaveBeenCalled();
    expect(recordAnonymousRequestUsage).not.toHaveBeenCalled();
  });

  it("accepts api token from query param code", async () => {
    readApiTokenFromRequest.mockReturnValue("hd_query");
    findProfileByApiToken.mockResolvedValue({
      id: "user-2",
      email: "query@example.com",
      credits_balance: 4,
    });

    const response = await POST(
      new Request("https://haodown.test/api/extract?code=hd_query", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "https://v.douyin.com/test/",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(findProfileByApiToken).toHaveBeenCalledWith("hd_query");
    expect(recordProfileRequestUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "user-2",
      }),
    );
    expect(recordAnonymousRequestUsage).not.toHaveBeenCalled();
  });

  it("uses explicit anonymousSessionId without setting cookies", async () => {
    const response = await POST(
      new Request("https://haodown.test/api/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "https://v.douyin.com/test/",
          anonymousSessionId: "2bb6978f-fdb2-4ac4-9156-662c3f3e4fe6",
          client: {
            shortcutVersion: "1.0.0",
            inputSource: "manual",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(countAnonymousRequests).toHaveBeenCalledWith(
      "2bb6978f-fdb2-4ac4-9156-662c3f3e4fe6",
      0,
    );
    expect(recordAnonymousRequestUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymousSessionId: "2bb6978f-fdb2-4ac4-9156-662c3f3e4fe6",
        metadata: expect.objectContaining({
          shortcutVersion: "1.0.0",
          inputSource: "manual",
        }),
      }),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps cookie-backed anonymous flow for web requests", async () => {
    cookiesMock.mockResolvedValue(
      createCookieStore({
        "haodown-anon-session": "4059951a-b379-42bd-9d29-668d5d8a4888",
        "haodown-anon-usage": `${getQuotaDayKey()}:1`,
      }),
    );

    const response = await POST(
      new Request("https://haodown.test/api/extract", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          text: "https://v.douyin.com/test/",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(countAnonymousRequests).toHaveBeenCalledWith(
      "4059951a-b379-42bd-9d29-668d5d8a4888",
      1,
    );
    expect(response.headers.get("set-cookie")).toContain(
      "haodown-anon-session=",
    );
  });
});
