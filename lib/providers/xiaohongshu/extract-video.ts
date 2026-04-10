import type { ExtractSuccessResult, VideoFormat } from "@/lib/models";
import type { ExtractionContext } from "@/lib/providers/types";

import {
  getXiaohongshuNoteTitle,
  toHttpsUrl,
  XIAOHONGSHU_CAPABILITIES,
  XIAOHONGSHU_LIMITATIONS,
  type XiaohongshuNote,
  type XiaohongshuStreamItem,
} from "@/lib/providers/xiaohongshu/shared";
import { ApiError } from "@/lib/errors";

function formatDefinition(stream: XiaohongshuStreamItem): string {
  if (typeof stream.height === "number" && stream.height > 0) {
    return `${stream.height}p`;
  }

  const quality = stream.qualityType?.trim();
  if (quality) {
    return quality.toLowerCase();
  }

  return "source";
}

function sortByQuality(a: XiaohongshuStreamItem, b: XiaohongshuStreamItem): number {
  const heightDiff = (b.height ?? 0) - (a.height ?? 0);
  if (heightDiff !== 0) {
    return heightDiff;
  }

  return (b.avgBitrate ?? 0) - (a.avgBitrate ?? 0);
}

export function mapXiaohongshuVideoFormats(
  streams: XiaohongshuStreamItem[] | null | undefined,
): VideoFormat[] {
  if (!streams || streams.length === 0) {
    return [];
  }

  const deduped = new Map<string, VideoFormat>();

  [...streams].sort(sortByQuality).forEach((stream) => {
    const url = toHttpsUrl(stream.masterUrl);
    if (!url || deduped.has(url)) {
      return;
    }

    deduped.set(url, {
      definition: formatDefinition(stream),
      width: stream.width ?? null,
      height: stream.height ?? null,
      bitrate: stream.avgBitrate ?? null,
      url,
      watermark: "none",
    });
  });

  return Array.from(deduped.values());
}

function pickPreferredStreams(note: XiaohongshuNote): {
  codec: string;
  streams: XiaohongshuStreamItem[];
} {
  const streamSets = note.video?.media?.stream;
  const candidates: Array<[string, XiaohongshuStreamItem[] | null | undefined]> = [
    ["h264", streamSets?.h264],
    ["h265", streamSets?.h265],
    ["av1", streamSets?.av1],
    ["h266", streamSets?.h266],
  ];

  const match = candidates.find(([, streams]) => (streams?.length ?? 0) > 0);
  if (!match) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu video streams could not be extracted.",
      502,
    );
  }

  return {
    codec: match[0],
    streams: match[1] ?? [],
  };
}

export function extractXiaohongshuVideo(
  context: ExtractionContext,
  note: XiaohongshuNote,
): ExtractSuccessResult {
  const { codec, streams } = pickPreferredStreams(note);
  const formats = mapXiaohongshuVideoFormats(streams);

  if (formats.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu video formats could not be mapped.",
      502,
    );
  }

  return {
    ok: true,
    platform: "xiaohongshu",
    contentType: "video",
    canonicalUrl: context.canonicalUrl,
    title: getXiaohongshuNoteTitle(note, context.id),
    id: context.id,
    capabilities: XIAOHONGSHU_CAPABILITIES,
    limitations: XIAOHONGSHU_LIMITATIONS,
    video: {
      best: formats[0],
      formats,
      watermark: "none",
      quality: formats[0].definition,
      durationSeconds: null,
      poster: toHttpsUrl(
        note.video?.image?.urlDefault ??
          note.video?.image?.url ??
          note.imageList?.[0]?.urlDefault ??
          note.imageList?.[0]?.url,
      ),
    },
    platformMeta: {
      codec,
      backupUrls: streams
        .map((stream) => ({
          masterUrl: toHttpsUrl(stream.masterUrl),
          backupUrls: (stream.backupUrls ?? [])
            .map((url) => toHttpsUrl(url))
            .filter((url): url is string => Boolean(url)),
        }))
        .filter((item) => item.masterUrl || item.backupUrls.length > 0),
      sourceType: note.type ?? null,
    },
  };
}
