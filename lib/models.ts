export type SupportedPlatform = "toutiao";

export type ContentType = "video" | "gallery";

export type WatermarkStatus = "none" | "unknown" | "present";

export type AuthMode = "anonymous" | "authenticated" | "disabled";

export interface ExtractOptions {
  preferUnwatermarked: boolean;
  preferHighestQuality: boolean;
}

export interface PlatformCapabilities {
  supportsShareText: boolean;
  supportsDirectUrl: boolean;
  contentTypes: ContentType[];
  unwatermarkedVideo: "best-effort" | "unsupported";
  multiFormatVideo: boolean;
  originalImages: boolean;
}

export interface VideoFormat {
  definition: string;
  width: number | null;
  height: number | null;
  bitrate: number | null;
  url: string;
  watermark: WatermarkStatus;
}

export interface VideoPayload {
  best: VideoFormat;
  formats: VideoFormat[];
  watermark: WatermarkStatus;
  quality: string;
  durationSeconds: number | null;
  poster: string | null;
}

export interface ImageAsset {
  index: number;
  width: number | null;
  height: number | null;
  url: string;
}

export interface ExtractSuccessResult {
  ok: true;
  platform: SupportedPlatform;
  contentType: ContentType;
  canonicalUrl: string;
  title: string;
  id: string;
  capabilities: PlatformCapabilities;
  limitations: string[];
  video?: VideoPayload;
  images?: ImageAsset[];
  platformMeta?: Record<string, unknown>;
}

export type ErrorCode =
  | "BAD_REQUEST"
  | "UNSUPPORTED_PLATFORM"
  | "RESOLVE_FAILED"
  | "EXTRACT_FAILED"
  | "BROWSER_TIMEOUT"
  | "QUOTA_EXCEEDED";

export interface ExtractErrorResult {
  ok: false;
  code: ErrorCode;
  message: string;
}

export interface PlatformDescriptor {
  platform: SupportedPlatform;
  displayName: string;
  enabled: boolean;
  supportedUrlHosts: string[];
  capabilities: PlatformCapabilities;
  limitations: string[];
}

export interface ResolvedMediaTarget {
  platform: SupportedPlatform;
  originalUrl: string;
  canonicalUrl: string;
  contentType: ContentType;
  id: string;
  url: URL;
}

export interface ViewerState {
  authMode: AuthMode;
  authAvailable: boolean;
  email: string | null;
  apiToken: string | null;
  creditsBalance: number | null;
  recordedRequests: number;
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  note: string | null;
}
