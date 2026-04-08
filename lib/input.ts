const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/i;

const TRAILING_PUNCTUATION = /[)\]}",'`。！？!?.，、；;：:]+$/u;

export function extractFirstUrl(input: string): string | null {
  const match = input.match(URL_PATTERN);
  if (!match) {
    return null;
  }

  return match[0].replace(TRAILING_PUNCTUATION, "");
}

export function normalizeOptions(input?: {
  preferUnwatermarked?: boolean;
  preferHighestQuality?: boolean;
}) {
  return {
    preferUnwatermarked: input?.preferUnwatermarked ?? true,
    preferHighestQuality: input?.preferHighestQuality ?? true,
  };
}
