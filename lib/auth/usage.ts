import { ApiError } from "@/lib/errors";
import {
  AUTHENTICATED_DAILY_REQUEST_LIMIT,
  ANONYMOUS_REQUEST_LIMIT,
  getDailyRemaining,
  getQuotaWindow,
  QUOTA_TIME_ZONE,
} from "@/lib/auth/quota";
import type { Json } from "@/lib/supabase/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminAccess } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface LogUsageInput {
  profileId?: string | null;
  anonymousSessionId?: string | null;
  sourceText?: string | null;
  sourceUrl?: string | null;
  metadata?: Json | null;
}

interface AnonymousUsageInput extends LogUsageInput {
  anonymousSessionId: string;
}

interface ProfileUsageInput extends LogUsageInput {
  profileId: string;
}

interface AnonymousUsageResult {
  usedToday: number;
  dailyLimit: number;
  dailyRemaining: number;
}

interface ProfileQuotaSnapshot {
  usedToday: number;
  dailyLimit: number;
  dailyRemaining: number;
  creditsBalance: number;
}

interface ProfileUsageResult extends ProfileQuotaSnapshot {
  consumedCredit: boolean;
}

function getUsageClient() {
  return hasSupabaseAdminAccess()
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
}

function isMissingRpcFunctionError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("could not find the function") || message.includes("schema cache");
}

function isQuotaExceededRpcError(error: { message?: string } | null) {
  return (error?.message ?? "").includes("QUOTA_EXCEEDED");
}

function toQuotaExceededError(message: string) {
  return new ApiError("QUOTA_EXCEEDED", message, 429);
}

