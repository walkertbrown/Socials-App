import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StyleNote {
  note: string | null;
  last_generated_at: string | null;
  pairs_since_last_run: number;
}

// Read the singleton style-note row (id=1).
// Returns null if the migration hasn't run yet.
export async function getStyleNote(): Promise<StyleNote | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("style_note")
    .select("note, last_generated_at, pairs_since_last_run")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  return data as StyleNote;
}

// Overwrite the note + reset the pair counter + stamp the generation time.
export async function saveStyleNote(note: string): Promise<void> {
  const sb = createAdminClient();
  await sb.from("style_note").upsert({
    id: 1,
    note,
    last_generated_at: new Date().toISOString(),
    pairs_since_last_run: 0,
  });
}

// Recompute pairs_since_last_run from the DB — count posted rows that have
// BOTH ai_draft and caption and were created after last_generated_at.
// Called from the cron so the count stays accurate without per-post writes.
export async function refreshPairCount(): Promise<void> {
  const sb = createAdminClient();

  const { data: current } = await sb
    .from("style_note")
    .select("last_generated_at")
    .eq("id", 1)
    .maybeSingle();

  const since = current?.last_generated_at ?? "1970-01-01T00:00:00Z";

  const { count } = await sb
    .from("scheduled_posts")
    .select("id", { count: "exact", head: true })
    .in("status", ["published", "posted"])
    .not("ai_draft", "is", null)
    .not("caption", "is", null)
    .gte("published_at", since);

  await sb
    .from("style_note")
    .update({ pairs_since_last_run: count ?? 0 })
    .eq("id", 1);
}
