import { runInNewContext } from "node:vm";

import type { PlatformCapabilities } from "@/lib/models";

import { ApiError } from "@/lib/errors";

export const XIAOHONGSHU_HOSTS = [
  "xhslink.com",
  "www.xiaohongshu.com",
  "xiaohongshu.com",
];

export const XIAOHONGSHU_CAPABILITIES: PlatformCapabilities = {
  supportsShareText: true,
  supportsDirectUrl: true,
  contentTypes: ["video", "gallery"],
  unwatermarkedVideo: "best-effort",
  multiFormatVideo: true,
  originalImages: true,
};

export const XIAOHONGSHU_LIMITATIONS = [
  "Signed media URLs are short-lived and must be refreshed when they expire.",
];

export const XIAOHONGSHU_WEB_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

export const XIAOHONGSHU_ACCEPT_LANGUAGE =
  "zh-CN,zh;q=0.9,en;q=0.8";

export interface XiaohongshuImageInfo {
  imageScene?: string | null;
  url?: string | null;
}

export interface XiaohongshuStreamItem {
  masterUrl?: string | null;
  backupUrls?: string[] | null;
  avgBitrate?: number | null;
  width?: number | null;
  height?: number | null;
  qualityType?: string | null;
}

export interface XiaohongshuImage {
  infoList?: XiaohongshuImageInfo[] | null;
  urlPre?: string | null;
  urlDefault?: string | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  livePhoto?: boolean | null;
  stream?: {
    h264?: XiaohongshuStreamItem[] | null;
    h265?: XiaohongshuStreamItem[] | null;
    av1?: XiaohongshuStreamItem[] | null;
    h266?: XiaohongshuStreamItem[] | null;
  } | null;
}

export interface XiaohongshuNote {
  noteId?: string | null;
  id?: string | null;
  type?: string | null;
  title?: string | null;
  desc?: string | null;
  imageList?: XiaohongshuImage[] | null;
  video?: {
    media?: {
      stream?: {
        h264?: XiaohongshuStreamItem[] | null;
        h265?: XiaohongshuStreamItem[] | null;
        av1?: XiaohongshuStreamItem[] | null;
        h266?: XiaohongshuStreamItem[] | null;
      } | null;
    } | null;
    image?: {
      urlDefault?: string | null;
      url?: string | null;
    } | null;
  } | null;
}

interface XiaohongshuNoteState {
  currentNoteId?: string | null;
  firstNoteId?: string | null;
  noteDetailMap?: Record<string, { note?: XiaohongshuNote | null } | null> | null;
}

interface XiaohongshuInitialState {
  note?: XiaohongshuNoteState | null;
}

export function isXiaohongshuHost(hostname: string): boolean {
  return (
    XIAOHONGSHU_HOSTS.includes(hostname) ||
    hostname.endsWith(".xhslink.com") ||
    hostname.endsWith(".xiaohongshu.com")
  );
}

export async function followXiaohongshuRedirects(
  input: URL,
  maxHops = 6,
): Promise<{ finalUrl: URL; chain: string[] }> {
  let currentUrl = new URL(input.toString());
  const chain = [currentUrl.toString()];

  for (let index = 0; index < maxHops; index += 1) {
    const response = await fetch(currentUrl.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": XIAOHONGSHU_WEB_USER_AGENT,
        "accept-language": XIAOHONGSHU_ACCEPT_LANGUAGE,
      },
      cache: "no-store",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new ApiError(
          "RESOLVE_FAILED",
          "Redirect response is missing Location header.",
          502,
        );
      }

      currentUrl = new URL(location, currentUrl);
      chain.push(currentUrl.toString());
      continue;
    }

    return { finalUrl: currentUrl, chain };
  }

  throw new ApiError("RESOLVE_FAILED", "Too many redirects while resolving URL.");
}

export function normalizeXiaohongshuTarget(
  input: URL,
): { canonicalUrl: string; contentType: "video" | "gallery"; id: string } | null {
  const itemMatch = input.pathname.match(/^\/(?:discovery\/item|explore)\/([a-zA-Z0-9]+)\/?$/);
  if (!itemMatch) {
    return null;
  }

  const id = itemMatch[1];
  return {
    canonicalUrl: `https://www.xiaohongshu.com/discovery/item/${id}`,
    contentType: input.searchParams.get("type") === "video" ? "video" : "gallery",
    id,
  };
}

export function toHttpsUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  if (url.startsWith("http://")) {
    return `https://${url.slice("http://".length)}`;
  }

  return url;
}

function extractAssignedObjectLiteral(source: string, assignment: string): string {
  const assignmentMatch = source.match(
    new RegExp(`${assignment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*`),
  );
  const assignmentIndex = assignmentMatch?.index ?? -1;

  if (assignmentIndex === -1) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu initial state was not found in the page.",
      502,
    );
  }

  const searchStart = assignmentIndex + assignmentMatch![0].length;
  const objectStart = source.indexOf("{", searchStart);

  if (objectStart === -1) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu initial state object could not be located.",
      502,
    );
  }

  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;
  let escaping = false;

  for (let index = objectStart; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (character === "\\") {
        escaping = true;
        continue;
      }

      if (character === quote) {
        quote = null;
      }

      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(objectStart, index + 1);
      }
    }
  }

  throw new ApiError(
    "EXTRACT_FAILED",
    "Xiaohongshu initial state object could not be parsed.",
    502,
  );
}

function parseInitialStateObject(literal: string): XiaohongshuInitialState {
  const state = runInNewContext(
    `(function(undefined){ return (${literal}); })(null)`,
    Object.create(null) as Record<string, never>,
    { timeout: 100 },
  ) as XiaohongshuInitialState;

  if (!state || typeof state !== "object") {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu initial state did not produce a valid object.",
      502,
    );
  }

  return state;
}

function pickNoteFromInitialState(state: XiaohongshuInitialState): XiaohongshuNote {
  const noteState = state.note;
  const noteId =
    noteState?.currentNoteId ??
    noteState?.firstNoteId ??
    Object.keys(noteState?.noteDetailMap ?? {})[0];

  if (!noteId) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu note id could not be derived from the page state.",
      502,
    );
  }

  const note = noteState?.noteDetailMap?.[noteId]?.note;
  if (!note) {
    throw new ApiError(
      "EXTRACT_FAILED",
      "Xiaohongshu note payload could not be extracted.",
      502,
    );
  }

  return note;
}

export async function loadXiaohongshuNote(input: URL): Promise<XiaohongshuNote> {
  const response = await fetch(input.toString(), {
    method: "GET",
    headers: {
      "user-agent": XIAOHONGSHU_WEB_USER_AGENT,
      "accept-language": XIAOHONGSHU_ACCEPT_LANGUAGE,
      referer: "https://www.xiaohongshu.com/",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(
      "EXTRACT_FAILED",
      `Xiaohongshu note page returned ${response.status}.`,
      502,
    );
  }

  const html = await response.text();
  const stateLiteral = extractAssignedObjectLiteral(html, "window.__INITIAL_STATE__");
  const state = parseInitialStateObject(stateLiteral);

  return pickNoteFromInitialState(state);
}

export function getXiaohongshuNoteTitle(note: XiaohongshuNote, fallbackId: string): string {
  const trimmedTitle = note.title?.trim();
  if (trimmedTitle) {
    return trimmedTitle;
  }

  const firstDescLine = note.desc
    ?.split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  if (firstDescLine) {
    return firstDescLine;
  }

  return `Xiaohongshu note ${fallbackId}`;
}
