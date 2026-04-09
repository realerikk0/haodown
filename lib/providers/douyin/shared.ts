import type { PlatformCapabilities } from "@/lib/models";

import { ApiError } from "@/lib/errors";

export const DOUYIN_HOSTS = [
  "v.douyin.com",
  "www.douyin.com",
  "douyin.com",
  "www.iesdouyin.com",
  "iesdouyin.com",
];

export const DOUYIN_CAPABILITIES: PlatformCapabilities = {
  supportsShareText: true,
  supportsDirectUrl: true,
  contentTypes: ["video", "gallery"],
  unwatermarkedVideo: "best-effort",
  multiFormatVideo: true,
  originalImages: true,
};

export const DOUYIN_LIMITATIONS = [
  "Signed media URLs are short-lived and must be refreshed when they expire.",
];

export const DOUYIN_WEB_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36";

export const DOUYIN_WEB_REFERER = "https://www.douyin.com/";

export const DOUYIN_WEB_ACCEPT_LANGUAGE =
  "zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2";

export function isDouyinHost(hostname: string): boolean {
  return (
    DOUYIN_HOSTS.includes(hostname) ||
    hostname.endsWith(".douyin.com") ||
    hostname.endsWith(".iesdouyin.com")
  );
}

export async function followDouyinRedirects(
  input: URL,
  maxHops = 6,
): Promise<{ finalUrl: URL; chain: string[] }> {
  let currentUrl = new URL(input.toString());
  const chain = [currentUrl.toString()];

  for (let index = 0; index < maxHops; index += 1) {
    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      },
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ApiError(
          "RESOLVE_FAILED",
          "Redirect response is missing Location header.",
          502,
        );
      }

      currentUrl = new URL(location, currentUrl);
      chain.push(currentUrl.toString());
      continue;
    }

    return { finalUrl: currentUrl, chain };
  }

  throw new ApiError("RESOLVE_FAILED", "Too many redirects while resolving URL.");
}

export function normalizeDouyinTarget(
  input: URL,
): { canonicalUrl: string; contentType: "video" | "gallery"; id: string } | null {
  const videoMatch = input.pathname.match(/^\/(?:share\/)?video\/(\d+)\/?$/);
  if (videoMatch) {
    const id = videoMatch[1];
    return {
      canonicalUrl: `https://www.douyin.com/video/${id}`,
      contentType: "video",
      id,
    };
  }

  const galleryMatch = input.pathname.match(/^\/(?:share\/)?note\/(\d+)\/?$/);
  if (galleryMatch) {
    const id = galleryMatch[1];
    return {
      canonicalUrl: `https://www.douyin.com/note/${id}`,
      contentType: "gallery",
      id,
    };
  }

  return null;
}
