import { ApiError } from "@/lib/errors";

export const TOUTIAO_HOSTS = ["m.toutiao.com", "www.toutiao.com", "toutiao.com"];

export function isToutiaoHost(hostname: string): boolean {
  return TOUTIAO_HOSTS.includes(hostname) || hostname.endsWith(".toutiao.com");
}

export async function followRedirects(
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

export function normalizeToutiaoTarget(
  input: URL,
): { canonicalUrl: string; contentType: "video" | "gallery"; id: string } | null {
  const videoMatch = input.pathname.match(/^\/video\/(\d+)\/?$/);
  if (videoMatch) {
    const id = videoMatch[1];
    return {
      canonicalUrl: `https://www.toutiao.com/video/${id}/`,
      contentType: "video",
      id,
    };
  }

  const galleryMatch = input.pathname.match(/^\/w\/(\d+)\/?$/);
  if (galleryMatch) {
    const id = galleryMatch[1];
    return {
      canonicalUrl: `https://www.toutiao.com/w/${id}/`,
      contentType: "gallery",
      id,
    };
  }

  return null;
}
