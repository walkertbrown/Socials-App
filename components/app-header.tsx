"use client";

import Link from "next/link";

interface AppHeaderProps {
  userEmail: string;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-3">
      <div className="flex items-center gap-5">
        <Link
          href="/dashboard"
          className="text-lg font-semibold tracking-tight"
          style={{ color: "#0f3d3e" }}
        >
          Provenance
        </Link>
        <Link href="/dashboard" className="text-sm text-zinc-500 hover:text-zinc-800">
          Dashboard
        </Link>
      </div>
      <div className="flex items-center gap-4 text-sm text-zinc-500">
        <span className="hidden sm:inline">{userEmail}</span>
        <form action="/auth/signout" method="post">
          <button className="underline hover:text-zinc-800">Sign out</button>
        </form>
      </div>
    </header>
  );
}
