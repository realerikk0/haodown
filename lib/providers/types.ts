import type {
  ExtractOptions,
  ExtractSuccessResult,
  PlatformDescriptor,
  ResolvedMediaTarget,
} from "@/lib/models";

export interface ExtractionContext extends ResolvedMediaTarget {
  options: ExtractOptions;
}

export interface Provider {
  readonly descriptor: PlatformDescriptor;
  match(input: URL): boolean;
  resolve(input: URL): Promise<ResolvedMediaTarget>;
  extract(context: ExtractionContext): Promise<ExtractSuccessResult>;
}
