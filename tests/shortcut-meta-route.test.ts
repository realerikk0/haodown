import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/shortcut/meta/route";
import {
  SHORTCUT_ID,
  SHORTCUT_INSTALL_PATH,
  SHORTCUT_LATEST_VERSION,
  SHORTCUT_SOURCE_SPEC_PATH,
} from "@/lib/shortcut/config";
import type { ShortcutMetaResult } from "@/lib/models";

describe("/api/shortcut/meta", () => {
  it("returns current shortcut metadata without update when versions match", async () => {
    const response = await GET(
      new Request(
        `https://haodown.test/api/shortcut/meta?currentVersion=${SHORTCUT_LATEST_VERSION}`,
      ),
    );
    const body = (await response.json()) as ShortcutMetaResult;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      shortcutId: SHORTCUT_ID,
      latestVersion: SHORTCUT_LATEST_VERSION,
      updateAvailable: false,
      installPageUrl: `https://haodown.test${SHORTCUT_INSTALL_PATH}`,
      sourceSpecUrl: `https://haodown.test${SHORTCUT_SOURCE_SPEC_PATH}`,
    });
    expect(body.supportedHosts.length).toBeGreaterThanOrEqual(3);
  });

  it("marks older shortcut versions as needing update", async () => {
    const response = await GET(
      new Request(
        "https://haodown.test/api/shortcut/meta?currentVersion=0.9.0",
      ),
    );
    const body = (await response.json()) as ShortcutMetaResult;

    expect(body.updateAvailable).toBe(true);
  });
});
