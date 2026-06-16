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
];

export function StudioTab() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {LAUNCHERS.map(({ href, title, description }) => (
        <Link
          key={href}
          href={href}
          className="group block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-[#0f3d3e] hover:bg-[#0f3d3e]/5"
        >
          <div className="text-sm font-semibold text-zinc-900 group-hover:text-[#0f3d3e]">
            {title}
          </div>
          <div className="mt-1 text-xs text-zinc-500">{description}</div>
        </Link>
      ))}
    </div>
  );
}
