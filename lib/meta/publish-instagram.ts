import "server-only";
import { graph } from "@/lib/meta/client";

// Publish a single image to Instagram: create a media container, wait for it to
// finish processing, then publish it. Returns the IG media id.
export async function publishToInstagram(
  igUserId: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<string> {
  const container = await graph(`${igUserId}/media`, {
    method: "POST",
    token,
    params: { image_url: imageUrl, caption },
  });
  const creationId: string = container.id;

  // Wait for Meta to finish ingesting the image before publishing.
  for (let i = 0; i < 12; i++) {
    const status = await graph(`${creationId}`, { token, params: { fields: "status_code" } });
    if (status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") {
      throw new Error("Instagram could not process the image");
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  const published = await graph(`${igUserId}/media_publish`, {
    method: "POST",
    token,
    params: { creation_id: creationId },
  });
  return published.id;
}
