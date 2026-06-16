import "server-only";
import { graph, requireCredentials } from "@/lib/meta/client";

// Send a DM reply via the Meta Messenger API.
// platform determines which id to post to (ig_user_id vs page_id).
export async function sendDmReply(
  platform: "instagram" | "facebook",
  recipientId: string,
  text: string
): Promise<string> {
  const creds = await requireCredentials();
  const senderId =
    platform === "instagram" ? creds.ig_user_id : creds.page_id;
  if (!senderId) throw new Error(`No ${platform} id in stored credentials`);

  const result = await graph(`${senderId}/messages`, {
    method: "POST",
    token: creds.page_token!,
    params: {
      recipient: JSON.stringify({ id: recipientId }),
      message: JSON.stringify({ text }),
    },
  });

  // Meta returns { recipient_id, message_id } on success.
  return result.message_id as string;
}
