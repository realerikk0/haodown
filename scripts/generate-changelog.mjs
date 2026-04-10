import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const outputPath = join(root, "lib/generated/changelog.json");

function readPackageVersion() {
  const packageJsonPath = join(root, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
  return packageJson.version ?? "0.1.0";
}

function normalizeDetailLines(body) {
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

function parseGitLog(rawLog, version) {
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
      };
    });
}

function generatePayload() {
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
      cwd: root,
      encoding: "utf8",
    },
  );

  return {
    generatedAt: new Date().toISOString(),
    entries: parseGitLog(rawLog, version),
  };
}

let payload;

try {
  payload = generatePayload();
} catch {
  payload = {
    generatedAt: new Date().toISOString(),
    entries: [],
  };
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
