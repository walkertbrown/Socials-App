import "server-only";
import type { ScheduledPost } from "@/lib/db/posts";
import { markPublished, recordFailure } from "@/lib/db/posts";
import {
  setIgContainerId,
  setFbVideoId,
  setFbUploadDone,
  setStagedPath,
} from "@/lib/db/video-posts";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCredentials } from "@/lib/meta/client";
import { stageVideo } from "@/lib/publish/stage-video";
import { cleanupVideo } from "@/lib/publish/cleanup-video";
import { createIgReelContainer, publishIgReelContainer } from "@/lib/meta/publish-instagram-reel";
import {
  startFbReelUpload,
  triggerFbReelFetch,
  finishFbReel,
} from "@/lib/meta/publish-facebook-reel";

// ── Multi-tick video publish state machine ────────────────────────────────────
//
// Tick 1 (post enters 'publishing'): stage video + create IG container + kick
//   off FB upload. Persists ig_container_id / fb_video_id / staged_path.
// Later tick (post still 'publishing'): poll IG status → publish_ig / finish FB.
//
// The publish_substate column gates each transition so a row in-flight is
// NEVER double-processed: claimVideoInFlight only picks rows with a non-'staging'
// substate, and only after tick 1 sets the next substate.

// Tick 1: stage + kick off both platforms. Called right after claim.
export async function startVideoPublish(post: ScheduledPost): Promise<void> {
  if (!post.photo_id) {
    await recordFailure(post.id, post.attempts, "No video attached to this post");
    return;
  }

  const sb = createAdminClient();
  const { data: photo } = await sb
    .from("photos")
    .select("drive_file_id")
    .eq("id", post.photo_id)
    .maybeSingle();
  if (!photo?.drive_file_id) {
    await recordFailure(post.id, post.attempts, "The video for this post could not be found");
    return;
  }

  let stagedPath: string | null = null;
  try {
    const creds = await requireCredentials();
    const staged = await stageVideo(photo.drive_file_id);
    stagedPath = staged.path;
    // Persist staged path immediately so recovery can clean it up if we crash.
    await setStagedPath(post.id, staged.path);

    if (post.platform === "instagram") {
      if (!creds.ig_user_id) throw new Error("No Instagram account is connected");
      const containerId = await createIgReelContainer(
        creds.ig_user_id,
        creds.page_token!,
        staged.url,
        post.caption
      );
      // Substate advances to 'ig_container_created' — next tick will poll + publish.
      await setIgContainerId(post.id, containerId);
    } else if (post.platform === "facebook") {
      const { videoId, uploadUrl } = await startFbReelUpload(
        creds.page_id!,
        creds.page_token!
      );
      await setFbVideoId(post.id, videoId);
      // Trigger Meta to fetch the video from our public staging URL.
      await triggerFbReelFetch(uploadUrl, creds.page_token!, staged.url);
      // Substate advances to 'fb_upload_done' — next tick will call finish.
      await setFbUploadDone(post.id);
    } else {
      throw new Error(`Unknown platform for video post: ${post.platform}`);
    }
  } catch (e) {
    // If staging succeeded but platform call failed, clean up the staged file.
    if (stagedPath) await cleanupVideo(stagedPath);
    await recordFailure(post.id, post.attempts, (e as Error).message);
  }
}

// Later tick: advance an in-flight video post toward published.
export async function advanceVideoPublish(post: ScheduledPost): Promise<void> {
  let stagedPath: string | null = post.staged_path;
  try {
    const creds = await requireCredentials();

    if (post.platform === "instagram" && post.publish_substate === "ig_container_created") {
      if (!creds.ig_user_id) throw new Error("No Instagram account is connected");
      if (!post.ig_container_id) throw new Error("Missing IG container id");
      const igId = await publishIgReelContainer(
        creds.ig_user_id,
        creds.page_token!,
        post.ig_container_id
      );
      await markPublished(post.id, { ig_post_id: igId });
    } else if (post.platform === "facebook" && post.publish_substate === "fb_upload_done") {
      if (!post.fb_video_id) throw new Error("Missing FB video id");
      await finishFbReel(creds.page_id!, creds.page_token!, post.fb_video_id, post.caption);
      await markPublished(post.id, { fb_post_id: post.fb_video_id });
    } else {
      // Unexpected state — let it be caught by recoverStuck after 30 min.
      return;
    }
  } catch (e) {
    await recordFailure(post.id, post.attempts, (e as Error).message);
  } finally {
    // Clean up staged video after publish (success or failure on final attempt).
    if (stagedPath) await cleanupVideo(stagedPath);
  }
}
