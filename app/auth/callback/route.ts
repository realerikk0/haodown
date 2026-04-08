import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next") ?? "/";
  const redirectUrl = new URL(nextPath, request.url);

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(redirectUrl);
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(redirectUrl);
}
