import "server-only";
import type { ScheduledPost } from "@/lib/db/posts";
import { markPublished, recordFailure } from "@/lib/db/posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCredentials } from "@/lib/meta/client";
import { stageImage } from "@/lib/publish/stage-image";
import { cleanupImage } from "@/lib/publish/cleanup-image";
import { publishToFacebook } from "@/lib/meta/publish-facebook";
import { publishToInstagram } from "@/lib/meta/publish-instagram";

// Publishes ONE post that's already been claimed (status 'publishing'). Stages
// the image, posts to each chosen platform, records the outcome, and ALWAYS
// cleans up the staged public image.
export async function publishPost(post: ScheduledPost): Promise<void> {
  if (!post.photo_id) {
    await recordFailure(post.id, post.attempts, "No photo attached to this post");
    return;
  }

  const sb = createAdminClient();
  const { data: photo } = await sb
    .from("photos")
    .select("drive_file_id")
    .eq("id", post.photo_id)
    .maybeSingle();
  if (!photo?.drive_file_id) {
    await recordFailure(post.id, post.attempts, "The photo for this post could not be found");
    return;
  }

  let staged: { url: string; path: string } | null = null;
  try {
    const creds = await requireCredentials();
    staged = await stageImage(photo.drive_file_id);

    let fbId: string | null = null;
    let igId: string | null = null;
    if (post.platforms.includes("facebook")) {
      fbId = await publishToFacebook(creds.page_id!, creds.page_token!, staged.url, post.caption);
    }
    if (post.platforms.includes("instagram")) {
      if (!creds.ig_user_id) throw new Error("No Instagram account is connected");
      igId = await publishToInstagram(creds.ig_user_id, creds.page_token!, staged.url, post.caption);
    }
    await markPublished(post.id, { fb_post_id: fbId, ig_post_id: igId });
  } catch (e) {
    await recordFailure(post.id, post.attempts, (e as Error).message);
  } finally {
    if (staged) await cleanupImage(staged.path);
  }
}
