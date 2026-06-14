import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPostGroups } from "@/lib/db/post-groups";
import { PostsClient } from "@/app/posts/posts-client";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const groups = await listPostGroups();
  return <PostsClient initialGroups={groups} />;
}
