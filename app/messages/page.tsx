import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAllDmThreads } from "@/lib/db/dm-threads";
import { MessagesClient } from "@/app/messages/messages-client";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const threads = await getAllDmThreads();
  return <MessagesClient initialThreads={threads} />;
}
