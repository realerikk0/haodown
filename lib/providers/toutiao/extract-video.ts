import { ApiError } from "@/lib/errors";
import type { ExtractSuccessResult, VideoFormat, WatermarkStatus } from "@/lib/models";
import { withBrowserPage } from "@/lib/browser";
import type { ExtractionContext } from "@/lib/providers/types";

interface RawVideoMeta {
  definition?: string;
  vwidth?: number;
  vheight?: number;
  bitrate?: number;
  real_bitrate?: number;
}

interface RawVideoFormat {
  main_url?: string;
  backup_url?: string;
  video_meta?: RawVideoMeta;
}

interface RawVideoPlayInfo {
  video_duration?: number;
  fallback_api?: {
    fallback_api?: string;
  };
  video_list?: RawVideoFormat[];
}

interface RawInitialVideo {
  title?: string;
  poster?: string;
  coverUrl?: string;
  group_id?: string;
  groupId?: string;
  publishTime?: number;
  videoPlayInfo?: RawVideoPlayInfo;
}

interface RawToutiaoVideoState {
  data?: {
    initialVideo?: RawInitialVideo;
  };
}

interface VideoPagePayload {
  title: string;
  poster: string | null;
  ldJsonText: string | null;
  scriptPayload: string | null;
  html: string;
  mediaUrls: string[];
  domFormats: VideoFormat[];
}

function collectStateCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  const candidates = [trimmed];

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    candidates.push(trimmed.slice(1, -1));
  }

  const directJsonMatch = trimmed.match(/(\{.*"initialVideo".*\})/s);
  if (directJsonMatch?.[1]) {
    candidates.push(directJsonMatch[1]);
  }

  const encodedJsonMatch = trimmed.match(/(%7B.*(?:initialVideo|videoPlayInfo|video_list).*%7D)/is);
  if (encodedJsonMatch?.[1]) {
    candidates.push(encodedJsonMatch[1]);
  }

  for (const candidate of [...candidates]) {
    if (/%[0-9A-Fa-f]{2}/.test(candidate)) {
      try {
        candidates.push(decodeURIComponent(candidate));
      } catch {
        // Ignore malformed URI sequences and continue trying other candidates.
      }
    }
  }

  return candidates;
}

function parsePossiblyEncodedJson(raw: string): RawToutiaoVideoState {
  for (const candidate of collectStateCandidates(raw)) {
    try {
      return JSON.parse(candidate) as RawToutiaoVideoState;
    } catch {
      // Keep trying additional candidates extracted from the script content.
    }
  }

  throw new ApiError(
    "EXTRACT_FAILED",
    "Unable to parse Toutiao video state payload.",
    502,
  );
}

function sanitizeTitle(title: string) {
  return title.replace(/\s+-\s+今日头条$/, "").trim();
}

function parseDurationSeconds(ldJsonText: string | null) {
  if (!ldJsonText) {
    return null;
  }

  try {
    const data = JSON.parse(ldJsonText) as {
      duration?: string;
    };
    const duration = data.duration ?? "";
    const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/i);
    if (!match) {
      return null;
    }

    const minutes = Number.parseInt(match[1] ?? "0", 10);
    const seconds = Number.parseInt(match[2] ?? "0", 10);
    return minutes * 60 + seconds;
  } catch {
    return null;
  }
}

