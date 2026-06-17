"use client";

import Link from "next/link";
import { Palette, PenLine, CalendarDays, UtensilsCrossed } from "lucide-react";

const LAUNCHERS = [
  {
    href: "/create",
    title: "Create graphic",
    description: "Design a branded post graphic from a prompt.",
    Icon: Palette,
  },
  {
    href: "/compose",
    title: "New post",
    description: "Pick a photo or graphic and post it across platforms.",
    Icon: PenLine,
  },
  {
    href: "/posts",
    title: "Scheduled",
    description: "Review, retry, or cancel posts in the queue.",
    Icon: CalendarDays,
  },
  {
    href: "/menu",
    title: "Menu Maker",
    description: "PDF menu to full PNG + square Instagram sections.",
    Icon: UtensilsCrossed,
  },
] as const;

export function StudioCards() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {LAUNCHERS.map(({ href, title, description, Icon }) => (
        <Link
          key={href}
          href={href}
          className="group flex flex-col gap-3 p-5 transition-colors"
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
          {/* Icon in a small rounded square */}
          <div
            className="flex items-center justify-center rounded"
            style={{ width: 36, height: 36, background: "var(--gold-dim)", border: "1px solid var(--gold-border)" }}
          >
            <Icon size={16} strokeWidth={1.8} style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
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
