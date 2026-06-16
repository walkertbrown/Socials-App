"use client";

import Link from "next/link";

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

export function StudioCards() {
  return (
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
  );
}
