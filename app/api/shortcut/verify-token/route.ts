import { findProfileByApiToken, readApiTokenFromRequest } from "@/lib/auth/api-token";
import { getProfileQuotaSnapshot } from "@/lib/auth/usage";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { jsonNoStore } from "@/lib/http";
import type { ShortcutTokenVerificationResult } from "@/lib/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const token = readApiTokenFromRequest(request);

    if (!token) {
      throw new ApiError("UNAUTHORIZED", "请先提供有效的 API Token。", 401);
    }

    const profile = await findProfileByApiToken(token);
    const snapshot = await getProfileQuotaSnapshot(
      profile.id,
      profile.credits_balance,
    );

    const body: ShortcutTokenVerificationResult = {
      ok: true,
      email: profile.email,
      dailyLimit: snapshot.dailyLimit,
      dailyRemaining: snapshot.dailyRemaining,
      creditsBalance: snapshot.creditsBalance,
    };

    return jsonNoStore(body, { status: 200 });
  } catch (error) {
    const normalizedError = toErrorResponse(error);

    return jsonNoStore(normalizedError.body, {
      status: normalizedError.status,
    });
  }
}
