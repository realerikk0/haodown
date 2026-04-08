import { cookies } from "next/headers";

import {
  ANONYMOUS_REQUEST_LIMIT,
  ANONYMOUS_SESSION_COOKIE,
  ANONYMOUS_USAGE_COOKIE,
  getAnonymousRemaining,
  parseAnonymousUsageCount,
} from "@/lib/auth/anonymous";
import { AUTHENTICATED_DAILY_REQUEST_LIMIT } from "@/lib/auth/quota";
import { countProfileRequests, ensureProfileForUser } from "@/lib/auth/profile";
import {
  countAnonymousRequests,
  getProfileQuotaSnapshot,
} from "@/lib/auth/usage";
import type { ViewerState } from "@/lib/models";
import { isMissingAuthSessionError } from "@/lib/supabase/auth-errors";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getViewerState(): Promise<ViewerState> {
  const cookieStore = await cookies();
  const cookieUsage = parseAnonymousUsageCount(
    cookieStore.get(ANONYMOUS_USAGE_COOKIE)?.value,
  );
  const anonymousSessionId = cookieStore.get(ANONYMOUS_SESSION_COOKIE)?.value ?? null;

  if (!isSupabaseConfigured()) {
    return {
      authMode: "disabled",
      authAvailable: false,
      email: null,
      apiToken: null,
      creditsBalance: null,
      recordedRequests: 0,
      dailyLimit: ANONYMOUS_REQUEST_LIMIT,
      dailyUsed: cookieUsage,
      dailyRemaining: getAnonymousRemaining(cookieUsage),
      note: "账号系统暂未启用，当前可以直接体验基础解析功能。",
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error && !isMissingAuthSessionError(error)) {
      throw error;
    }

    if (!user) {
      const anonymousUsed = anonymousSessionId
        ? await countAnonymousRequests(anonymousSessionId, cookieUsage)
        : cookieUsage;

      return {
        authMode: "anonymous",
        authAvailable: true,
        email: null,
        apiToken: null,
        creditsBalance: null,
        recordedRequests: anonymousUsed,
        dailyLimit: ANONYMOUS_REQUEST_LIMIT,
        dailyUsed: anonymousUsed,
        dailyRemaining: getAnonymousRemaining(anonymousUsed),
        note: "未登录用户每天可解析 2 条内容，登录后每天可解析 5 条，点数可继续追加次数。",
      };
    }

    const profile = await ensureProfileForUser(user, supabase);
    const recordedRequests = await countProfileRequests(user.id);
    const quotaSnapshot = await getProfileQuotaSnapshot(
      user.id,
      profile.credits_balance,
    );

    return {
      authMode: "authenticated",
      authAvailable: true,
      email: user.email ?? profile.email,
      apiToken: profile.api_token,
      creditsBalance: quotaSnapshot.creditsBalance,
      recordedRequests,
      dailyLimit: AUTHENTICATED_DAILY_REQUEST_LIMIT,
      dailyUsed: quotaSnapshot.usedToday,
      dailyRemaining: quotaSnapshot.dailyRemaining,
      note: "登录用户每天可解析 5 条内容，超出后会自动消耗点数。",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Supabase schema is not ready yet.";

    return {
      authMode: "anonymous",
      authAvailable: true,
      email: null,
      apiToken: null,
      creditsBalance: null,
      recordedRequests: cookieUsage,
      dailyLimit: ANONYMOUS_REQUEST_LIMIT,
      dailyUsed: cookieUsage,
      dailyRemaining: getAnonymousRemaining(cookieUsage),
      note: `账号系统暂时不可用：${message}`,
    };
  }
}
