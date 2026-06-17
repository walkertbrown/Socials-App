import { requireUser } from "@/lib/auth/require-user";
import { CreateClient } from "./create-client";

// Server component: auth-gates the page.
// The new image-gen flow doesn't use library photos, so no photo id plumbing needed.
export default async function CreatePage() {
  const user = await requireUser();
  return <CreateClient userEmail={user.email ?? ""} />;
}
