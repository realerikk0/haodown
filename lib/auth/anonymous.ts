import { randomUUID } from "node:crypto";

import {
  ANONYMOUS_REQUEST_LIMIT,
  getDailyRemaining,
  getQuotaDayKey,
} from "@/lib/auth/quota";

export const ANONYMOUS_SESSION_COOKIE = "haodown-anon-session";
export const ANONYMOUS_USAGE_COOKIE = "haodown-anon-usage";

const THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30;

interface AnonymousUsageState {
  dayKey: string;
  used: number;
}

export function ensureAnonymousSessionId(currentValue?: string | null) {
  if (currentValue && currentValue.trim().length > 0) {
    return currentValue;
  }

  return randomUUID();
}

export function parseAnonymousUsageCount(rawValue?: string | null) {
  return parseAnonymousUsageState(rawValue).used;
}

export function parseAnonymousUsageState(
  rawValue?: string | null,
  currentDayKey = getQuotaDayKey(),
): AnonymousUsageState {
  if (!rawValue) {
    return {
      dayKey: currentDayKey,
      used: 0,
    };
  }

  const plainParsed = Number.parseInt(rawValue, 10);
  if (Number.isFinite(plainParsed) && String(plainParsed) === rawValue.trim()) {
    return {
      dayKey: currentDayKey,
      used: Math.min(Math.max(plainParsed, 0), ANONYMOUS_REQUEST_LIMIT),
    };
  }

  const [savedDayKey, savedCount] = rawValue.split(":");
  if (!savedDayKey || !savedCount || savedDayKey !== currentDayKey) {
    return {
      dayKey: currentDayKey,
      used: 0,
    };
  }

  const parsed = Number.parseInt(savedCount, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      dayKey: currentDayKey,
      used: 0,
    };
  }

  return {
    dayKey: currentDayKey,
    used: Math.min(parsed, ANONYMOUS_REQUEST_LIMIT),
  };
}

export function getAnonymousRemaining(used: number) {
  return getDailyRemaining(used, ANONYMOUS_REQUEST_LIMIT);
}

export function anonymousQuotaReached(used: number) {
  return getAnonymousRemaining(used) === 0;
}

export function getAnonymousCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS_IN_SECONDS,
  };
}

export function serializeAnonymousUsageCount(
  used: number,
  dayKey = getQuotaDayKey(),
) {
  return `${dayKey}:${Math.min(Math.max(used, 0), ANONYMOUS_REQUEST_LIMIT)}`;
}

export { ANONYMOUS_REQUEST_LIMIT };
