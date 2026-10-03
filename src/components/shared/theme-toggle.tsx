"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * Accessible light/dark switch. Renders a stable placeholder until mounted to
 * avoid a hydration mismatch (theme is unknown on the server).
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground/80 backdrop-blur transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
        className,
      )}
    >
      {/* Render both, cross-fade via opacity so there is no layout shift */}
      <Sun
        className={cn(
          "size-4.5 transition-all duration-300",
          mounted && isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
        aria-hidden
      />
      <Moon
        className={cn(
          "absolute size-4.5 transition-all duration-300",
          mounted && isDark ? "scale-100 rotate-0 opacity-100" : "scale-0 rotate-90 opacity-0",
        )}
        aria-hidden
      />
    </button>
  );
}
