"use client";

// BottomTabBar — fixed bottom nav for all hero screens.
// 5 tabs: Overview · Studio · Board · Insights · Outreach.
// Active tab renders in --gold (teal). Clears iOS home indicator via safe-area inset.
// Desktop: centered with max-width so it doesn't stretch edge-to-edge.
//
// Sub-screens of Studio (/compose, /create, /posts, /menu) keep the Studio
// tab lit so the user always knows where they are in the nav hierarchy.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Grid2x2, BarChart2, Mail } from "lucide-react";

// Routes that belong under a non-direct-match parent tab.
const STUDIO_SUB_ROUTES = ["/compose", "/create", "/posts", "/menu", "/post"];

const TABS = [
  { href: "/dashboard", label: "Overview",  Icon: LayoutDashboard },
  { href: "/studio",    label: "Studio",    Icon: Sparkles },
  { href: "/board",     label: "Board",     Icon: Grid2x2 },
  { href: "/insights",  label: "Insights",  Icon: BarChart2 },
  { href: "/outreach",  label: "Outreach",  Icon: Mail },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  function isActive(href: string): boolean {
    if (pathname === href) return true;
    // Studio tab also lights up for its sub-screens.
    if (href === "/studio") {
      return STUDIO_SUB_ROUTES.some((sub) => pathname === sub || pathname.startsWith(sub + "/"));
    }
    // Other tabs: prefix match (but not for dashboard to avoid false positives).
    if (href !== "/dashboard") return pathname.startsWith(href);
    return false;
  }

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
          const active = isActive(href);
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
