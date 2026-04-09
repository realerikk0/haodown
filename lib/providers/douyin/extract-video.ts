import { ApiError } from "@/lib/errors";
import { withBrowserPage } from "@/lib/browser";
import type { ExtractSuccessResult, VideoFormat } from "@/lib/models";
import {
  DOUYIN_CAPABILITIES,
  DOUYIN_LIMITATIONS,
} from "@/lib/providers/douyin/shared";
import type { ExtractionContext } from "@/lib/providers/types";

interface RawUrlListAsset {
  url_list?: string[];
  width?: number;
  height?: number;
}

interface RawBitRate {
  gear_name?: string;
  bit_rate?: number;
  play_addr?: RawUrlListAsset;
  is_bytevc1?: number;
}

interface RawCoverAsset {
  url_list?: string[];
}

interface RawVideoPayload {
  duration?: number;
  ratio?: string;
  play_addr?: RawUrlListAsset;
  play_addr_h264?: RawUrlListAsset;
  bit_rate?: RawBitRate[];
  cover?: RawCoverAsset;
  origin_cover?: RawCoverAsset;
  dynamic_cover?: RawCoverAsset;
}

interface RawAwemeDetail {
  aweme_id?: string;
  desc?: string;
  video?: RawVideoPayload;
}

interface RawDetailResponse {
  aweme_detail?: RawAwemeDetail;
}

interface VideoPagePayload {
  title: string;
  currentSrc: string | null;
  poster: string | null;
  detail: RawDetailResponse | null;
  mediaUrls: string[];
}

interface MobileShareVideoPayload {
  title: string;
  poster: string | null;
  playwmUrl: string | null;
  awemeDetail: RawAwemeDetail | null;
}

function isNavigationTimeoutError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes("navigation timeout")
  );
}

function sanitizeTitle(title: string) {
  return title.replace(/\s*-\s*抖音$/, "").trim();
}

function firstUrl(asset?: RawUrlListAsset | RawCoverAsset | null): string | null {
  return asset?.url_list?.find(Boolean) ?? null;
}

