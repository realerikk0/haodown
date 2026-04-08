const DAY_IN_MS = 24 * 60 * 60 * 1000;
const QUOTA_OFFSET_IN_MS = 8 * 60 * 60 * 1000;

export const QUOTA_TIME_ZONE = "Asia/Shanghai";
export const ANONYMOUS_REQUEST_LIMIT = 2;
export const AUTHENTICATED_DAILY_REQUEST_LIMIT = 5;

export function getQuotaDayKey(date = new Date()) {
  const shanghaiDate = new Date(date.getTime() + QUOTA_OFFSET_IN_MS);
  return shanghaiDate.toISOString().slice(0, 10);
}

export function getQuotaWindow(date = new Date()) {
  const shanghaiDate = new Date(date.getTime() + QUOTA_OFFSET_IN_MS);
  const startOfShanghaiDayUtc =
    Date.UTC(
      shanghaiDate.getUTCFullYear(),
      shanghaiDate.getUTCMonth(),
      shanghaiDate.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - QUOTA_OFFSET_IN_MS;

  return {
    dayKey: getQuotaDayKey(date),
    startAt: new Date(startOfShanghaiDayUtc).toISOString(),
    endAt: new Date(startOfShanghaiDayUtc + DAY_IN_MS).toISOString(),
  };
}

export function getDailyRemaining(used: number, limit: number) {
  return Math.max(0, limit - Math.max(0, used));
}
