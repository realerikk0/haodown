import { isAuthSessionMissingError } from "@supabase/supabase-js";

export function isMissingAuthSessionError(error: unknown) {
  return isAuthSessionMissingError(error);
}
