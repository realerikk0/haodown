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

    await page.goto(canonicalUrl, { waitUntil: "domcontentloaded" });

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

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await extractDouyinVideoOnce(context);
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.code !== "EXTRACT_FAILED") {
        throw error;
      }
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
