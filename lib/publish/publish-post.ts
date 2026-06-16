import "server-only";
import type { ScheduledPost } from "@/lib/db/posts";
import { markPublished, recordFailure } from "@/lib/db/posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCredentials } from "@/lib/meta/client";
import { stageImage, stageGraphic } from "@/lib/publish/stage-image";
import { cleanupImage } from "@/lib/publish/cleanup-image";
import { publishToFacebook } from "@/lib/meta/publish-facebook";
import { publishToInstagram } from "@/lib/meta/publish-instagram";

// Publishes ONE photo or graphic post that's already been claimed (status 'publishing').
// Each row has a single platform — this dispatches to the right publisher.
//
// Media routing:
//   media_type='image'   → fetch from MinIO, convert to JPEG, stage, publish, cleanup.
//   media_type='graphic' → graphic is already in the public 'graphics' bucket; just
//                          get the public URL (no staging copy, no cleanup needed).
export async function publishPost(post: ScheduledPost): Promise<void> {
  if (!post.photo_id) {
    await recordFailure(post.id, post.attempts, "No photo attached to this post");
    return;
  }

  // Graphic media type: photo_id is the graphic id; png_path comes from the
  // graphics table. No Drive fetch needed.
  if ((post.media_type as string) === "graphic") {
    await publishGraphicPost(post);
    return;
  }

  // Standard image path — reads the original from MinIO.
  const sb = createAdminClient();
  const { data: photo } = await sb
    .from("photos")
    .select("object_key")
    .eq("id", post.photo_id)
    .maybeSingle();
  if (!photo?.object_key) {
    await recordFailure(post.id, post.attempts, "The photo for this post could not be found");
    return;
  }

  let staged: { url: string; path: string } | null = null;
  try {
    const creds = await requireCredentials();
    staged = await stageImage(photo.object_key);

    let fbId: string | null = null;
    let igId: string | null = null;

    // Each row is for exactly ONE platform — no array check needed.
    if (post.platform === "facebook") {
      fbId = await publishToFacebook(creds.page_id!, creds.page_token!, staged.url, post.caption);
    } else if (post.platform === "instagram") {
      if (!creds.ig_user_id) throw new Error("No Instagram account is connected");
      igId = await publishToInstagram(creds.ig_user_id, creds.page_token!, staged.url, post.caption);
    } else {
      throw new Error(`Unknown platform: ${post.platform}`);
    }

    await markPublished(post.id, { fb_post_id: fbId, ig_post_id: igId });
  } catch (e) {
    await recordFailure(post.id, post.attempts, (e as Error).message);
  } finally {
    if (staged?.path) await cleanupImage(staged.path);
  }
}

// Graphic post: already saved in the public 'graphics' bucket. No Drive fetch,
// no JPEG conversion, no staging copy to clean up.
async function publishGraphicPost(post: ScheduledPost): Promise<void> {
  const sb = createAdminClient();
  const { data: graphic } = await sb
    .from("graphics")
    .select("png_path")
    .eq("id", post.photo_id!)
    .maybeSingle();

  if (!graphic?.png_path) {
    await recordFailure(post.id, post.attempts, "The graphic for this post could not be found");
    return;
  }

  try {
    const creds = await requireCredentials();
    const { url } = await stageGraphic(graphic.png_path);

    let fbId: string | null = null;
    let igId: string | null = null;

    if (post.platform === "facebook") {
      fbId = await publishToFacebook(creds.page_id!, creds.page_token!, url, post.caption);
    } else if (post.platform === "instagram") {
      if (!creds.ig_user_id) throw new Error("No Instagram account is connected");
      igId = await publishToInstagram(creds.ig_user_id, creds.page_token!, url, post.caption);
    } else {
      throw new Error(`Unknown platform: ${post.platform}`);
    }

    await markPublished(post.id, { fb_post_id: fbId, ig_post_id: igId });
  } catch (e) {
    await recordFailure(post.id, post.attempts, (e as Error).message);
  }
}
