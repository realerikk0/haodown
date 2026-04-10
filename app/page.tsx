import { BatchExtractor } from "@/app/components/batch-extractor";
import { getViewerState } from "@/lib/viewer";

export default async function HomePage() {
  const viewer = await getViewerState();

  return <BatchExtractor viewer={viewer} />;
}
