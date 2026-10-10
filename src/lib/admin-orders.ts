import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapAdminOrderDetail,
  type AdminOrderDetailRow,
  type OrderItemRow,
  type OrderStatusHistoryRow,
} from "@/lib/supabase/mappers";
import type { AdminOrderDetail } from "@/types";

export async function getAdminOrderDetail(orderId: string): Promise<AdminOrderDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: orderRow } = await supabase
    .from("orders")
    .select(
      "id, order_number, status, payment_status, subtotal, delivery_fee, total, delivery_address_line, delivery_landmark, delivery_latitude, delivery_longitude, delivery_instructions, cancelled_reason, created_at, customer_id, payment_updated_at, payment_updated_by",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRow) return null;

  const [{ data: customerRow }, { data: itemRows }, { data: historyRows }] = await Promise.all([
    supabase.from("customer_profiles").select("full_name, phone").eq("id", orderRow.customer_id).maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_id, product_name_snapshot, product_price_snapshot, quantity, line_total")
      .eq("order_id", orderId),
    supabase
      .from("order_status_history")
      .select("id, from_status, to_status, note, created_at, changed_by")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
  ]);

  // Resolve the handful of staff ids referenced (changed_by on history
  // rows, payment_updated_by on the order itself) to names in one extra
  // query, rather than one query per row.
  const staffIds = Array.from(
    new Set(
      [
        ...((historyRows ?? []) as { changed_by: string | null }[]).map((row) => row.changed_by),
        orderRow.payment_updated_by,
      ].filter((id): id is string => Boolean(id)),
    ),
  );

  const staffNameById = new Map<string, string>();
  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff_users")
      .select("id, full_name")
      .in("id", staffIds);
    for (const staff of staffRows ?? []) {
      staffNameById.set(staff.id, staff.full_name);
    }
  }

  const historyWithNames = ((historyRows ?? []) as (OrderStatusHistoryRow & { changed_by: string | null })[]).map(
    (row) => ({ ...row, staff_name: row.changed_by ? staffNameById.get(row.changed_by) ?? null : null }),
  );

  return mapAdminOrderDetail(
    orderRow as AdminOrderDetailRow,
    customerRow ?? { full_name: "Unknown", phone: "" },
    (itemRows ?? []) as OrderItemRow[],
    historyWithNames,
    orderRow.payment_updated_by ? staffNameById.get(orderRow.payment_updated_by) ?? null : null,
  );
}
