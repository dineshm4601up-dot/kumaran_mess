export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span aria-hidden="true">{icon}</span>}
      </div>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
