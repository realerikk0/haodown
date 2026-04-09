import { ApiError } from "@/lib/errors";
import type { ExtractSuccessResult, ResolvedMediaTarget } from "@/lib/models";
import { extractDouyinGallery } from "@/lib/providers/douyin/extract-gallery";
import { extractDouyinVideo } from "@/lib/providers/douyin/extract-video";
import {
  DOUYIN_CAPABILITIES,
  DOUYIN_HOSTS,
  DOUYIN_LIMITATIONS,
  followDouyinRedirects,
  isDouyinHost,
  normalizeDouyinTarget,
} from "@/lib/providers/douyin/shared";
import type { ExtractionContext, Provider } from "@/lib/providers/types";

async function resolveDouyinUrl(input: URL): Promise<ResolvedMediaTarget> {
  const { finalUrl } = await followDouyinRedirects(input);
  const normalized = normalizeDouyinTarget(finalUrl);

  if (!normalized) {
    throw new ApiError(
      "RESOLVE_FAILED",
      "The Douyin URL did not resolve to a supported video or gallery page.",
      400,
    );
  }

  return {
    platform: "douyin",
    originalUrl: input.toString(),
    canonicalUrl: normalized.canonicalUrl,
    contentType: normalized.contentType,
    id: normalized.id,
    url: new URL(normalized.canonicalUrl),
  };
}

async function extractDouyin(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  if (context.contentType === "video") {
    return extractDouyinVideo(context);
  }

  return extractDouyinGallery(context);
}

export const douyinProvider: Provider = {
  descriptor: {
    platform: "douyin",
    displayName: "Douyin",
    enabled: true,
    supportedUrlHosts: DOUYIN_HOSTS,
    capabilities: DOUYIN_CAPABILITIES,
    limitations: DOUYIN_LIMITATIONS,
  },
  match(input: URL) {
    return isDouyinHost(input.hostname);
  },
  resolve: resolveDouyinUrl,
  extract: extractDouyin,
};
