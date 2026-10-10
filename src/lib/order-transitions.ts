import type { OrderStatus } from "@/types";

// Mirrors enforce_order_status_transition() in the database — this is
// only used to decide which action buttons to show; the trigger is the
// actual enforcement, so a mismatch here fails safe (the button would
// just produce a rejected request, never an illegal write).
export const NEXT_STATUS_ACTIONS: Record<OrderStatus, { status: OrderStatus; label: string }[]> = {
  pending: [{ status: "confirmed", label: "Confirm order" }],
  confirmed: [{ status: "preparing", label: "Mark preparing" }],
  preparing: [{ status: "ready", label: "Mark ready" }],
  ready: [{ status: "out_for_delivery", label: "Mark out for delivery" }],
  out_for_delivery: [{ status: "delivered", label: "Mark delivered" }],
  delivered: [],
  cancelled: [],
};

// Staff may cancel from any non-terminal status — broader than the
// customer self-cancel cutoff in shop_settings.customer_cancellable_statuses,
// which only governs customer-initiated cancellation.
export const STAFF_CANCELLABLE_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
];

export function canStaffCancel(status: OrderStatus): boolean {
  return STAFF_CANCELLABLE_STATUSES.includes(status);
}
