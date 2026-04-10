import { ApiError } from "@/lib/errors";
import type { ExtractSuccessResult, ResolvedMediaTarget } from "@/lib/models";
import { extractXiaohongshuGallery } from "@/lib/providers/xiaohongshu/extract-gallery";
import { extractXiaohongshuVideo } from "@/lib/providers/xiaohongshu/extract-video";
import {
  followXiaohongshuRedirects,
  isXiaohongshuHost,
  loadXiaohongshuNote,
  normalizeXiaohongshuTarget,
  XIAOHONGSHU_CAPABILITIES,
  XIAOHONGSHU_HOSTS,
  XIAOHONGSHU_LIMITATIONS,
} from "@/lib/providers/xiaohongshu/shared";
import type { ExtractionContext, Provider } from "@/lib/providers/types";

async function resolveXiaohongshuUrl(input: URL): Promise<ResolvedMediaTarget> {
  const { finalUrl } = await followXiaohongshuRedirects(input);
  const normalized = normalizeXiaohongshuTarget(finalUrl);

  if (!normalized) {
    throw new ApiError(
      "RESOLVE_FAILED",
      "The Xiaohongshu URL did not resolve to a supported note page.",
      400,
    );
  }

  return {
    platform: "xiaohongshu",
    originalUrl: input.toString(),
    canonicalUrl: normalized.canonicalUrl,
    contentType: normalized.contentType,
    id: normalized.id,
    url: finalUrl,
  };
}

async function extractXiaohongshu(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const note = await loadXiaohongshuNote(context.url);

  if (note.type === "video") {
    return extractXiaohongshuVideo(context, note);
  }

  return extractXiaohongshuGallery(context, note);
}

export const xiaohongshuProvider: Provider = {
  descriptor: {
    platform: "xiaohongshu",
    displayName: "Xiaohongshu",
    enabled: true,
    supportedUrlHosts: XIAOHONGSHU_HOSTS,
    capabilities: XIAOHONGSHU_CAPABILITIES,
    limitations: XIAOHONGSHU_LIMITATIONS,
  },
  match(input: URL) {
    return isXiaohongshuHost(input.hostname);
  },
  resolve: resolveXiaohongshuUrl,
  extract: extractXiaohongshu,
};
