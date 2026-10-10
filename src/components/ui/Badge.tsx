import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/types";

type Tone = "success" | "warning" | "danger" | "neutral" | "primary";

const toneClasses: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-surface-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
        toneClasses[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<OrderStatus, Tone> = {
  pending: "neutral",
  confirmed: "primary",
  preparing: "warning",
  ready: "warning",
  out_for_delivery: "primary",
  delivered: "success",
  cancelled: "danger",
};

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}
