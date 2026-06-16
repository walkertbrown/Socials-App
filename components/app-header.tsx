"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";

interface AppHeaderProps {
  userEmail: string;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/board", label: "Board" },
  { href: "/posts", label: "Posts" },
  { href: "/compose", label: "Compose" },
  { href: "/create", label: "Create" },
  { href: "/insights", label: "Insights" },
  { href: "/menu", label: "Menu" },
];

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  return (
    <header
      className="flex items-center gap-2 px-4 overflow-x-auto"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        minHeight: 44,
      }}
    >
      {/* Wordmark */}
      <Link
        href="/dashboard"
        className="text-base tracking-tight shrink-0 pr-3"
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 600,
          color: "var(--text-primary)",
          textDecoration: "none",
          borderRight: "1px solid var(--border-hi)",
        }}
      >
        Provenance
      </Link>

      {/* Nav tabs */}
      {NAV.map(({ href, label }) => {
        const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className="text-sm whitespace-nowrap px-2 py-3 shrink-0"
            style={{
              color: active ? "var(--gold)" : "var(--text-dim)",
              borderBottom: active ? "2px solid var(--gold)" : "2px solid transparent",
              fontWeight: active ? 600 : 400,
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = "var(--text-secondary)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = "var(--text-dim)"; }}
          >
            {label}
          </Link>
        );
      })}

      {/* Right controls — pushed to end */}
      <div className="flex items-center gap-3 ml-auto shrink-0 pl-3" style={{ borderLeft: "1px solid var(--border-hi)" }}>
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          className="flex items-center"
          style={{ color: "var(--text-dim)", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <form action="/auth/signout" method="post">
          <button
            className="text-sm underline"
            style={{ color: "var(--text-dim)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
