import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getShopSettings } from "@/lib/shop-settings";
import { mapOrderItemRow, type OrderItemRow } from "@/lib/supabase/mappers";
import type { BillData, OrderStatus, PaymentStatus } from "@/types";

type BillOrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  delivery_fee: number | string;
  tax_amount: number | string;
  total: number | string;
  delivery_address_line: string;
  delivery_landmark: string | null;
  delivery_instructions: string | null;
  cancelled_reason: string | null;
  created_at: string;
  customer_id: string;
};

function toNumber(value: number | string): number {
  return typeof value === "string" ? parseFloat(value) : value;
}

async function buildBillData(orderRow: BillOrderRow): Promise<BillData> {
  const supabase = getSupabaseAdmin();

  const [{ data: customerRow }, { data: itemRows }, shop] = await Promise.all([
    supabase.from("customer_profiles").select("full_name, phone").eq("id", orderRow.customer_id).maybeSingle(),
    supabase
      .from("order_items")
      .select("id, product_id, product_name_snapshot, product_price_snapshot, quantity, line_total")
      .eq("order_id", orderRow.id),
    getShopSettings(),
  ]);

  const taxAmount = toNumber(orderRow.tax_amount);

  return {
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    createdAt: orderRow.created_at,
    status: orderRow.status as OrderStatus,
    cancelledReason: orderRow.cancelled_reason,
    // Tax-invoice-ness is driven by what's actually on THIS order
    // (tax_amount > 0 — frozen at order-creation time), not just whether
    // tax is currently configured — an order placed before tax was set
    // up stays a plain receipt forever, matching "preserve the original
    // bill details" (requirement B.7 / E.5).
    isTaxInvoice: Boolean(shop.gstin) && taxAmount > 0,
    shopName: shop.shopName,
    shopAddress: shop.shopAddress,
    shopPhone: shop.shopPhone,
    gstin: shop.gstin,
    customerName: customerRow?.full_name ?? "Unknown",
    customerPhone: customerRow?.phone ?? "",
    deliveryAddressLine: orderRow.delivery_address_line,
    deliveryLandmark: orderRow.delivery_landmark,
    deliveryInstructions: orderRow.delivery_instructions,
    items: ((itemRows ?? []) as OrderItemRow[]).map(mapOrderItemRow),
    subtotal: toNumber(orderRow.subtotal),
    deliveryFee: toNumber(orderRow.delivery_fee),
    taxAmount,
    taxRatePercent: shop.taxRatePercent,
    total: toNumber(orderRow.total),
    paymentMethod: "cod",
    paymentStatus: orderRow.payment_status as PaymentStatus,
  };
}

const BILL_ORDER_COLUMNS =
  "id, order_number, status, payment_status, subtotal, delivery_fee, tax_amount, total, delivery_address_line, delivery_landmark, delivery_instructions, cancelled_reason, created_at, customer_id";

// Customer path: scoped explicitly to customerId, same pattern as every
// other customer-facing query in this project (requirement E.1/E.2/F —
// "ensure customers can view only their own bills").
export async function getCustomerBillData(orderId: string, customerId: string): Promise<BillData | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("orders")
    .select(BILL_ORDER_COLUMNS)
    .eq("id", orderId)
    .eq("customer_id", customerId)
    .maybeSingle();

  if (!data) return null;
  return buildBillData(data as BillOrderRow);
}

// Admin path: no customer_id filter — authorization is the caller's job
// (the admin dashboard layout's is_staff() gate), same as every other
// admin query in this project.
export async function getAdminBillData(orderId: string): Promise<BillData | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("orders").select(BILL_ORDER_COLUMNS).eq("id", orderId).maybeSingle();

  if (!data) return null;
  return buildBillData(data as BillOrderRow);
}
