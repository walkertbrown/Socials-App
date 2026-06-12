import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Confirms there's a logged-in user. Route handlers use this as a second line
// of defense behind the proxy. Returns the user, or null if unauthenticated.
export async function getUserOrNull() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
