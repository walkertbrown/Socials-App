import "server-only";
import { graph } from "@/lib/meta/client";

// Publish a single photo + caption to the Facebook Page. Returns the post id.
export async function publishToFacebook(
  pageId: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const res = await graph(`${pageId}/photos`, {
    method: "POST",
    token,
    params: { url: imageUrl, caption, published: "true" },
  });
  return res.post_id || res.id;
}
