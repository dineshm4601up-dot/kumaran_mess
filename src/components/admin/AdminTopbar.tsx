"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AdminTopbar({ staffEmail }: { staffEmail: string | null }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    await fetch("/api/auth/admin/logout", { method: "POST" }).catch(() => {});
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <Link href="/admin" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-base text-primary-foreground" aria-hidden="true">
          🍲
        </span>
        <span className="hidden text-sm font-bold text-foreground sm:inline sm:text-base">Kumaran Mess Admin</span>
      </Link>

      <div className="flex items-center gap-2 sm:gap-3">
        {staffEmail && <span className="hidden text-sm text-muted-foreground lg:inline">{staffEmail}</span>}
        <ThemeToggle />
        <Button variant="outline" size="sm" isLoading={isLoggingOut} onClick={handleLogout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
