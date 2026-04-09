import { mkdtempSync, readFileSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const TEMP_PREFIX = path.join(tmpdir(), "haodown-supabase-");
const ENV_FILES = [".env.supabase.local", ".env.supabase"];

function parseEnvFile(filePath) {
  const values = {};
  const source = readFileSync(filePath, "utf8");

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadProjectEnv() {
  const merged = {};

  for (const relativePath of ENV_FILES) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }

    Object.assign(merged, parseEnvFile(absolutePath));
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string" && value.length > 0) {
      merged[key] = value;
    }
  }

  return merged;
}

function buildDbUrl(env) {
  if (env.SUPABASE_DB_URL) {
    return env.SUPABASE_DB_URL;
  }

  const projectRef = env.SUPABASE_PROJECT_REF;
  const password = env.SUPABASE_DB_PASSWORD;
  const user = env.SUPABASE_DB_USER ?? "postgres";
  const host = env.SUPABASE_DB_HOST ?? (projectRef ? `db.${projectRef}.supabase.co` : "");
  const port = env.SUPABASE_DB_PORT ?? "5432";
  const database = env.SUPABASE_DB_NAME ?? "postgres";
  const sslMode = env.SUPABASE_DB_SSLMODE ?? "require";

  if (!projectRef || !password) {
    throw new Error(
      "缺少 Supabase 项目级数据库配置。请在 .env.supabase.local 里填写 SUPABASE_DB_URL，或同时填写 SUPABASE_PROJECT_REF 与 SUPABASE_DB_PASSWORD。",
    );
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(database)}?sslmode=${encodeURIComponent(sslMode)}`;
}

function printUsage() {
  console.log(`用法:
  node scripts/supabase-remote-migrations.mjs push
  node scripts/supabase-remote-migrations.mjs push --dry-run
  node scripts/supabase-remote-migrations.mjs apply 20260408_daily_request_quota.sql
  node scripts/supabase-remote-migrations.mjs db-url`);
}

function runSupabase(args, options = {}) {
  const result = spawnSync("supabase", args, {
    cwd: options.cwd ?? ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      ...options.env,
    },
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function makeTempWorkdirWithMigration(fileName) {
  const sourceFile = path.join(MIGRATIONS_DIR, fileName);
  if (!existsSync(sourceFile)) {
    throw new Error(`找不到迁移文件：${sourceFile}`);
  }

  const tempRoot = mkdtempSync(TEMP_PREFIX);
  const tempSupabaseDir = path.join(tempRoot, "supabase");
  const tempMigrationsDir = path.join(tempSupabaseDir, "migrations");
  mkdirSync(tempMigrationsDir, { recursive: true });
  writeFileSync(
    path.join(tempSupabaseDir, "config.toml"),
    `project_id = "haodown"\n`,
    "utf8",
  );
  copyFileSync(sourceFile, path.join(tempMigrationsDir, fileName));
  return tempRoot;
}

function main() {
  const [command, ...rest] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return;
  }

  const env = loadProjectEnv();
  const dbUrl = buildDbUrl(env);

  if (command === "db-url") {
    console.log(dbUrl);
    return;
  }

  if (command === "push") {
    const dryRun = rest.includes("--dry-run");
    const args = ["db", "push", "--db-url", dbUrl, "--include-all"];
    if (dryRun) {
      args.push("--dry-run");
    }
    runSupabase(args);
    return;
  }

  if (command === "apply") {
    const fileName = rest[0];
    if (!fileName) {
      throw new Error("请指定要执行的迁移文件名，例如 20260408_daily_request_quota.sql");
    }

    const tempWorkdir = makeTempWorkdirWithMigration(fileName);
    runSupabase(["db", "push", "--db-url", dbUrl, "--include-all", "--workdir", tempWorkdir]);
    return;
  }

  throw new Error(`不支持的命令：${command}`);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
