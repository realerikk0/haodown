const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[)\]}",'`。！？!?.，、；;：:]+$/u;

function cleanUrl(input: string): string {
  return input.replace(TRAILING_PUNCTUATION, "");
}

export function extractUrlsFromText(input: string): string[] {
  const matches = input.match(URL_PATTERN) ?? [];
  const seen = new Set<string>();
  const urls: string[] = [];

  for (const match of matches) {
    const cleaned = cleanUrl(match.trim());
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }
    seen.add(cleaned);
    urls.push(cleaned);
  }

  return urls;
}

export function extractBatchItems(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  const urls = extractUrlsFromText(trimmed);
  if (urls.length > 0) {
    return urls;
  }

  const seen = new Set<string>();
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line || seen.has(line)) {
        return false;
      }
      seen.add(line);
      return true;
    });
}
