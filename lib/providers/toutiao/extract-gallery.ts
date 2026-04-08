import { ApiError } from "@/lib/errors";
import { withBrowserPage } from "@/lib/browser";
import type { ExtractSuccessResult, ImageAsset } from "@/lib/models";
import type { ExtractionContext } from "@/lib/providers/types";

interface RawDomImage {
  src: string;
  width: number;
  height: number;
}

function parseDimensionsFromUrl(url: string): { width: number; height: number } | null {
  const match = url.match(/tplv-obj:(\d+):(\d+)\.image/i);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function normalizeImageUrl(url: string) {
  return url.replace(/&amp;/g, "&");
}

function toImageAsset(
  url: string,
  width: number | null,
  height: number | null,
  index: number,
): ImageAsset {
  const fallbackDimensions = parseDimensionsFromUrl(url);

  return {
    index,
    width: width || fallbackDimensions?.width || null,
    height: height || fallbackDimensions?.height || null,
    url,
  };
}

export function filterGalleryImages(
  rawImages: RawDomImage[],
  itemId: string,
): ImageAsset[] {
  const seen = new Set<string>();
  const images: ImageAsset[] = [];

  for (const rawImage of rawImages) {
    const normalizedUrl = normalizeImageUrl(rawImage.src);
    if (
      !normalizedUrl.includes("from=post") ||
      !normalizedUrl.includes(`gid=${itemId}`)
    ) {
      continue;
    }

    const dedupeKey = normalizedUrl.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    images.push(
      toImageAsset(
        normalizedUrl,
        rawImage.width || null,
        rawImage.height || null,
        images.length + 1,
      ),
    );
  }

  return images;
}

export function extractGalleryImagesFromHtml(html: string, itemId: string): ImageAsset[] {
  const normalizedHtml = normalizeImageUrl(html);
  const regex = new RegExp(
    String.raw`https:\/\/[^"'\\s<>]+from=post[^"'\\s<>]*gid=${itemId}[^"'\\s<>]*`,
    "gi",
  );

  const matches = normalizedHtml.match(regex) ?? [];
  const seen = new Set<string>();
  const images: ImageAsset[] = [];

  for (const match of matches) {
    const url = normalizeImageUrl(match);
    const dedupeKey = url.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    images.push(toImageAsset(url, null, null, images.length + 1));
  }

  return images;
}

export async function extractToutiaoGallery(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const payload = await withBrowserPage(async (page) => {
    await page.goto(context.canonicalUrl, { waitUntil: "domcontentloaded" });

    await page.waitForFunction(
      () => {
        const hasPostImage = Array.from(document.images).some((image) => {
          const src = image.currentSrc || image.src || "";
          return src.includes("from=post");
        });

        return (
          hasPostImage ||
          document.documentElement.outerHTML.includes("from=post") ||
          Boolean(document.querySelector(".weitoutiao-img"))
        );
      },
      { timeout: 15_000 },
    ).catch(() => null);

    await new Promise((resolve) => setTimeout(resolve, 1_500));

    return page.evaluate(() => {
      const title =
        document.querySelector("title")?.textContent?.trim() ?? "Untitled Toutiao gallery";
      const rawImages = Array.from(document.images).map((image) => ({
        src: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }));
      const html = document.documentElement.outerHTML;

      return { title, rawImages, html };
    });
  });

  const domImages = filterGalleryImages(payload.rawImages, context.id);
  const htmlImages = extractGalleryImagesFromHtml(payload.html, context.id);
  const images = domImages.length > 0 ? domImages : htmlImages;

  if (images.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Toutiao gallery images could not be extracted.",
      502,
    );
  }

  return {
    ok: true,
    platform: "toutiao",
    contentType: "gallery",
    canonicalUrl: context.canonicalUrl,
    title: payload.title.replace(/\s+-\s+今日头条$/, ""),
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
      "Signed image URLs may expire and should be refreshed by calling the API again.",
      ...(domImages.length === 0
        ? ["The page did not expose article images in the live DOM, so the API fell back to HTML source extraction."]
        : []),
    ],
    images,
    platformMeta: {
      imageCount: images.length,
      source: "toutiao",
      extractionMode: domImages.length > 0 ? "dom-images" : "html-scan",
    },
  };
}
