"use client";

// AppShell — wraps the 5 hero screens (Overview, Studio, Board, Insights, New post).
// Renders the BottomTabBar and reserves space at the bottom so content isn't obscured.
// The old AppHeader stays in place for non-hero screens (/create, /posts, /menu, /messages).

import { BottomTabBar } from "@/components/bottom-tab-bar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex flex-1 flex-col">
      {/* Content scrolls above the tab bar */}
      <div
        className="flex flex-1 flex-col"
        style={{ paddingBottom: "calc(60px + env(safe-area-inset-bottom, 0px))" }}
      >
        {children}
      </div>
      <BottomTabBar />
    </div>
  );
}
