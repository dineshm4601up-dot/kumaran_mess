"use client";

import { useLayoutEffect, useState } from "react";
import { cn } from "@/lib/cn";

type ThemePreference = "light" | "dark" | "system";

const COOKIE_NAME = "theme";
const CYCLE: ThemePreference[] = ["system", "light", "dark"];
const META: Record<ThemePreference, { label: string; icon: string }> = {
  system: { label: "System", icon: "🖥️" },
  light: { label: "Light", icon: "☀️" },
  dark: { label: "Dark", icon: "🌙" },
};

function readThemeCookie(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
  const value = match ? decodeURIComponent(match[1]) : null;
  return value === "light" || value === "dark" ? value : "system";
}

function applyTheme(preference: ThemePreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    document.documentElement.setAttribute("data-theme", preference);
    document.cookie = `${COOKIE_NAME}=${preference}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

// A single cycling icon button (System -> Light -> Dark -> System) rather
// than a 3-way segmented control, so it fits the same 40x40 compact slot
// as the other icon buttons in the customer header's mobile icon row and
// the admin topbar, without crowding either at narrow widths.
export function ThemeToggle({ className }: { className?: string }) {
  const [preference, setPreference] = useState<ThemePreference>(() => readThemeCookie());

  // React's Strict Mode remounts once in dev and clears attributes on
  // <html> that JSX doesn't own itself, undoing what the inline
  // head script (src/app/layout.tsx) already set before first paint.
  // This re-applies it — a no-op in production, where Strict Mode's
  // double-render doesn't happen. See Next.js's own guide:
  // node_modules/next/dist/docs/01-app/02-guides/
  // preventing-flash-before-hydration.md, "Re-applying attributes in
  // development".
  useLayoutEffect(() => {
    if (preference !== "system") {
      document.documentElement.setAttribute("data-theme", preference);
    }
  }, [preference]);

  function cycle() {
    const next = CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length];
    setPreference(next);
    applyTheme(next);
  }

  const current = META[preference];
  const next = META[CYCLE[(CYCLE.indexOf(preference) + 1) % CYCLE.length]];

  return (
    <button
      type="button"
      onClick={cycle}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-lg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
      aria-label={`Theme: ${current.label}. Click to switch to ${next.label}.`}
      title={`Theme: ${current.label}`}
    >
      <span aria-hidden="true">{current.icon}</span>
    </button>
  );
}
