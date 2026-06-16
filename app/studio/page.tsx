import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import Link from "next/link";

export const dynamic = "force-dynamic";

const LAUNCHERS = [
  {
    href: "/compose",
    title: "Create a post",
    description: "Pick a photo or graphic and post it across platforms.",
    icon: "✦",
  },
  {
    href: "/posts",
    title: "Schedule a post",
    description: "Review, retry, or cancel posts in the queue.",
    icon: "◷",
  },
  {
    href: "/create",
    title: "Graphic generator",
    description: "Design a branded post graphic from a prompt.",
    icon: "◈",
  },
  {
    href: "/menu",
    title: "Menu converter",
    description: "PDF menu to full PNG + square Instagram sections.",
    icon: "▤",
  },
];

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LAUNCHERS.map(({ href, title, description, icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-3 p-6 transition-colors"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--gold-dim)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--gold-border)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--surface)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              }}
            >
              <span className="text-2xl" style={{ color: "var(--gold)" }}>{icon}</span>
              <div>
                <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {title}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>
                  {description}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
