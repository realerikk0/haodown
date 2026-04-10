import "server-only";

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";

import generatedChangelog from "@/lib/generated/changelog.json";
import type { ReleaseNoteEntry } from "@/lib/models";

interface ChangelogPayload {
  generatedAt?: string;
  entries?: ReleaseNoteEntry[];
}

function readPackageVersion() {
  const packageJsonPath = join(process.cwd(), "package.json");
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as { version?: string };

  return packageJson.version ?? "0.1.0";
}

function normalizeDetailLines(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function parseGitLog(rawLog: string, version: string): ReleaseNoteEntry[] {
  return rawLog
    .split("\x1e")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [sha, summary, date, body = ""] = chunk.split("\x1f");
      return {
        version: `v${version}+${sha}`,
        date,
        summary,
        details: normalizeDetailLines(body),
      } satisfies ReleaseNoteEntry;
    });
}

function readGitReleaseNotes(): ReleaseNoteEntry[] {
  const version = readPackageVersion();
  const rawLog = execFileSync(
    "git",
    [
      "log",
      "--pretty=format:%h%x1f%s%x1f%ad%x1f%b%x1e",
      "--date=short",
      "-n",
      "6",
    ],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );

  return parseGitLog(rawLog, version);
}

function readGeneratedReleaseNotes(): ReleaseNoteEntry[] {
  const payload = generatedChangelog as ChangelogPayload;
  return payload.entries ?? [];
}

export const getReleaseNotes = cache(async (): Promise<ReleaseNoteEntry[]> => {
  const gitDir = join(process.cwd(), ".git");

  if (existsSync(gitDir)) {
    try {
      return readGitReleaseNotes();
    } catch {
      return readGeneratedReleaseNotes();
    }
  }

  return readGeneratedReleaseNotes();
});
