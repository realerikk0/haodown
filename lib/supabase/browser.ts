"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database";

let browserClient: SupabaseClient<Database> | null = null;

export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
}
