import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-bold text-foreground">Kumaran Mess</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Home-style meals and tiffin, freshly made and delivered. Cash on delivery.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/menu" className="text-muted-foreground hover:text-primary">
            Menu
          </Link>
          <Link href="/orders" className="text-muted-foreground hover:text-primary">
            Track order
          </Link>
          <Link href="/login" className="text-muted-foreground hover:text-primary">
            Login
          </Link>
          <Link href="/admin/login" className="text-muted-foreground hover:text-primary">
            Staff login
          </Link>
        </nav>
      </div>
      <p className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} Kumaran Mess. All rights reserved.
      </p>
    </footer>
  );
}
