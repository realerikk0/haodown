import { ApiError } from "@/lib/errors";
import { withBrowserPage } from "@/lib/browser";
import type { ExtractSuccessResult, ImageAsset } from "@/lib/models";
import {
  DOUYIN_CAPABILITIES,
  DOUYIN_LIMITATIONS,
} from "@/lib/providers/douyin/shared";
import type { ExtractionContext } from "@/lib/providers/types";

interface RawDomImage {
  src: string;
  width: number;
  height: number;
}

function sanitizeTitle(title: string) {
  return title.replace(/\s*-\s*抖音$/, "").trim();
}

function normalizeImageUrl(url: string) {
  return url.replace(/&amp;/g, "&");
}

function isDouyinGalleryImage(url: string, width: number, height: number) {
  return (
    url.includes("douyinpic.com") &&
    url.includes("biz_tag=aweme_images") &&
    (width >= 1000 || height >= 1000)
  );
}

export function filterDouyinGalleryImages(rawImages: RawDomImage[]): ImageAsset[] {
  const seen = new Set<string>();
  const images: ImageAsset[] = [];

  for (const rawImage of rawImages) {
    const normalizedUrl = normalizeImageUrl(rawImage.src);
    if (
      !normalizedUrl ||
      !isDouyinGalleryImage(normalizedUrl, rawImage.width, rawImage.height)
    ) {
      continue;
    }

    const dedupeKey = normalizedUrl.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    images.push({
      index: images.length + 1,
      width: rawImage.width || null,
      height: rawImage.height || null,
      url: normalizedUrl,
    });
  }

  return images;
}

export function extractDouyinGalleryImagesFromHtml(html: string): ImageAsset[] {
  const regex =
    /https:\/\/[^"'\\s<>]+douyinpic\.com[^"'\\s<>]*biz_tag=aweme_images[^"'\\s<>]*/gi;
  const matches = normalizeImageUrl(html).match(regex) ?? [];
  const seen = new Set<string>();
  const images: ImageAsset[] = [];

  for (const match of matches) {
    const url = normalizeImageUrl(match);
    const dedupeKey = url.split("?")[0];
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    images.push({
      index: images.length + 1,
      width: null,
      height: null,
      url,
    });
  }

  return images;
}

async function extractDouyinGalleryOnce(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  const payload = await withBrowserPage(async (page) => {
    await page.goto(context.canonicalUrl, { waitUntil: "domcontentloaded" });

    await page
      .waitForFunction(
        () =>
          Array.from(document.images).some((image) => {
            const src = image.currentSrc || image.src || "";
            return src.includes("biz_tag=aweme_images");
          }),
        { timeout: 15_000 },
      )
      .catch(() => null);

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let steps = 0;
        const timer = window.setInterval(() => {
          window.scrollBy(0, Math.max(window.innerHeight, 800));
          steps += 1;

          if (
            window.innerHeight + window.scrollY >= document.body.scrollHeight ||
            steps >= 8
          ) {
            window.clearInterval(timer);
            resolve();
          }
        }, 180);
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 1_000));

    return page.evaluate(() => ({
      title: document.title || "Untitled Douyin gallery",
      html: document.documentElement.outerHTML,
      rawImages: Array.from(document.images).map((image) => ({
        src: image.currentSrc || image.src,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })),
    }));
  });

  const domImages = filterDouyinGalleryImages(payload.rawImages);
  const htmlImages = extractDouyinGalleryImagesFromHtml(payload.html);
  const images = domImages.length > 0 ? domImages : htmlImages;

  if (images.length === 0) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Douyin gallery images could not be extracted.",
      502,
    );
  }

  return {
    ok: true,
    platform: "douyin",
    contentType: "gallery",
    canonicalUrl: context.canonicalUrl,
    title: sanitizeTitle(payload.title),
    id: context.id,
    capabilities: DOUYIN_CAPABILITIES,
    limitations: [
      ...DOUYIN_LIMITATIONS,
      ...(domImages.length === 0
        ? ["The note images were extracted from the page source because the live DOM did not expose all rendered assets."]
        : []),
    ],
    images,
    platformMeta: {
      source: "douyin",
      extractionMode: domImages.length > 0 ? "dom-images" : "html-scan",
      imageCount: images.length,
    },
  };
}

export async function extractDouyinGallery(
  context: ExtractionContext,
): Promise<ExtractSuccessResult> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await extractDouyinGalleryOnce(context);
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
        "Douyin gallery images could not be extracted.",
        502,
      );
}
