"use client";

// ThemeProvider — manages dark/light toggle state and persists to localStorage.
// Wrap the app in this so any component can call useTheme() to read or flip the theme.

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
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
      // Apply the class immediately — don't wait for a re-render.
      document.documentElement.className = next;
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
