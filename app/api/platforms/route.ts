import { jsonNoStore } from "@/lib/http";
import { listPlatforms } from "@/lib/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonNoStore({
    ok: true,
    platforms: listPlatforms(),
  });
}
