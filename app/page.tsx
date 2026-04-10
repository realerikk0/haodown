import { BatchExtractor } from "@/app/components/batch-extractor";
import { getReleaseNotes } from "@/lib/changelog";
import { getViewerState } from "@/lib/viewer";

export default async function HomePage() {
  const [viewer, releaseNotes] = await Promise.all([
    getViewerState(),
    getReleaseNotes(),
  ]);

  return <BatchExtractor viewer={viewer} releaseNotes={releaseNotes} />;
}
