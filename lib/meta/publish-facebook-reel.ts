import "server-only";
import { graph } from "@/lib/meta/client";

// ── FB Reel: 3-step publish ───────────────────────────────────────────────────
//
// The Facebook Reels API does NOT use the normal graph() JSON helper for the
// upload step — the upload URL is on rupload.facebook.com and expects a
// different call pattern.
//
// Step 1: POST {page-id}/video_reels   body: upload_phase=start
//   → returns { video_id, upload_url }   (upload_url is on rupload.facebook.com)
// Step 2: POST {upload_url}
//   headers: Authorization: OAuth {page_token}
//             file_url: {staged public video URL}
//   Meta fetches the video itself; we do NOT send bytes. Plain fetch, not graph().
// Step 3: POST {page-id}/video_reels   body: upload_phase=finish, video_id,
//           video_state=PUBLISHED, description={caption}

// Returns the video_id assigned by Meta (persisted as fb_video_id).
export async function startFbReelUpload(
  pageId: string,
  token: string
): Promise<{ videoId: string; uploadUrl: string }> {
  const res = await graph(`${pageId}/video_reels`, {
    method: "POST",
    token,
    params: { upload_phase: "start" },
  });
  return { videoId: res.video_id as string, uploadUrl: res.upload_url as string };
}

// Trigger Meta to fetch the video from our public staging URL.
// Uses plain fetch (not graph()) because the upload endpoint is on rupload.
export async function triggerFbReelFetch(
  uploadUrl: string,
  pageToken: string,
  videoUrl: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageToken}`,
      file_url: videoUrl,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FB Reel upload trigger failed (HTTP ${res.status}): ${text}`);
  }
}

// Finish the upload and publish the Reel.
export async function finishFbReel(
  pageId: string,
  token: string,
  videoId: string,
  caption: string
): Promise<void> {
  await graph(`${pageId}/video_reels`, {
    method: "POST",
    token,
    params: {
      upload_phase: "finish",
      video_id: videoId,
      video_state: "PUBLISHED",
      description: caption,
    },
  });
}
