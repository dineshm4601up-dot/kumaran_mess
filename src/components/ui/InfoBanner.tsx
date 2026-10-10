import { cn } from "@/lib/cn";

type Tone = "info" | "warning";

const toneClasses: Record<Tone, string> = {
  info: "border-primary/30 bg-primary/5 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
};

export function InfoBanner({
  tone = "info",
  children,
}: {
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn("rounded-[var(--radius-control)] border px-4 py-3 text-sm", toneClasses[tone])}
    >
      {children}
    </div>
  );
}
