import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MetaCredentials {
  page_id: string | null;
  ig_user_id: string | null;
  page_token: string | null;
  token_expires_at: string | null;
}

export async function getMetaCredentials(): Promise<MetaCredentials | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("meta_credentials")
    .select("page_id, ig_user_id, page_token, token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  return (data as MetaCredentials) ?? null;
}

export async function saveMetaCredentials(c: Partial<MetaCredentials>): Promise<void> {
  const sb = createAdminClient();
  await sb
    .from("meta_credentials")
    .update({ ...c, updated_at: new Date().toISOString() })
    .eq("id", 1);
}