function extractNumericQueryParam(url: string, key: string) {
  try {
    const value = new URL(url).searchParams.get(key);
    if (!value) {
      return null;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractDefinitionRank(definition: string) {
  const match = definition.match(/(\d{3,4})p/i);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function isPlayableDouyinVideoUrl(url: string | null | undefined) {
  if (!url) {
    return false;
  }

  return (
    url.includes("douyinvod.com") &&
    (url.includes("mime_type=video_mp4") || url.includes("/video/tos/"))
  );
}

function extractDefinition(gearName?: string, height?: number | null, ratio?: string) {
  if (height) {
    return `${height}p`;
  }

  const gearMatch = gearName?.match(/(\d{3,4})/);
  if (gearMatch?.[1]) {
    return `${gearMatch[1]}p`;
  }

  if (ratio) {
    return ratio;
  }

  return "unknown";
}

export function mapDouyinVideoFormats(
  bitRates: RawBitRate[],
  ratio?: string,
): VideoFormat[] {
  const formats = bitRates.reduce<VideoFormat[]>((accumulator, item) => {
      const url = firstUrl(item.play_addr);
      if (!url) {
        return accumulator;
      }

      const width = item.play_addr?.width ?? null;
      const height = item.play_addr?.height ?? null;

      accumulator.push({
        definition: extractDefinition(item.gear_name, height, ratio),
        width,
        height,
        bitrate: item.bit_rate ?? null,
        url,
        watermark: "none",
      });

      return accumulator;
    }, []);

  return formats.sort((left, right) => {
    const heightDelta = (right.height ?? 0) - (left.height ?? 0);
    if (heightDelta !== 0) {
      return heightDelta;
    }

    return (right.bitrate ?? 0) - (left.bitrate ?? 0);
  });
}

function fallbackFormatsFromMediaUrls(mediaUrls: string[]): VideoFormat[] {
  const seen = new Set<string>();
  const formats: VideoFormat[] = [];

  for (const mediaUrl of mediaUrls) {
    const url = mediaUrl.replace(/&amp;/g, "&");
    if (!isPlayableDouyinVideoUrl(url)) {
      continue;
    }

    const dedupeKey = url.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    const bitrate = extractNumericQueryParam(url, "br");

    formats.push({
      definition: bitrate ? `${bitrate} kbps` : "auto",
      width: null,
      height: null,
      bitrate,
      url,
      watermark: "none",
    });
  }

  return formats.sort((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0));
}

function buildDouyinShareVideoUrl(id: string) {
  return `https://www.iesdouyin.com/share/video/${id}/`;
}

function extractDouyinAwemeDetailFromShareHtml(html: string): RawAwemeDetail | null {
  const routerDataMatch = html.match(
    /<script[^>]*>\s*window\._ROUTER_DATA\s*=\s*(\{[\s\S]*?\})\s*<\/script>/i,
  );

  if (!routerDataMatch?.[1]) {
    return null;
  }

  try {
    const routerData = JSON.parse(routerDataMatch[1]) as {
      loaderData?: Record<
        string,
        {
          videoInfoRes?: {
            item_list?: RawAwemeDetail[];
          };
        }
      >;
    };

    return (
      Object.values(routerData.loaderData ?? {})
        .flatMap((entry) => entry.videoInfoRes?.item_list ?? [])
        .find((item) => item.aweme_id) ?? null
    );
  } catch {
    return null;
  }
}

async function collectMobileShareVideoPayload(
  shareUrl: string,
): Promise<MobileShareVideoPayload> {
  const response = await fetch(shareUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  });

  if (!response.ok) {
    return collectMobileShareVideoPayloadFromBrowser(shareUrl);
  }

  const html = await response.text();
  const awemeDetail = extractDouyinAwemeDetailFromShareHtml(html);

  if (!awemeDetail) {
    return collectMobileShareVideoPayloadFromBrowser(shareUrl);
  }

  return {
    title: awemeDetail.desc || "Untitled Douyin video",
    poster:
      firstUrl(awemeDetail.video?.origin_cover) ??
      firstUrl(awemeDetail.video?.cover) ??
      firstUrl(awemeDetail.video?.dynamic_cover),
    playwmUrl: firstUrl(awemeDetail.video?.play_addr),
    awemeDetail,
  };
}

async function collectMobileShareVideoPayloadFromBrowser(
  shareUrl: string,
): Promise<MobileShareVideoPayload> {
  return withBrowserPage(async (page) => {
    await page.setViewport({
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    });
    await page.setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    );

    await page.goto(shareUrl, {
      waitUntil: "domcontentloaded",
      timeout: 18_000,
    });

    const pageHtml = await page.content();
    const shareAwemeDetail = extractDouyinAwemeDetailFromShareHtml(pageHtml);
    if (shareAwemeDetail) {
      return {
        title: shareAwemeDetail.desc || "Untitled Douyin video",
        poster:
          firstUrl(shareAwemeDetail.video?.origin_cover) ??
          firstUrl(shareAwemeDetail.video?.cover) ??
          firstUrl(shareAwemeDetail.video?.dynamic_cover),
        playwmUrl: firstUrl(shareAwemeDetail.video?.play_addr),
        awemeDetail: shareAwemeDetail,
      };
    }

    await page.waitForFunction(
      () => {
        const video = document.querySelector("video");
        const routerData = (window as Window & { _ROUTER_DATA?: unknown })
          ._ROUTER_DATA as
          | {
              loaderData?: Record<
                string,
                {
                  videoInfoRes?: {
                    item_list?: Array<{ aweme_id?: string }>;
                  };
                }
              >;
            }
          | undefined;
        const hasRouterData = Object.values(routerData?.loaderData ?? {}).some(
          (entry) => (entry.videoInfoRes?.item_list?.length ?? 0) > 0,
        );

        return (
          (video instanceof HTMLVideoElement &&
            Boolean(video.currentSrc || video.src)) ||
          hasRouterData
        );
      },
      { timeout: 12_000 },
    );

    return page.evaluate(() => {
      const video = document.querySelector("video");
      const routerData = (window as Window & { _ROUTER_DATA?: unknown })
        ._ROUTER_DATA as
        | {
            loaderData?: Record<
              string,
              {
                videoInfoRes?: {
                  item_list?: Array<{
                    aweme_id?: string;
                    desc?: string;
                    video?: {
                      duration?: number;
                      play_addr?: { url_list?: string[] };
                      cover?: { url_list?: string[] };
                      origin_cover?: { url_list?: string[] };
                      dynamic_cover?: { url_list?: string[] };
                    };
                  }>;
                };
              }
            >;
          }
        | undefined;
      const awemeDetail =
        Object.values(routerData?.loaderData ?? {})
          .flatMap((entry) => entry.videoInfoRes?.item_list ?? [])
          .find((item) => item.aweme_id) ?? null;
      const playwmUrl =
        (video instanceof HTMLVideoElement ? video.currentSrc || video.src : null) ??
        awemeDetail?.video?.play_addr?.url_list?.find(Boolean) ??
        null;
      const poster =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
        (video instanceof HTMLVideoElement ? video.poster || null : null) ??
        awemeDetail?.video?.origin_cover?.url_list?.find(Boolean) ??
        awemeDetail?.video?.cover?.url_list?.find(Boolean) ??
        awemeDetail?.video?.dynamic_cover?.url_list?.find(Boolean) ??
        null;

      return {
        title: awemeDetail?.desc || document.title || "Untitled Douyin video",
        poster,
        playwmUrl,
        awemeDetail,
      };
    });
  });
}

async function resolveDouyinPlayRedirect(
  url: string,
  referer: string,
): Promise<string | null> {
  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    cache: "no-store",
    headers: {
      referer,
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    },
  });

  if (response.status >= 300 && response.status < 400) {
    return response.headers.get("location");
  }

  return null;
}

