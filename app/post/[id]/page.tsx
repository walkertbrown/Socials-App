import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPost } from "@/lib/db/posts";
import { PostClient } from "@/app/post/[id]/post-client";

export const dynamic = "force-dynamic";

// The screen the reminder notification opens: grab the video + caption, post it
// manually, mark it done.
export default async function PostTimePage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const post = await getPost(id);
  if (!post || !post.photo_id) notFound();

  return (
    <PostClient
      id={post.id}
      photoId={post.photo_id}
      caption={post.caption}
      platforms={post.platforms}
      done={post.status === "posted"}
    />
  );
}
