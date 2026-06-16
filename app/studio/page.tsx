import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { StudioCards } from "./studio-cards";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <AppHeader userEmail={user.email ?? ""} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
        <div>
          <h1
            className="text-2xl tracking-tight"
            style={{ fontFamily: "var(--font-serif)", fontWeight: 600, color: "var(--text-primary)" }}
          >
            Studio
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Create content, manage your schedule, and build assets.
          </p>
        </div>

        <StudioCards />
      </main>
    </div>
  );
}
