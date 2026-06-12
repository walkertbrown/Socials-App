import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. SERVER ONLY — bypasses RLS, so it must never reach the browser.
// Used for all data + storage work (sync, processing, board reads, pick toggles).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
