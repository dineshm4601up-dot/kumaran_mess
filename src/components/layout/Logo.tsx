import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-lg text-primary-foreground"
        aria-hidden="true"
      >
        🍲
      </span>
      <span className="hidden text-lg font-bold tracking-tight text-foreground sm:inline">Kumaran Mess</span>
    </Link>
  );
}
