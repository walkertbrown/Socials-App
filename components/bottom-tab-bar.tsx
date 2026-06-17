"use client";

// BottomTabBar — fixed bottom nav for all hero screens.
// 4 tabs: Overview · Studio · Board · Insights.
// Active tab renders in --gold (teal). Clears iOS home indicator via safe-area inset.
// Desktop: centered with max-width so it doesn't stretch edge-to-edge.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Grid2x2, BarChart2 } from "lucide-react";

const TABS = [
  { href: "/dashboard", label: "Overview",  Icon: LayoutDashboard },
  { href: "/studio",    label: "Studio",    Icon: Sparkles },
  { href: "/board",     label: "Board",     Icon: Grid2x2 },
  { href: "/insights",  label: "Insights",  Icon: BarChart2 },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Inner wrapper: centers on wide screens */}
      <div
        className="mx-auto flex"
        style={{ maxWidth: 480 }}
      >
        {TABS.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
              style={{ textDecoration: "none" }}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                size={22}
                strokeWidth={1.6}
                style={{ color: active ? "var(--gold)" : "var(--text-dim)" }}
              />
              <span
                className="text-[10px] font-medium tracking-wide"
                style={{ color: active ? "var(--gold)" : "var(--text-dim)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