async function buildFormatsFromPlaywmUrl(
  playwmUrl: string,
  referer: string,
): Promise<VideoFormat[]> {
  const parsed = new URL(playwmUrl);
  const videoId = parsed.searchParams.get("video_id");
  const currentRatio = parsed.searchParams.get("ratio") ?? "720p";
  const line = parsed.searchParams.get("line") ?? "0";

  if (!videoId) {
    return [];
  }

  const candidateDefinitions = Array.from(
    new Set(["1080p", currentRatio, "720p", "540p"]),
  );

  const formats: VideoFormat[] = [];
  const seen = new Set<string>();

  for (const definition of candidateDefinitions) {
    const playUrl = new URL("https://www.iesdouyin.com/aweme/v1/play/");
    playUrl.searchParams.set("video_id", videoId);
    playUrl.searchParams.set("ratio", definition);
    playUrl.searchParams.set("line", line);

    const resolvedUrl = await resolveDouyinPlayRedirect(playUrl.toString(), referer);
    if (!resolvedUrl || !isPlayableDouyinVideoUrl(resolvedUrl)) {
      continue;
    }

    const dedupeKey = resolvedUrl.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    formats.push({
      definition,
      width: null,
      height: null,
      bitrate: extractNumericQueryParam(resolvedUrl, "br"),
      url: resolvedUrl,
      watermark: "none",
    });
  }

  return formats.sort((left, right) => {
    const definitionDelta =
      extractDefinitionRank(right.definition) - extractDefinitionRank(left.definition);
    if (definitionDelta !== 0) {
      return definitionDelta;
    }

    return (right.bitrate ?? 0) - (left.bitrate ?? 0);
  });
}

async function extractDouyinVideoFromMobileShare(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const shareUrl = buildDouyinShareVideoUrl(context.id);
  const payload = await collectMobileShareVideoPayload(shareUrl);
  const formats =
    payload.playwmUrl !== null
      ? await buildFormatsFromPlaywmUrl(payload.playwmUrl, shareUrl)
      : [];

  if (formats.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Douyin mobile share video payload could not be extracted.",
      502,
    );
  }

  const best = formats[0];
  const awemeDetail = payload.awemeDetail;

  return {
    ok: true,
    platform: "douyin",
    contentType: "video",
    canonicalUrl: context.canonicalUrl,
    title: sanitizeTitle(awemeDetail?.desc || payload.title),
    id: awemeDetail?.aweme_id || context.id,
    capabilities: DOUYIN_CAPABILITIES,
    limitations: [
      ...DOUYIN_LIMITATIONS,
      "Douyin video links are signed and may require a fresh extract before downloading later.",
    ],
    video: {
      best,
      formats,
      watermark: best.watermark,
      quality: best.definition,
      durationSeconds: awemeDetail?.video?.duration
        ? Math.round(awemeDetail.video.duration / 1000)
        : null,
      poster: payload.poster,
    },
    platformMeta: {
      source: "douyin",
      extractionMode: awemeDetail ? "mobile-share-data" : "mobile-share-play",
      shareUrl,
    },
  };
}

