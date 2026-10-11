import "server-only";
import { formatCurrency } from "@/lib/format";
import type { AdminOrderDetail, ShopSettings } from "@/types";

// Builds the confirmation message text entirely server-side from
// authoritative order data (never client-supplied prices/totals —
// requirement C.5). This is pure text generation, independent of how it
// gets sent — manual click-to-chat today, potentially the official
// WhatsApp Business Platform API later (see src/lib/whatsapp/README or
// the Phase 10 architecture notes in PROJECT_PROGRESS.md). Nothing here
// knows or cares which transport will eventually carry it.
export function buildOrderConfirmationMessage(order: AdminOrderDetail, shop: ShopSettings): string {
  const lines: string[] = [];

  lines.push(`*${shop.shopName}*`);
  lines.push(`Order ${order.orderNumber} — Confirmed`);
  lines.push("");
  lines.push("Items:");
  for (const item of order.items) {
    lines.push(`- ${item.productName} x${item.quantity}`);
  }
  lines.push("");
  lines.push(`Subtotal: ${formatCurrency(order.subtotal)}`);
  lines.push(`Delivery: ${formatCurrency(order.deliveryFee)}`);
  lines.push(`Total: ${formatCurrency(order.total)}`);
  lines.push("Payment: Cash on Delivery");
  lines.push("");
  lines.push(`Delivering to: ${order.deliveryAddressLine}`);
  if (order.deliveryLandmark) {
    lines.push(`Landmark: ${order.deliveryLandmark}`);
  }

  // Only included when actually configured (requirement C.4's "only if
  // actually configured") — never a made-up estimate.
  if (shop.estimatedDeliveryMinutes) {
    lines.push("");
    lines.push(`Estimated delivery: ~${shop.estimatedDeliveryMinutes} minutes`);
  }

  lines.push("");
  lines.push("Thank you for your order!");

  return lines.join("\n");
}

// Admin-assisted PIN reset message (requirement 3, step 9 / requirement
// 7). Built server-side from the staff-entered temporary PIN, the same
// click-to-chat-only principle as buildOrderConfirmationMessage() above:
// this is plain text generation, never an automatic send. The admin
// still has to review it and tap Send inside WhatsApp themselves — see
// ResetPinDialog.tsx, which opens this via the same wa.me mechanism as
// the order-confirmation flow and never calls any send API.
export function buildPinResetMessage(customerName: string, shopName: string, temporaryPin: string): string {
  const lines: string[] = [];

  lines.push(`*${shopName}*`);
  lines.push(`Hi ${customerName}, your account PIN has been reset by our team.`);
  lines.push("");
  lines.push(`Your temporary PIN: *${temporaryPin}*`);
  lines.push("");
  lines.push("Please log in with this PIN and you'll be asked to set your own new 4-digit PIN right away.");
  lines.push("If you didn't request this, please contact us.");

  return lines.join("\n");
}
