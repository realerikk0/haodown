import { existsSync } from "node:fs";

import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";

const LOCAL_EXECUTABLE_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_EXECUTABLE_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
].filter((value): value is string => Boolean(value));

let browserPromise: Promise<Browser> | null = null;

chromium.setGraphicsMode = false;

async function resolveExecutablePath(): Promise<string> {
  for (const candidate of LOCAL_EXECUTABLE_CANDIDATES) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return chromium.executablePath();
}

async function createBrowser(): Promise<Browser> {
  const executablePath = await resolveExecutablePath();
  const isServerlessChromium = executablePath.includes("tmp") || !!process.env.VERCEL;
  const headlessMode = isServerlessChromium ? "shell" : true;

  return puppeteer.launch({
    executablePath,
    headless: headlessMode,
    args: isServerlessChromium
      ? puppeteer.defaultArgs({
          args: chromium.args,
          headless: "shell",
        })
      : ["--no-sandbox", "--disable-setuid-sandbox"],
    defaultViewport: {
      width: 1280,
      height: 720,
    },
  });
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = createBrowser();
  }

  return browserPromise;
}

export async function withBrowserPage<T>(
  fn: (page: import("puppeteer-core").Page) => Promise<T>,
): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  page.setDefaultNavigationTimeout(45_000);
  page.setDefaultTimeout(20_000);
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  );

  try {
    return await fn(page);
  } finally {
    await page.close();
  }
}
