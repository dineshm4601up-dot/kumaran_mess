"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useCart } from "@/lib/cart-context";
import { cn } from "@/lib/cn";
import { buildTelLink } from "@/lib/phone-link";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/orders", label: "My Orders" },
];

const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

export function Header({
  initialCustomer,
  shopPhone,
}: {
  initialCustomer: { fullName: string } | null;
  shopPhone: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { itemCount } = useCart();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const callShopHref = buildTelLink(shopPhone);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setIsMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-[var(--radius-control)] text-sm font-medium transition-colors hover:text-primary",
                FOCUS_RING,
                pathname === link.href ? "text-primary" : "text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {initialCustomer ? (
            <div className="hidden items-center gap-3 sm:flex">
              <span className="text-sm text-muted-foreground">Hi, {initialCustomer.fullName.split(" ")[0]}</span>
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoggingOut}
                className={cn(
                  "rounded-[var(--radius-control)] text-sm font-medium text-foreground hover:text-primary disabled:opacity-60",
                  FOCUS_RING,
                )}
              >
                {isLoggingOut ? "Logging out…" : "Log out"}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className={cn(
                "hidden rounded-[var(--radius-control)] text-sm font-medium text-foreground hover:text-primary sm:inline-block",
                FOCUS_RING,
              )}
            >
              Login
            </Link>
          )}
          {callShopHref && (
            <a
              href={callShopHref}
              className={cn(
                "flex h-10 w-10 items-center justify-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 sm:w-auto sm:px-3.5",
                FOCUS_RING,
              )}
              aria-label="Call Kumaran Mess"
              title="Call Kumaran Mess"
            >
              <span aria-hidden="true">📞</span>
              <span className="hidden text-sm font-medium sm:inline">Call Kumaran Mess</span>
            </a>
          )}
          <ThemeToggle />
          <Link
            href="/cart"
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-lg hover:bg-surface-muted",
              FOCUS_RING,
            )}
            aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
          >
            🛒
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg md:hidden",
              FOCUS_RING,
            )}
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {isMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <nav
          className="border-t border-border bg-surface px-4 py-3 md:hidden"
          aria-label="Primary mobile"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "block min-h-11 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium",
                    FOCUS_RING,
                    pathname === link.href
                      ? "bg-surface-muted text-primary"
                      : "text-foreground hover:bg-surface-muted",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {initialCustomer ? (
              <li>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className={cn(
                    "block min-h-11 w-full rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60",
                    FOCUS_RING,
                  )}
                >
                  {isLoggingOut ? "Logging out…" : "Log out"}
                </button>
              </li>
            ) : (
              [
                { href: "/login", label: "Login" },
                { href: "/register", label: "Register" },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={cn(
                      "block min-h-11 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium",
                      FOCUS_RING,
                      pathname === link.href
                        ? "bg-surface-muted text-primary"
                        : "text-foreground hover:bg-surface-muted",
                    )}
                  >
                    {link.label}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}
