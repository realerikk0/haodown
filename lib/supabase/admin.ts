import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database";
import { getSupabaseAdminEnv } from "@/lib/supabase/env";

let adminClient: SupabaseClient<Database> | null = null;

export function createSupabaseAdminClient() {
  if (!adminClient) {
    const { url, serviceRoleKey } = getSupabaseAdminEnv();
    adminClient = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
