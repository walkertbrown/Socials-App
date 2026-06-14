import "server-only";
import { graph } from "@/lib/meta/client";

// ── IG Reel: 2-step publish ───────────────────────────────────────────────────
//
// Step 1 (tick 1): POST {ig-user}/media with media_type=REELS + video_url.
//   Meta starts ingesting the video asynchronously. Returns container id.
// Step 2 (later tick): Poll GET {container}?fields=status_code until FINISHED,
//   then POST {ig-user}/media_publish creation_id={container}.

// Create an IG Reel container. Returns the container id to persist and poll.
export async function createIgReelContainer(
  igUserId: string,
  token: string,
  videoUrl: string,
  caption: string
): Promise<string> {
  const res = await graph(`${igUserId}/media`, {
    method: "POST",
    token,
    params: { media_type: "REELS", video_url: videoUrl, caption },
  });
  return res.id as string;
}

// Poll the container until FINISHED, then publish. Call from the advance tick.
// Returns the published IG media id on success, throws on error/timeout.
export async function publishIgReelContainer(
  igUserId: string,
  token: string,
  containerId: string
): Promise<string> {
  // Poll up to ~4 minutes (24 × 10 s). Reels processing takes 30–120 s typically.
  for (let i = 0; i < 24; i++) {
    const status = await graph(containerId, {
      token,
      params: { fields: "status_code" },
    });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error(`Instagram Reel container ${containerId} entered status: ${status.status_code}`);
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }

  const published = await graph(`${igUserId}/media_publish`, {
    method: "POST",
    token,
    params: { creation_id: containerId },
  });
  return published.id as string;
}
