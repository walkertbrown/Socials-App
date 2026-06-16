"use client";

import Link from "next/link";
import { useTheme } from "@/components/theme-provider";

interface AppHeaderProps {
  userEmail: string;
}

// Sun icon — shown in dark mode (click to go light)
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

// Moon icon — shown in light mode (click to go dark)
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="flex items-center justify-between px-5 py-3"
      style={{
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-5">
        <Link
          href="/dashboard"
          className="text-lg tracking-tight"
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          Provenance
        </Link>
        <Link
          href="/dashboard"
          className="text-sm"
          style={{ color: "var(--text-dim)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          Dashboard
        </Link>
      </div>

      <div className="flex items-center gap-4 text-sm" style={{ color: "var(--text-dim)" }}>
        <span className="hidden sm:inline">{userEmail}</span>

        {/* Theme toggle: sun in dark mode, moon in light mode */}
        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          style={{ color: "var(--text-dim)" }}
          className="flex items-center"
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--gold)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          {theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </button>

        <form action="/auth/signout" method="post">
          <button
            className="underline"
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
