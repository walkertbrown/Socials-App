import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Graphic } from "@/lib/types";

// Create a saved graphic row. Called only on explicit Save — preview renders are
// transient and never land here.
export async function createGraphic(input: {
  design_spec: Record<string, unknown>;
  png_path: string;
  size: "feed" | "story";
}): Promise<Graphic> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("graphics")
    .insert({ ...input, status: "saved" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Graphic;
}

// All saved graphics, newest first. Used by the compose picker so saved graphics
// can be scheduled like any photo post.
export async function listGraphics(): Promise<Graphic[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("graphics")
    .select("*")
    .eq("status", "saved")
    .order("created_at", { ascending: false });
  return (data ?? []) as Graphic[];
}

// Single graphic by id. Used when publishing to confirm the png_path is present.
export async function getGraphic(id: string): Promise<Graphic | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("graphics")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Graphic) ?? null;
}

// Public URL for a saved graphic in the 'graphics' bucket.
export function getGraphicPublicUrl(pngPath: string): string {
  const sb = createAdminClient();
  const { data } = sb.storage.from("graphics").getPublicUrl(pngPath);
  return data.publicUrl;
}
