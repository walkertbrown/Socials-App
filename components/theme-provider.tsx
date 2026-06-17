"use client";

// ThemeProvider — manages dark/light toggle state and persists to localStorage.
// Wrap the app in this so any component can call useTheme() to read or flip the theme.
//
// Bug fix vs v1: toggleTheme used to overwrite the entire <html> className, which
// stripped the font variable classes injected by next/font. Now it only swaps
// "dark"/"light" inside the existing className string, leaving everything else intact.

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

// fontClasses is passed from layout.tsx so we can restore them if ever needed,
// but primarily we preserve them by only swapping the theme token in-place.
export function ThemeProvider({
  children,
  fontClasses: _fontClasses,
}: {
  children: React.ReactNode;
  fontClasses?: string;
}) {
  // Default to dark; the inline no-flash script in layout.tsx has already applied
  // the right class to <html> before React hydrates, so the initial read is correct.
  const [theme, setTheme] = useState<Theme>("dark");

  // On mount, read the persisted preference. The <html> class is already correct
  // (set by the no-flash script), so this just syncs React state to match.
  useEffect(() => {
    const stored = localStorage.getItem("theme") as Theme | null;
    const resolved: Theme = stored === "light" ? "light" : "dark";
    setTheme(resolved);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      // Swap only the theme token — replace "dark"/"light" without touching font vars.
      const el = document.documentElement;
      el.className = el.className
        .replace(/\b(dark|light)\b/g, "")
        .trim()
        .concat(" ", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
