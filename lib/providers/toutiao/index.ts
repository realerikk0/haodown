import { ApiError } from "@/lib/errors";
import type { ExtractSuccessResult, ResolvedMediaTarget } from "@/lib/models";
import { extractToutiaoGallery } from "@/lib/providers/toutiao/extract-gallery";
import { extractToutiaoVideo } from "@/lib/providers/toutiao/extract-video";
import {
  followRedirects,
  isToutiaoHost,
  normalizeToutiaoTarget,
  TOUTIAO_HOSTS,
} from "@/lib/providers/toutiao/shared";
import type { ExtractionContext, Provider } from "@/lib/providers/types";

async function resolveToutiaoUrl(input: URL): Promise<ResolvedMediaTarget> {
  const { finalUrl } = await followRedirects(input);
  const normalized = normalizeToutiaoTarget(finalUrl);

  if (!normalized) {
    throw new ApiError(
      "RESOLVE_FAILED",
      "The Toutiao URL did not resolve to a supported video or gallery page.",
      400,
    );
  }

  return {
    platform: "toutiao",
    originalUrl: input.toString(),
    canonicalUrl: normalized.canonicalUrl,
    contentType: normalized.contentType,
    id: normalized.id,
    url: new URL(normalized.canonicalUrl),
  };
}

async function extractToutiao(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  if (context.contentType === "video") {
    return extractToutiaoVideo(context);
  }

  return extractToutiaoGallery(context);
}

export const toutiaoProvider: Provider = {
  descriptor: {
    platform: "toutiao",
    displayName: "Toutiao",
    enabled: true,
    supportedUrlHosts: TOUTIAO_HOSTS,
    capabilities: {
      supportsShareText: true,
      supportsDirectUrl: true,
      contentTypes: ["video", "gallery"],
      unwatermarkedVideo: "best-effort",
      multiFormatVideo: true,
      originalImages: true,
    },
    limitations: [
      "Signed media URLs are short-lived and must be refreshed when they expire.",
    ],
  },
  match(input: URL) {
    return isToutiaoHost(input.hostname);
  },
  resolve: resolveToutiaoUrl,
  extract: extractToutiao,
};
