import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasSupabaseAdminAccess } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

async function getProfileWithClient(
  client: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function ensureProfileForUser(
  user: Pick<User, "id" | "email">,
  client?: SupabaseClient<Database>,
): Promise<ProfileRow> {
  const scopedClient =
    client ?? (hasSupabaseAdminAccess() ? createSupabaseAdminClient() : await createSupabaseServerClient());

  const existing = await getProfileWithClient(scopedClient, user.id);
  if (existing) {
    if (user.email && existing.email !== user.email) {
      const { data, error } = await scopedClient
        .from("profiles")
        .update({ email: user.email })
        .eq("id", user.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    return existing;
  }

  const { data, error } = await scopedClient
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
      },
      {
        onConflict: "id",
      },
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function countProfileRequests(profileId: string) {
  const client =
    hasSupabaseAdminAccess() ? createSupabaseAdminClient() : await createSupabaseServerClient();

  const { count, error } = await client
    .from("request_logs")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (error) {
    throw error;
  }

  return count ?? 0;
}
