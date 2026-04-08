import { ApiError } from "@/lib/errors";
import type { PlatformDescriptor } from "@/lib/models";
import { toutiaoProvider } from "@/lib/providers/toutiao";
import type { Provider } from "@/lib/providers/types";

const providers: Provider[] = [toutiaoProvider];

export function listPlatforms(): PlatformDescriptor[] {
  return providers.map((provider) => provider.descriptor);
}

export function getProviderForUrl(input: URL): Provider {
  const provider = providers.find((candidate) => candidate.match(input));
  if (!provider) {
    throw new ApiError(
      "UNSUPPORTED_PLATFORM",
      `Unsupported platform for URL: ${input.hostname}`,
      400,
    );
  }

  return provider;
}
