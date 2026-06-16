import { requireUser } from "@/lib/auth/require-user";
import { getTextSafePhotoIds } from "@/lib/graphics/pick-graphic-photo";
import { CreateClient } from "./create-client";

// Server component: auth-gates the page and passes text-safe photo ids to
// the client so the AI and the photo-swap control both have the right list.
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ photo?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const textSafePhotoIds = await getTextSafePhotoIds();

  return (
    <CreateClient
      textSafePhotoIds={textSafePhotoIds}
      preselectedPhotoId={params.photo ?? null}
      userEmail={user.email ?? ""}
    />
  );
}
