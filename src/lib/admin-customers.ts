import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapAddressRow,
  mapAdminCustomerListRow,
  type AdminCustomerListRow,
  type CustomerAddressRow,
} from "@/lib/supabase/mappers";
import type { AdminCustomerDetail, AdminCustomerListItem, AdminOrderListItem, OrderStatus, PaymentStatus } from "@/types";

// All-time customer directory (requirement 2) — one aggregate RPC call,
// not a query per customer. Date-ranged reporting lives separately in
// src/lib/reports.ts's getCustomerWiseReport(); this is the live
// directory, always "since the beginning".
export async function getAdminCustomerList(query: string | null): Promise<AdminCustomerListItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("admin_list_customers", { p_query: query });

  if (error) {
    console.error("admin_list_customers:", error);
    return [];
  }

  return ((data ?? []) as AdminCustomerListRow[]).map(mapAdminCustomerListRow);
}

// Profile + saved addresses + order history for one customer, for the
// customer detail page (requirement 2: "view saved delivery addresses",
// "view order history and bills"). Both customer_addresses and orders
// already grant staff SELECT via is_staff() RLS policies (Phase 2/3), so
// this isn't exposing anything new — it's just assembled in one place
// for the page.
export async function getAdminCustomerDetail(customerId: string): Promise<AdminCustomerDetail | null> {
  const supabase = getSupabaseAdmin();

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("id, full_name, phone, email, created_at, pin_reset_required")
    .eq("id", customerId)
    .maybeSingle();

  if (!profile) return null;

  const [{ data: addressRows }, { data: orderRows }] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, address_line, landmark, delivery_instructions, latitude, longitude, is_default")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false }),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_status, total, created_at")
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // Orders are listed here with this customer's own (current)
  // name/phone, not a per-order join — there is nothing on the orders
  // table that snapshots a different value, so a join would just repeat
  // the same profile row we already have.
  const orders: AdminOrderListItem[] = (orderRows ?? []).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status as OrderStatus,
    paymentStatus: row.payment_status as PaymentStatus,
    total: Number(row.total),
    createdAt: row.created_at,
    customerName: profile.full_name,
    customerPhone: profile.phone,
  }));

  return {
    id: profile.id,
    fullName: profile.full_name,
    phone: profile.phone,
    email: profile.email,
    createdAt: profile.created_at,
    pinResetRequired: profile.pin_reset_required,
    addresses: (addressRows ?? []).map((row) => mapAddressRow(row as CustomerAddressRow)),
    orders,
  };
}
