"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, OrderStatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { OrderLocationMap } from "@/components/admin/OrderLocationMap";
import { WhatsAppConfirmationButton } from "@/components/admin/WhatsAppConfirmationButton";
import { CallButton } from "@/components/shared/CallButton";
import { formatCurrency } from "@/lib/format";
import { NEXT_STATUS_ACTIONS, canStaffCancel } from "@/lib/order-transitions";
import type { AdminOrderDetail } from "@/types";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AdminOrderDetailClient({
  order,
  whatsAppUrl,
  whatsAppMessage,
  customerPhoneDisplay,
}: {
  order: AdminOrderDetail;
  whatsAppUrl: string | null;
  whatsAppMessage: string;
  customerPhoneDisplay: string | null;
}) {
  const router = useRouter();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingPayment, setIsUpdatingPayment] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const nextActions = NEXT_STATUS_ACTIONS[order.status];
  const canCancel = canStaffCancel(order.status);
  // "After the admin changes an order from pending to confirmed"
  // (requirement C) — shown for confirmed and every status after it,
  // not just the instant of the transition, so staff can still open it
  // later. Never shown for pending (not confirmed yet) or cancelled
  // (nothing to confirm).
  const showWhatsAppConfirmation = order.status !== "pending" && order.status !== "cancelled";

  async function advanceStatus(status: string) {
    setIsUpdatingStatus(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionError(data.message ?? "Couldn't update the order status.");
        return;
      }
      router.refresh();
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function updatePayment(paymentStatus: "collected" | "refused") {
    setIsUpdatingPayment(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus }),
      });
      if (!response.ok) {
        setActionError("Couldn't update the payment status.");
        return;
      }
      router.refresh();
    } finally {
      setIsUpdatingPayment(false);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionError(data.message ?? "Couldn't cancel this order.");
        return;
      }
      router.refresh();
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">{order.orderNumber}</h1>
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
            <Link href={`/admin/orders/${order.id}/bill`} className="text-sm font-medium text-primary hover:underline">
              View Bill
            </Link>
          </div>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Customer</h2>
            <p className="mt-2 text-sm text-foreground">{order.customerName}</p>
            <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
          </section>

          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
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
              Prices are locked from when this order was placed — editing products/categories elsewhere
              never changes this. There is no price-adjustment action on this page by design.
            </p>
          </section>

          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Delivery address</h2>
            <p className="mt-2 text-sm text-foreground">{order.deliveryAddressLine}</p>
            {order.deliveryLandmark && <p className="text-sm text-muted-foreground">Near {order.deliveryLandmark}</p>}
            {order.deliveryInstructions && (
              <p className="mt-1 text-sm text-muted-foreground">Note: {order.deliveryInstructions}</p>
            )}
            <div className="mt-3">
              <OrderLocationMap latitude={order.deliveryLatitude} longitude={order.deliveryLongitude} />
            </div>
          </section>

          <section className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-foreground">Status timeline</h2>
            <ol className="mt-3 flex flex-col gap-3">
              {order.statusHistory.map((event) => (
                <li key={event.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-foreground">{event.toStatus.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(event.createdAt)}
                      {event.staffName ? ` — ${event.staffName}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
            <h2 className="text-sm font-semibold text-foreground">Order status</h2>
            <div className="mt-3 flex flex-col gap-2">
              {nextActions.map((action) => (
                <Button
                  key={action.status}
                  isLoading={isUpdatingStatus}
                  onClick={() => advanceStatus(action.status)}
                >
                  {action.label}
                </Button>
              ))}
              {canCancel && !showCancelForm && (
                <Button variant="outline" onClick={() => setShowCancelForm(true)}>
                  Cancel order
                </Button>
              )}
              {nextActions.length === 0 && !canCancel && (
                <p className="text-sm text-muted-foreground">No further status changes are possible.</p>
              )}
              <CallButton
                phone={order.customerPhone}
                label={`Call ${order.customerName.split(" ")[0]}`}
                variant="outline"
              />
            </div>

            {showCancelForm && (
              <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                <label htmlFor="staff-cancel-reason" className="text-sm font-medium text-foreground">
                  Reason
                </label>
                <textarea
                  id="staff-cancel-reason"
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  rows={2}
                  className="rounded-[var(--radius-control)] border border-border bg-surface px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-offset-1 focus:outline-primary"
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" isLoading={isCancelling} onClick={handleCancel}>
                    Confirm cancel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)}>
                    Never mind
                  </Button>
                </div>
              </div>
            )}
          </section>

          {showWhatsAppConfirmation && (
            <section className="rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
              <h2 className="text-sm font-semibold text-foreground">WhatsApp confirmation</h2>
              <div className="mt-3">
                <WhatsAppConfirmationButton
                  orderId={order.id}
                  whatsAppUrl={whatsAppUrl}
                  message={whatsAppMessage}
                  phoneDisplay={customerPhoneDisplay}
                />
              </div>
            </section>
          )}

          <section className="rounded-[var(--radius-card)] border border-border bg-surface-muted p-4">
            <h2 className="text-sm font-semibold text-foreground">COD payment</h2>
            <div className="mt-2">
              <Badge tone={order.paymentStatus === "collected" ? "success" : order.paymentStatus === "refused" ? "danger" : "neutral"}>
                {order.paymentStatus === "collected"
                  ? "Collected"
                  : order.paymentStatus === "refused"
                    ? "Refused"
                    : "Pending"}
              </Badge>
            </div>
            {order.paymentUpdatedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last updated {formatDateTime(order.paymentUpdatedAt)}
                {order.paymentUpdatedByName ? ` — ${order.paymentUpdatedByName}` : ""}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              This is separate from delivery status — recording collection doesn&apos;t mark the order
              delivered, and marking it delivered doesn&apos;t record collection.
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                isLoading={isUpdatingPayment}
                disabled={order.paymentStatus === "collected"}
                onClick={() => updatePayment("collected")}
              >
                Mark COD collected
              </Button>
              <Button
                size="sm"
                variant="outline"
                isLoading={isUpdatingPayment}
                disabled={order.paymentStatus === "refused"}
                onClick={() => updatePayment("refused")}
              >
                Mark refused
              </Button>
            </div>
          </section>

          {order.status === "cancelled" && order.cancelledReason && (
            <InfoBanner tone="warning">Cancelled: {order.cancelledReason}</InfoBanner>
          )}
          {actionError && <InfoBanner tone="warning">{actionError}</InfoBanner>}
        </aside>
      </div>
    </div>
  );
}
