import { jsonNoStore } from "@/lib/http";
import type { ShortcutMetaResult } from "@/lib/models";
import { listPlatforms } from "@/lib/providers";
import {
  SHORTCUT_ID,
  SHORTCUT_INSTALL_PATH,
  SHORTCUT_LATEST_VERSION,
  SHORTCUT_SOURCE_SPEC_PATH,
  buildShortcutUrl,
  isShortcutUpdateAvailable,
  listShortcutAuthModes,
} from "@/lib/shortcut/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const currentVersion = url.searchParams.get("currentVersion");
  const supportedHosts = Array.from(
    new Set(
      listPlatforms().flatMap((platform) => platform.supportedUrlHosts),
    ),
  ).sort();

  const body: ShortcutMetaResult = {
    ok: true,
    shortcutId: SHORTCUT_ID,
    latestVersion: SHORTCUT_LATEST_VERSION,
    updateAvailable: isShortcutUpdateAvailable(currentVersion),
    installPageUrl: buildShortcutUrl(url.origin, SHORTCUT_INSTALL_PATH),
    sourceSpecUrl: buildShortcutUrl(url.origin, SHORTCUT_SOURCE_SPEC_PATH),
    supportedHosts,
    authModes: listShortcutAuthModes(),
  };

  return jsonNoStore(body, { status: 200 });
}
