interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

interface SupabaseAdminEnv extends SupabasePublicEnv {
  serviceRoleKey: string;
}

function readEnv(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(
    readEnv("NEXT_PUBLIC_SUPABASE_URL") &&
      readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}

export function hasSupabaseAdminAccess() {
  return isSupabaseConfigured() && Boolean(readEnv("SUPABASE_SERVICE_ROLE_KEY"));
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const publishableKey = readEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

  if (!url || !publishableKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return {
    url,
    publishableKey,
  };
}

export function getSupabaseAdminEnv(): SupabaseAdminEnv {
  const publicEnv = getSupabasePublicEnv();
  const serviceRoleKey = readEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }

  return {
    ...publicEnv,
    serviceRoleKey,
  };
}
