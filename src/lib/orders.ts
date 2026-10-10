import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapOrderDetail,
  type OrderDetailRow,
  type OrderItemRow,
  type OrderStatusHistoryRow,
} from "@/lib/supabase/mappers";
import type { CustomerOrderDetail } from "@/types";

// Scoped explicitly to customerId on every query — this (not the id being
// a UUID, though it is one) is the actual reason another customer can't
// read this order by guessing or even knowing its id outright.
export async function getCustomerOrderDetail(
  orderId: string,
  customerId: string,
): Promise<CustomerOrderDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: orderRow } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, subtotal, delivery_fee, total, delivery_address_line, delivery_landmark, delivery_instructions, cancelled_reason, created_at",
    )
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!orderRow) return null;

  const [{ data: itemRows }, { data: historyRows }] = await Promise.all([
    supabase
      .from("order_items")
      .select("id, product_id, product_name_snapshot, product_price_snapshot, quantity, line_total")
      .eq("order_id", orderId),
    supabase
      .from("order_status_history")
      .select("id, from_status, to_status, note, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  return mapOrderDetail(
    orderRow as OrderDetailRow,
    (itemRows ?? []) as OrderItemRow[],
    (historyRows ?? []) as OrderStatusHistoryRow[],
  );
}
