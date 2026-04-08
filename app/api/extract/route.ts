import { cookies } from "next/headers";

import {
  ANONYMOUS_SESSION_COOKIE,
  ANONYMOUS_USAGE_COOKIE,
  anonymousQuotaReached,
  ensureAnonymousSessionId,
  getAnonymousCookieOptions,
  parseAnonymousUsageState,
  serializeAnonymousUsageCount,
} from "@/lib/auth/anonymous";
import { AUTHENTICATED_DAILY_REQUEST_LIMIT } from "@/lib/auth/quota";
import { ensureProfileForUser } from "@/lib/auth/profile";
import {
  countAnonymousRequests,
  getProfileQuotaSnapshot,
  recordAnonymousRequestUsage,
  recordProfileRequestUsage,
} from "@/lib/auth/usage";
import { ApiError, toErrorResponse } from "@/lib/errors";
import { jsonNoStore } from "@/lib/http";
import { extractFirstUrl, normalizeOptions } from "@/lib/input";
import { getProviderForUrl } from "@/lib/providers";
import { isMissingAuthSessionError } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ExtractOptions } from "@/lib/models";
import { extractRequestSchema } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validateUrlFromText(text: string): URL {
  const rawUrl = extractFirstUrl(text);
  if (!rawUrl) {
    throw new ApiError(
      "BAD_REQUEST",
      "Request body must contain a valid URL in the text field.",
      400,
    );
  }

  try {
    return new URL(rawUrl);
  } catch {
    throw new ApiError("BAD_REQUEST", "The extracted URL is invalid.", 400);
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const anonymousUsageState = parseAnonymousUsageState(
    cookieStore.get(ANONYMOUS_USAGE_COOKIE)?.value,
  );
  const anonymousCookieCount = anonymousUsageState.used;
  const anonymousSessionId = ensureAnonymousSessionId(
    cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value,
  );

  try {
    const payload = extractRequestSchema.parse(await request.json());
    const inputUrl = validateUrlFromText(payload.text);
    const provider = getProviderForUrl(inputUrl);
    const options: ExtractOptions = normalizeOptions(payload.options);
    let nextAnonymousUsageCount: number | null = null;
    let authenticatedCreditsBalance: number | null = null;

    if (isSupabaseConfigured()) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error && !isMissingAuthSessionError(error)) {
        throw error;
      }

      if (user) {
        let profile = null;

        try {
          profile = await ensureProfileForUser(user, supabase);
        } catch {
          // If the profile schema is not ready yet, extraction can still proceed.
        }

        if (profile) {
          const snapshot = await getProfileQuotaSnapshot(
            user.id,
            profile.credits_balance,
          );

          authenticatedCreditsBalance = snapshot.creditsBalance;

          if (
            snapshot.usedToday >= AUTHENTICATED_DAILY_REQUEST_LIMIT &&
            snapshot.creditsBalance <= 0
          ) {
            throw new ApiError(
              "QUOTA_EXCEEDED",
              "今日 5 次登录额度已用完，当前点数不足，请明天再试。",
              429,
            );
          }
        }
      } else {
        const anonymousCount = await countAnonymousRequests(
          anonymousSessionId,
          anonymousCookieCount,
        );

        if (anonymousQuotaReached(anonymousCount)) {
          throw new ApiError(
            "QUOTA_EXCEEDED",
            "未登录用户每天最多只能解析 2 条内容，请先登录后继续。",
            429,
          );
        }
      }

      const resolved = await provider.resolve(inputUrl);
      const result = await provider.extract({ ...resolved, options });

      if (user) {
        const usage = await recordProfileRequestUsage({
          profileId: user.id,
          sourceText: payload.text,
          sourceUrl: inputUrl.toString(),
          metadata: {
            platform: result.platform,
            contentType: result.contentType,
            creditsBalanceBeforeRequest: authenticatedCreditsBalance,
          },
        });
        authenticatedCreditsBalance = usage.creditsBalance;
      } else {
        const usage = await recordAnonymousRequestUsage({
          anonymousSessionId,
          sourceText: payload.text,
          sourceUrl: inputUrl.toString(),
          metadata: {
            platform: result.platform,
            contentType: result.contentType,
          },
        });
        nextAnonymousUsageCount = usage.usedToday;
      }

      const response = jsonNoStore(result, { status: 200 });

      if (!user) {
        response.cookies.set(
          ANONYMOUS_SESSION_COOKIE,
          anonymousSessionId,
          getAnonymousCookieOptions(),
        );

        if (nextAnonymousUsageCount !== null) {
          response.cookies.set(
            ANONYMOUS_USAGE_COOKIE,
            serializeAnonymousUsageCount(nextAnonymousUsageCount),
            getAnonymousCookieOptions(),
          );
        }
      }

      return response;
    }

    if (anonymousQuotaReached(anonymousCookieCount)) {
      throw new ApiError(
        "QUOTA_EXCEEDED",
        "未登录用户每天最多只能解析 2 条内容，请先登录后继续。",
        429,
      );
    }

    const resolved = await provider.resolve(inputUrl);
    const result = await provider.extract({ ...resolved, options });
    const response = jsonNoStore(result, { status: 200 });

    response.cookies.set(
      ANONYMOUS_SESSION_COOKIE,
      anonymousSessionId,
      getAnonymousCookieOptions(),
    );
    response.cookies.set(
      ANONYMOUS_USAGE_COOKIE,
      serializeAnonymousUsageCount(anonymousCookieCount + 1, anonymousUsageState.dayKey),
      getAnonymousCookieOptions(),
    );

    return response;
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return jsonNoStore(body, { status });
  }
}
