import type { ExtractSuccessResult, ImageAsset } from "@/lib/models";
import type { ExtractionContext } from "@/lib/providers/types";

import {
  getXiaohongshuNoteTitle,
  toHttpsUrl,
  XIAOHONGSHU_CAPABILITIES,
  XIAOHONGSHU_LIMITATIONS,
  type XiaohongshuImage,
  type XiaohongshuNote,
  type XiaohongshuStreamItem,
} from "@/lib/providers/xiaohongshu/shared";
import { ApiError } from "@/lib/errors";

function pickStillImageUrl(image: XiaohongshuImage): string | null {
  const preferredFromInfoList = image.infoList?.find(
    (variant) => variant.imageScene === "WB_DFT" && variant.url,
  )?.url;

  return toHttpsUrl(
    preferredFromInfoList ??
      image.urlDefault ??
      image.infoList?.find((variant) => variant.url)?.url ??
      image.url ??
      image.urlPre,
  );
}

function pickMotionStream(
  image: XiaohongshuImage,
): XiaohongshuStreamItem | null {
  const streams = image.stream?.h264;
  if (!streams || streams.length === 0) {
    return null;
  }

  return [...streams].sort((a, b) => {
    const heightDiff = (b.height ?? 0) - (a.height ?? 0);
    if (heightDiff !== 0) {
      return heightDiff;
    }

    return (b.avgBitrate ?? 0) - (a.avgBitrate ?? 0);
  })[0] ?? null;
}

export function mapXiaohongshuGalleryImages(
  images: XiaohongshuImage[] | null | undefined,
): ImageAsset[] {
  if (!images || images.length === 0) {
    return [];
  }

  const mapped: ImageAsset[] = [];

  images.forEach((image, index) => {
    const stillUrl = pickStillImageUrl(image);
    if (!stillUrl) {
      return;
    }

    const motionStream = pickMotionStream(image);

    mapped.push({
      index: index + 1,
      width: image.width ?? null,
      height: image.height ?? null,
      url: stillUrl,
      livePhoto: Boolean(image.livePhoto),
      motionUrl: toHttpsUrl(motionStream?.masterUrl) ?? null,
    });
  });

  return mapped;
}

export function extractXiaohongshuGallery(
  context: ExtractionContext,
  note: XiaohongshuNote,
): ExtractSuccessResult {
  const images = mapXiaohongshuGalleryImages(note.imageList);

  if (images.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu gallery images could not be extracted.",
      502,
    );
  }

  const livePhotoCount = images.filter((image) => image.livePhoto).length;

  return {
    ok: true,
    platform: "xiaohongshu",
    contentType: "gallery",
    canonicalUrl: context.canonicalUrl,
    title: getXiaohongshuNoteTitle(note, context.id),
    id: context.id,
    capabilities: XIAOHONGSHU_CAPABILITIES,
    limitations: XIAOHONGSHU_LIMITATIONS,
    images,
    platformMeta: {
      sourceType: note.type ?? null,
      livePhotoCount,
    },
  };
}
