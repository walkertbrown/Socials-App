import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { ScreenEyebrow } from "@/components/screen-eyebrow";
import { StudioCards } from "./studio-cards";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <AppShell>
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pt-10 pb-4">
        <ScreenEyebrow
          label="STUDIO"
          title="Make something"
          subtitle="Create content, manage your schedule, and build assets."
        />
        <StudioCards />
      </main>
    </AppShell>
  );
}
