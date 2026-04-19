import type { ShortcutAuthMode } from "@/lib/models";
import { hasSupabaseAdminAccess } from "@/lib/supabase/env";

export const SHORTCUT_ID = "haodown-ios";
export const SHORTCUT_LATEST_VERSION = "1.0.0";
export const SHORTCUT_INSTALL_PATH = "/shortcut";
export const SHORTCUT_SOURCE_SPEC_PATH =
  "/shortcuts/haodown-ios.shortcut-spec.json";

function parseVersionPart(input: string) {
  const parsed = Number.parseInt(input, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function compareShortcutVersions(left: string, right: string) {
  const leftParts = left.split(".").map(parseVersionPart);
  const rightParts = right.split(".").map(parseVersionPart);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isShortcutUpdateAvailable(currentVersion?: string | null) {
  if (!currentVersion || currentVersion.trim().length === 0) {
    return true;
  }

  return compareShortcutVersions(currentVersion, SHORTCUT_LATEST_VERSION) < 0;
}

export function buildShortcutUrl(origin: string, pathname: string) {
  return new URL(pathname, origin).toString();
}

export function listShortcutAuthModes(): ShortcutAuthMode[] {
  const modes: ShortcutAuthMode[] = ["anonymous-session"];

  if (hasSupabaseAdminAccess()) {
    modes.push("bearer-token");
  }

  return modes;
}
