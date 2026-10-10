"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export const ADMIN_NAV_LINKS = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/categories", label: "Categories", icon: "🗂️" },
  { href: "/admin/products", label: "Products", icon: "🍱" },
  { href: "/admin/orders", label: "Orders", icon: "🧾" },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

function isLinkActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export function AdminNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();

  if (orientation === "horizontal") {
    return (
      <nav
        aria-label="Admin"
        className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-2 py-2 md:hidden"
      >
        {ADMIN_NAV_LINKS.map((link) => {
          const isActive = isLinkActive(pathname, link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium",
                isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
              )}
            >
              {link.icon} {link.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Admin" className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 md:flex">
      {ADMIN_NAV_LINKS.map((link) => {
        const isActive = isLinkActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2.5 text-sm font-medium",
              isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-surface-muted",
            )}
          >
            <span aria-hidden="true">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
