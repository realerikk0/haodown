import { ApiError } from "@/lib/errors";
import type { Database } from "@/lib/supabase/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminAccess } from "@/lib/supabase/env";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

export function readBearerToken(headerValue?: string | null) {
  if (!headerValue || headerValue.trim().length === 0) {
    return null;
  }

  const match = headerValue.match(BEARER_PREFIX);
  if (!match) {
    throw new ApiError(
      "UNAUTHORIZED",
      "Authorization 头必须使用 Bearer Token。",
      401,
    );
  }

  const token = match[1]?.trim();
  if (!token) {
    throw new ApiError("UNAUTHORIZED", "API Token 不能为空。", 401);
  }

  return token;
}

export function readQueryToken(tokenValue?: string | null) {
  if (tokenValue === null || tokenValue === undefined) {
    return null;
  }

  const token = tokenValue.trim();
  if (!token) {
    throw new ApiError("UNAUTHORIZED", "API Token 不能为空。", 401);
  }

  return token;
}

export function readApiTokenFromRequest(request: Request) {
  const bearerToken = readBearerToken(request.headers.get("authorization"));
  if (bearerToken) {
    return bearerToken;
  }

  const url = new URL(request.url);
  return readQueryToken(url.searchParams.get("code"));
}

export async function findProfileByApiToken(token: string): Promise<ProfileRow> {
  if (!hasSupabaseAdminAccess()) {
    throw new ApiError(
      "UNAUTHORIZED",
      "当前环境未启用 API Token 鉴权。",
      401,
    );
  }

  const client = createSupabaseAdminClient();
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("api_token", token)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ApiError("UNAUTHORIZED", "API Token 无效或已失效。", 401);
  }

  return data;
}