async function collectVideoPagePayload(
  canonicalUrl: string,
): Promise<VideoPagePayload> {
  return withBrowserPage(async (page) => {
    const mediaUrls = new Set<string>();

    page.on("response", (response) => {
      const url = response.url();
      if (isPlayableDouyinVideoUrl(url)) {
        mediaUrls.add(url);
      }
    });

    const detailResponsePromise = page
      .waitForResponse(
        (response) =>
          response.url().includes("/aweme/v1/web/aweme/detail/") &&
          response.request().method() === "GET",
        { timeout: 20_000 },
      )
      .catch(() => null);

    try {
      await page.goto(canonicalUrl, {
        waitUntil: "domcontentloaded",
        timeout: 18_000,
      });
    } catch (error) {
      if (!isNavigationTimeoutError(error)) {
        throw error;
      }
    }

    await page
      .waitForFunction(
        () =>
          Boolean(document.querySelector("video")) ||
          document.title.includes("抖音"),
        { timeout: 12_000 },
      )
      .catch(() => null);

    await page.evaluate(() => {
      const video = document.querySelector("video");
      if (video instanceof HTMLVideoElement) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }
    });

    await page
      .waitForFunction(
        () => {
          const video = document.querySelector("video");
          return (
            video instanceof HTMLVideoElement &&
            Boolean(video.currentSrc || video.src)
          );
        },
        { timeout: 8_000 },
      )
      .catch(() => null);

    await new Promise((resolve) => setTimeout(resolve, 1_500));

    const detailResponse = await detailResponsePromise;
    const detail = detailResponse
      ? ((await detailResponse.json().catch(() => null)) as RawDetailResponse | null)
      : null;

    const pagePayload = await page.evaluate(() => {
      const video = document.querySelector("video");
      const currentSrc =
        video instanceof HTMLVideoElement ? video.currentSrc || video.src : null;
      const poster =
        document.querySelector('meta[property="og:image"]')?.getAttribute("content") ??
        (video instanceof HTMLVideoElement ? video.poster || null : null);

      return {
        title: document.title || "Untitled Douyin video",
        currentSrc,
        poster,
      };
    });

    return {
      ...pagePayload,
      detail,
      mediaUrls: [...mediaUrls],
    };
  });
}

async function extractDouyinVideoOnce(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const payload = await collectVideoPagePayload(context.canonicalUrl);
  const awemeDetail = payload.detail?.aweme_detail;
  const video = awemeDetail?.video;

  const formats = mapDouyinVideoFormats(video?.bit_rate ?? [], video?.ratio);

  if (formats.length === 0) {
    const fallbackUrl =
      firstUrl(video?.play_addr_h264) ??
      firstUrl(video?.play_addr);

    if (isPlayableDouyinVideoUrl(fallbackUrl)) {
      formats.push({
        definition: extractDefinition(undefined, video?.play_addr_h264?.height, video?.ratio),
        width: video?.play_addr_h264?.width ?? video?.play_addr?.width ?? null,
        height: video?.play_addr_h264?.height ?? video?.play_addr?.height ?? null,
        bitrate: null,
        url: fallbackUrl!,
        watermark: "none",
      });
    }
  }

  if (formats.length === 0) {
    formats.push(...fallbackFormatsFromMediaUrls(payload.mediaUrls));
  }

  if (formats.length === 0 && isPlayableDouyinVideoUrl(payload.currentSrc)) {
    formats.push({
      definition: extractDefinition(undefined, null, video?.ratio),
      width: null,
      height: null,
      bitrate: extractNumericQueryParam(payload.currentSrc!, "br"),
      url: payload.currentSrc!,
      watermark: "none",
    });
  }

  if (formats.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Douyin video payload could not be extracted.",
      502,
    );
  }

  const best = formats[0];
  const poster =
    firstUrl(video?.origin_cover) ??
    firstUrl(video?.cover) ??
    firstUrl(video?.dynamic_cover) ??
    payload.poster;

  return {
    ok: true,
    platform: "douyin",
    contentType: "video",
    canonicalUrl: context.canonicalUrl,
    title: sanitizeTitle(awemeDetail?.desc || payload.title),
    id: awemeDetail?.aweme_id || context.id,
    capabilities: DOUYIN_CAPABILITIES,
    limitations: [
      ...DOUYIN_LIMITATIONS,
      "Douyin video links are signed and may require a fresh extract before downloading later.",
    ],
    video: {
      best,
      formats,
      watermark: best.watermark,
      quality: best.definition,
      durationSeconds: video?.duration ? Math.round(video.duration / 1000) : null,
      poster,
    },
    platformMeta: {
      source: "douyin",
      extractionMode: awemeDetail ? "aweme-detail" : "dom-video",
      ratio: video?.ratio ?? null,
    },
  };
}

export async function extractDouyinVideo(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  let lastError: unknown = null;

  try {
    return await extractDouyinVideoOnce(context);
  } catch (error) {
    lastError = error;
    if (!(error instanceof ApiError) || error.code !== "EXTRACT_FAILED") {
      throw error;
    }
  }

  try {
    return await extractDouyinVideoFromMobileShare(context);
  } catch (error) {
    lastError = error;
    if (!(error instanceof ApiError) || error.code !== "EXTRACT_FAILED") {
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ApiError(
        "EXTRACT_FAILED",
        "Douyin video payload could not be extracted.",
        502,
      );
}