async function insertRequestLog(input: LogUsageInput) {
  const client = await getUsageClient();
  const { error } = await client.from("request_logs").insert({
    profile_id: input.profileId ?? null,
    anonymous_session_id: input.anonymousSessionId ?? null,
    source_text: input.sourceText ?? null,
    source_url: input.sourceUrl ?? null,
    metadata: input.metadata ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function countAnonymousRequests(
  anonymousSessionId: string,
  fallbackCount: number,
) {
  if (!hasSupabaseAdminAccess()) {
    return fallbackCount;
  }

  const client = createSupabaseAdminClient();

  const { data, error } = await client.rpc("count_requests_today", {
    p_anonymous_session_id: anonymousSessionId,
    p_timezone: QUOTA_TIME_ZONE,
  });

  if (error && !isMissingRpcFunctionError(error)) {
    throw error;
  }

  if (!error && typeof data === "number") {
    return data;
  }

  const { startAt, endAt } = getQuotaWindow();
  const { count, error: fallbackError } = await client
    .from("request_logs")
    .select("id", { count: "exact", head: true })
    .eq("anonymous_session_id", anonymousSessionId)
    .gte("requested_at", startAt)
    .lt("requested_at", endAt);

  if (fallbackError) {
    throw fallbackError;
  }

  return count ?? fallbackCount;
}

export async function countProfileRequestsToday(profileId: string) {
  const client = hasSupabaseAdminAccess()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data, error } = await client.rpc("count_requests_today", {
    p_profile_id: profileId,
    p_timezone: QUOTA_TIME_ZONE,
  });

  if (error && !isMissingRpcFunctionError(error)) {
    throw error;
  }

  if (!error && typeof data === "number") {
    return data;
  }

  const { startAt, endAt } = getQuotaWindow();
  const { count, error: fallbackError } = await client
    .from("request_logs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId)
    .gte("requested_at", startAt)
    .lt("requested_at", endAt);

  if (fallbackError) {
    throw fallbackError;
  }

  return count ?? 0;
}

export async function getProfileQuotaSnapshot(
  profileId: string,
  creditsBalance: number,
): Promise<ProfileQuotaSnapshot> {
  const usedToday = await countProfileRequestsToday(profileId);

  return {
    usedToday,
    dailyLimit: AUTHENTICATED_DAILY_REQUEST_LIMIT,
    dailyRemaining: getDailyRemaining(usedToday, AUTHENTICATED_DAILY_REQUEST_LIMIT),
    creditsBalance,
  };
}

export async function recordAnonymousRequestUsage(
  input: AnonymousUsageInput,
): Promise<AnonymousUsageResult> {
  if (hasSupabaseAdminAccess()) {
    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .rpc("record_anonymous_request_usage", {
        p_anonymous_session_id: input.anonymousSessionId,
        p_source_text: input.sourceText ?? null,
        p_source_url: input.sourceUrl ?? null,
        p_metadata: input.metadata ?? null,
        p_daily_limit: ANONYMOUS_REQUEST_LIMIT,
        p_timezone: QUOTA_TIME_ZONE,
      })
      .single();

    if (error && !isMissingRpcFunctionError(error)) {
      if (isQuotaExceededRpcError(error)) {
        throw toQuotaExceededError("未登录用户每天最多只能解析 2 条内容，请先登录后继续。");
      }

      throw error;
    }

    if (!error && data) {
      return {
        usedToday: data.used_today,
        dailyLimit: data.daily_limit,
        dailyRemaining: data.daily_remaining,
      };
    }
  }

  const usedToday = await countAnonymousRequests(input.anonymousSessionId, 0);
  if (usedToday >= ANONYMOUS_REQUEST_LIMIT) {
    throw toQuotaExceededError("未登录用户每天最多只能解析 2 条内容，请先登录后继续。");
  }

  const nextUsedToday = usedToday + 1;

  if (hasSupabaseAdminAccess()) {
    await insertRequestLog({
      anonymousSessionId: input.anonymousSessionId,
      sourceText: input.sourceText,
      sourceUrl: input.sourceUrl,
      metadata: input.metadata,
    });
  }

  return {
    usedToday: nextUsedToday,
    dailyLimit: ANONYMOUS_REQUEST_LIMIT,
    dailyRemaining: getDailyRemaining(nextUsedToday, ANONYMOUS_REQUEST_LIMIT),
  };
}

export async function recordProfileRequestUsage(
  input: ProfileUsageInput,
): Promise<ProfileUsageResult> {
  if (hasSupabaseAdminAccess()) {
    const client = createSupabaseAdminClient();
    const { data, error } = await client
      .rpc("record_profile_request_usage", {
        p_profile_id: input.profileId,
        p_source_text: input.sourceText ?? null,
        p_source_url: input.sourceUrl ?? null,
        p_metadata: input.metadata ?? null,
        p_daily_limit: AUTHENTICATED_DAILY_REQUEST_LIMIT,
        p_timezone: QUOTA_TIME_ZONE,
      })
      .single();

    if (error && !isMissingRpcFunctionError(error)) {
      if (isQuotaExceededRpcError(error)) {
        throw toQuotaExceededError(
          "今日 5 次登录额度已用完，当前点数不足，请明天再试。",
        );
      }

      throw error;
    }

    if (!error && data) {
      return {
        usedToday: data.used_today,
        dailyLimit: data.daily_limit,
        dailyRemaining: data.daily_remaining,
        creditsBalance: data.credits_balance,
        consumedCredit: data.consumed_credit,
      };
    }
  }

  const client = hasSupabaseAdminAccess()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("credits_balance")
    .eq("id", input.profileId)
    .single();

  if (profileError) {
    throw profileError;
  }

  const usedToday = await countProfileRequestsToday(input.profileId);
  let creditsBalance = profile.credits_balance;
  let consumedCredit = false;

  if (usedToday >= AUTHENTICATED_DAILY_REQUEST_LIMIT) {
    const { data: updatedProfile, error: updateError } = await client
      .from("profiles")
      .update({
        credits_balance: Math.max(creditsBalance - 1, 0),
      })
      .eq("id", input.profileId)
      .gt("credits_balance", 0)
      .select("credits_balance")
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!updatedProfile) {
      throw toQuotaExceededError("今日 5 次登录额度已用完，当前点数不足，请明天再试。");
    }

    creditsBalance = updatedProfile.credits_balance;
    consumedCredit = true;
  }

  await insertRequestLog({
    profileId: input.profileId,
    sourceText: input.sourceText,
    sourceUrl: input.sourceUrl,
    metadata: input.metadata,
  });

  const nextUsedToday = usedToday + 1;
  return {
    usedToday: nextUsedToday,
    dailyLimit: AUTHENTICATED_DAILY_REQUEST_LIMIT,
    dailyRemaining: getDailyRemaining(nextUsedToday, AUTHENTICATED_DAILY_REQUEST_LIMIT),
    creditsBalance,
    consumedCredit,
  };
}
