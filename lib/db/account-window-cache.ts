import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface WindowCacheRow {
  platform: string;
  window_key: string;
  payload: unknown;
  fetched_at: string;
}

// Return a cached window payload if it was written within the last 30 minutes.
// Returns null when the cache is absent, stale, or the table doesn't exist yet.
export async function getCachedWindow(
  platform: string,
  windowKey: string
): Promise<WindowCacheRow | null> {
  try {
    const sb = createAdminClient();
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data } = await sb
      .from("account_window_cache")
      .select("platform, window_key, payload, fetched_at")
      .eq("platform", platform)
      .eq("window_key", windowKey)
      .gt("fetched_at", thirtyMinsAgo)
      .maybeSingle();

    return (data as WindowCacheRow) ?? null;
  } catch (err) {
    // Degrade gracefully when the table doesn't exist yet (42P01 = undefined_table).
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return null;
    // Other DB errors: log and return null so the caller falls through to a live fetch.
    console.error("[account-window-cache] getCachedWindow error:", err);
    return null;
  }
}

// Upsert a window payload — keyed on (platform, window_key).
// UNIQUE constraint on those two columns ensures concurrent upserts are safe.
export async function setCachedWindow(
  platform: string,
  windowKey: string,
  payload: unknown
): Promise<void> {
  try {
    const sb = createAdminClient();
    await sb.from("account_window_cache").upsert(
      {
        platform,
        window_key: windowKey,
        payload,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "platform,window_key" }
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "42P01") {
      // Log but never throw — cache writes are best-effort.
      console.error("[account-window-cache] setCachedWindow error:", err);
    }
  }
}