function inferWatermarkFromUrl(url: string): WatermarkStatus {
  if (url.includes("unwatermarked") || url.includes("logo_type=unwatermarked")) {
    return "none";
  }

  return "unknown";
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

export function mapVideoFormats(videoList: RawVideoFormat[]): VideoFormat[] {
  const mapped: Array<VideoFormat | null> = videoList.map((item) => {
    const url = item.main_url ?? item.backup_url ?? "";
    const width = item.video_meta?.vwidth ?? null;
    const height = item.video_meta?.vheight ?? null;
    const bitrate = item.video_meta?.real_bitrate ?? item.video_meta?.bitrate ?? null;

    if (!url) {
      return null;
    }

    return {
      definition: item.video_meta?.definition ?? "unknown",
      width,
      height,
      bitrate,
      url,
      watermark: inferWatermarkFromUrl(url),
    } satisfies VideoFormat;
  });

  const filtered: VideoFormat[] = mapped.filter(
    (item): item is VideoFormat => item !== null,
  );

  return filtered.sort((left, right) => {
    const heightDelta = (right.height ?? 0) - (left.height ?? 0);
    if (heightDelta !== 0) {
      return heightDelta;
    }

    return (right.bitrate ?? 0) - (left.bitrate ?? 0);
  });
}

function fallbackFormatsFromMediaUrls(mediaUrls: string[]): VideoFormat[] {
  const seen = new Set<string>();

  const mapped: Array<VideoFormat | null> = mediaUrls
    .map((url) => {
      const dedupeKey = url.split("?")[0];
      if (seen.has(dedupeKey)) {
        return null;
      }
      seen.add(dedupeKey);

      const bitrate = extractNumericQueryParam(url, "br");
      return {
        definition: bitrate ? `${bitrate} kbps` : "auto",
        width: null,
        height: null,
        bitrate,
        url,
        watermark: inferWatermarkFromUrl(url),
      } satisfies VideoFormat;
    });

  const formats = mapped.filter((item): item is VideoFormat => item !== null);

  return formats.sort((left, right) => (right.bitrate ?? 0) - (left.bitrate ?? 0));
}

function fallbackFormatsFromDom(domFormats: VideoFormat[]): VideoFormat[] {
  return [...domFormats].sort((left, right) => {
    const heightDelta = (right.height ?? 0) - (left.height ?? 0);
    if (heightDelta !== 0) {
      return heightDelta;
    }

    return (right.bitrate ?? 0) - (left.bitrate ?? 0);
  });
}

function fallbackFormatsFromHtml(html: string): VideoFormat[] {
  const regex =
    /https:\/\/[^"'\\s<>]+toutiaovod\.com[^"'\\s<>]*(?:video\/tos|mime_type=video_mp4)[^"'\\s<>]*/gi;
  const matches = html.match(regex) ?? [];

  return fallbackFormatsFromMediaUrls(matches);
}

function deriveWatermark(
  bestFormat: VideoFormat,
  videoPlayInfo: RawVideoPlayInfo | undefined,
): WatermarkStatus {
  if (bestFormat.watermark === "none") {
    return "none";
  }

  if (videoPlayInfo?.fallback_api?.fallback_api?.includes("unwatermarked")) {
    return "none";
  }

  return "unknown";
}

async function collectVideoPagePayload(
  canonicalUrl: string,
): Promise<VideoPagePayload> {
  return withBrowserPage(async (page) => {
    const mediaUrls = new Set<string>();

    page.on("response", (response) => {
      const url = response.url();
      if (
        url.includes("toutiaovod.com") &&
        (url.includes("video/tos") || url.includes("mime_type=video_mp4"))
      ) {
        mediaUrls.add(url);
      }
    });

    await page.goto(canonicalUrl, { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => {
        const hasScriptState = Array.from(document.scripts).some((element) => {
          const content = element.textContent ?? "";
          return (
            content.includes("initialVideo") ||
            content.includes("%22initialVideo%22") ||
            content.includes("videoPlayInfo") ||
            content.includes("%22videoPlayInfo%22") ||
            content.includes("video_list") ||
            content.includes("%22video_list%22")
          );
        });

        const hasPlayerTitle = Boolean(document.querySelector(".ttp-video-extras-title"));
        const hasVideoElement = Boolean(document.querySelector("video"));

        return hasScriptState || hasPlayerTitle || hasVideoElement;
      },
      { timeout: 15_000 },
    ).catch(() => null);

    await page.evaluate(() => {
      const video = document.querySelector("video");
      if (video instanceof HTMLVideoElement) {
        video.muted = true;
        void video.play().catch(() => undefined);
      }

      const playButton = document.querySelector(".xg-icon-play");
      if (playButton instanceof HTMLElement) {
        playButton.click();
      }
    });

    await page.waitForFunction(
      () => {
        return Array.from(document.querySelectorAll("video")).some((video) => {
          return video instanceof HTMLVideoElement && Boolean(video.currentSrc || video.src);
        });
      },
      { timeout: 8_000 },
    ).catch(() => null);

    await new Promise((resolve) => setTimeout(resolve, 2_000));

    const payload = await page.evaluate(() => {
      const title = document.title || "Untitled Toutiao video";
      const poster =
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content") ?? null;
      const playerPoster =
        document.querySelector("video")?.getAttribute("poster") ?? null;
      const ldJsonText =
        document
          .querySelector('script[type="application/ld+json"]')
          ?.textContent ?? null;

      const scriptPayload =
        Array.from(document.scripts)
          .map((element) => element.textContent ?? "")
          .find((content) => {
            return (
              content.includes("initialVideo") ||
              content.includes("%22initialVideo%22") ||
              content.includes("videoPlayInfo") ||
              content.includes("%22videoPlayInfo%22") ||
              content.includes("video_list") ||
              content.includes("%22video_list%22")
            );
          }) ?? null;

      const html = document.documentElement.outerHTML;
      const domFormats = Array.from(document.querySelectorAll("video"))
        .flatMap((video) => {
          if (!(video instanceof HTMLVideoElement)) {
            return [];
          }

          const url = video.currentSrc || video.src;
          if (!url) {
            return [];
          }

          const bitrate = (() => {
            try {
              const value = new URL(url).searchParams.get("br");
              if (!value) {
                return null;
              }

              const parsed = Number.parseInt(value, 10);
              return Number.isFinite(parsed) ? parsed : null;
            } catch {
              return null;
            }
          })();

          const height = video.videoHeight || null;
          const width = video.videoWidth || null;

          return [
            {
              definition: height ? `${height}p` : bitrate ? `${bitrate} kbps` : "auto",
              width,
              height,
              bitrate,
              url,
              watermark:
                url.includes("unwatermarked") || url.includes("logo_type=unwatermarked")
                  ? "none"
                  : "unknown",
            } satisfies VideoFormat,
          ];
        });

      return {
        title,
        poster: playerPoster || poster,
        ldJsonText,
        scriptPayload,
        html,
        domFormats,
      };
    });

    return {
      ...payload,
      mediaUrls: [...mediaUrls],
    };
  });
}

export async function extractToutiaoVideo(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const payload = await collectVideoPagePayload(context.canonicalUrl);

  const state = payload.scriptPayload ? parsePossiblyEncodedJson(payload.scriptPayload) : null;
  const initialVideo = state?.data?.initialVideo;
  const videoPlayInfo = initialVideo?.videoPlayInfo;
  const scriptedFormats = mapVideoFormats(videoPlayInfo?.video_list ?? []);
  const domFormats = fallbackFormatsFromDom(payload.domFormats);
  const responseFormats = fallbackFormatsFromMediaUrls(payload.mediaUrls);
  const htmlFormats = fallbackFormatsFromHtml(payload.html);
  const formats =
    scriptedFormats.length > 0
      ? scriptedFormats
      : domFormats.length > 0
        ? domFormats
        : responseFormats.length > 0
          ? responseFormats
          : htmlFormats;
  const bestFormat = formats[0];

  if (!bestFormat) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Toutiao video formats could not be extracted.",
      502,
    );
  }

  const watermark = deriveWatermark(bestFormat, videoPlayInfo);
  const title = sanitizeTitle(initialVideo?.title ?? payload.title);

  return {
    ok: true,
    platform: "toutiao",
    contentType: "video",
    canonicalUrl: context.canonicalUrl,
    title: title || "Untitled Toutiao video",
    id: context.id,
    capabilities: {
      supportsShareText: true,
      supportsDirectUrl: true,
      contentTypes: ["video", "gallery"],
      unwatermarkedVideo: "best-effort",
      multiFormatVideo: true,
      originalImages: true,
    },
    limitations: [
      "Signed media URLs may expire and should be refreshed by calling the API again.",
      ...(scriptedFormats.length === 0
        ? [
            domFormats.length > 0
              ? "The page did not expose full quality metadata, so the API fell back to the live player source."
              : responseFormats.length > 0
                ? "The page did not expose full quality metadata, so the API fell back to captured playback URLs."
                : "The page did not expose full quality metadata, so the API returned the best playable source it could detect.",
          ]
        : []),
    ],
    video: {
      best: {
        ...bestFormat,
        watermark,
      },
      formats: formats.map((format) => ({
        ...format,
        watermark:
          format.watermark === "none" ? "none" : watermark === "none" ? "none" : "unknown",
      })),
      watermark,
      quality: bestFormat.definition,
      durationSeconds:
        videoPlayInfo?.video_duration ?? parseDurationSeconds(payload.ldJsonText),
      poster: initialVideo?.poster ?? initialVideo?.coverUrl ?? payload.poster,
    },
    platformMeta: {
      publishTime: initialVideo?.publishTime ?? null,
      source: "toutiao",
      extractionMode:
        scriptedFormats.length > 0
          ? "page-state"
          : domFormats.length > 0
            ? "video-element"
            : responseFormats.length > 0
              ? "captured-media-url"
              : "html-scan",
    },
  };
}
