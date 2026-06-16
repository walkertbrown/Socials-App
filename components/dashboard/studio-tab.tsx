import Link from "next/link";

const LAUNCHERS = [
  {
    href: "/create",
    title: "Create graphic",
    description: "Design a branded post graphic from a prompt.",
  },
  {
    href: "/compose",
    title: "New post",
    description: "Pick a photo or graphic and schedule it across platforms.",
  },
  {
    href: "/posts",
    title: "Scheduled",
    description: "Review, retry, or cancel posts in the queue.",
  },
  {
    href: "/menu",
    title: "Menu Maker",
    description: "PDF menu to Google PNG + Instagram squares.",
  },
];

export function StudioTab() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {LAUNCHERS.map(({ href, title, description }) => (
        <Link
          key={href}
          href={href}
          className="group block p-5 transition-colors"
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
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            {title}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--text-dim)" }}>{description}</div>
        </Link>
      ))}
    </div>
  );
}
