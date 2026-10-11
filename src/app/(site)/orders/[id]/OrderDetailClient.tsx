"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OrderStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { formatCurrency } from "@/lib/format";
import type { CustomerOrderDetail, OrderStatus } from "@/types";

const POLL_INTERVAL_MS = 20_000;
const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function OrderDetailClient({
  initialOrder,
  cancellableStatuses,
}: {
  initialOrder: CustomerOrderDetail;
  cancellableStatuses: OrderStatus[];
}) {
  const [order, setOrder] = useState(initialOrder);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);

  const isTerminal = TERMINAL_STATUSES.includes(order.status);
  const canCancel = !isTerminal && cancellableStatuses.includes(order.status);

  // Polling, not a realtime subscription: customers in this app don't
  // hold a real Supabase session (see the Phase 3 architecture notes),
  // so a browser-side Supabase Realtime subscription has no session to
  // satisfy the same RLS policies the REST API relies on. Polling a
  // same-origin route that re-checks the session server-side is the
  // pattern that actually fits — simple, and "appropriate" for an app
  // this size rather than building a custom relay just for this.
  useEffect(() => {
    if (isTerminal) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.order) setOrder(data.order);
      } catch {
        // Transient network issues shouldn't surface as an error here —
        // the next poll tries again.
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [order.id, isTerminal]);

  async function handleCancel() {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const response = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      const data = await response.json();

      if (!response.ok) {
        setCancelError(data.message ?? "Couldn't cancel this order.");
        return;
      }

      if (data.order) setOrder(data.order);
      setShowCancelForm(false);
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link href="/orders" className="text-sm text-muted-foreground hover:text-primary">
        &larr; My Orders
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-foreground">{order.orderNumber}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
        <Link href={`/orders/${order.id}/bill`} className="text-sm font-medium text-primary hover:underline">
          View Bill
        </Link>
      </div>

      {order.status === "cancelled" && (
        <div className="mt-4">
          <InfoBanner tone="warning">
            This order was cancelled{order.cancelledReason ? `: ${order.cancelledReason}` : "."}
          </InfoBanner>
        </div>
      )}
      {order.status === "delivered" && (
        <div className="mt-4">
          <InfoBanner>This order has been delivered. We hope you enjoyed it!</InfoBanner>
        </div>
      )}

      <section className="mt-6 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Status timeline</h2>
        <ol className="mt-3 flex flex-col gap-3">
          {order.statusHistory.map((event) => (
            <li key={event.id} className="flex items-center gap-3 text-sm">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              <span className="flex-1 text-foreground">{STATUS_LABELS[event.toStatus]}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Items</h2>
        <ul className="mt-3 flex flex-col divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-muted-foreground">
                {item.productName} &times; {item.quantity}
              </span>
              <span className="font-medium text-foreground">{formatCurrency(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="text-foreground">{formatCurrency(order.subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span className="text-foreground">{formatCurrency(order.deliveryFee)}</span>
          </div>
          <div className="flex items-center justify-between font-medium">
            <span className="text-foreground">Total</span>
            <span className="text-foreground">{formatCurrency(order.total)}</span>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Cash on Delivery &mdash;{" "}
          {order.paymentStatus === "collected"
            ? "collected."
            : order.paymentStatus === "refused"
              ? "payment was refused."
              : "pay when your order arrives."}
        </p>
      </section>

      <section className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-foreground">Delivery address</h2>
        <p className="mt-2 text-sm text-foreground">{order.deliveryAddressLine}</p>
        {order.deliveryLandmark && <p className="text-sm text-muted-foreground">Near {order.deliveryLandmark}</p>}
        {order.deliveryInstructions && (
          <p className="mt-1 text-sm text-muted-foreground">Note: {order.deliveryInstructions}</p>
        )}
      </section>

      {canCancel && (
        <section className="mt-4 rounded-[var(--radius-card)] border border-border bg-surface p-4">
          {showCancelForm ? (
            <div className="flex flex-col gap-3">
              <label className="text-sm font-medium text-foreground" htmlFor="cancel-reason">
                Reason (optional)
              </label>
              <textarea
                id="cancel-reason"
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                rows={2}
                className="rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
              />
              <div className="flex gap-3">
                <Button variant="danger" isLoading={isCancelling} onClick={handleCancel}>
                  Confirm cancellation
                </Button>
                <Button variant="outline" onClick={() => setShowCancelForm(false)}>
                  Never mind
                </Button>
              </div>
              {cancelError && <InfoBanner tone="warning">{cancelError}</InfoBanner>}
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowCancelForm(true)}>
              Cancel this order
            </Button>
          )}
        </section>
      )}
    </div>
  );
}
