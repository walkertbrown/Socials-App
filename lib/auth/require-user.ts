import "server-only";
import { redirect } from "next/navigation";
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

// Use in page server components: throws a redirect to /login if unauthenticated.
export async function requireUser() {
  const user = await getUserOrNull();
  if (!user) redirect("/login");
  return user;
}
