import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const ERROR_MESSAGES: Record<string, string> = {
  no_items: "Your cart is empty.",
  address_not_found: "Choose a delivery address first.",
  address_location_required: "Please set your delivery location on the map — this address needs a pinned location to confirm it's within our delivery area.",
  outside_service_area: "Sorry, that address is outside our delivery area.",
  invalid_item: "One of the items in your cart is invalid. Please refresh your cart.",
  item_unavailable: "One or more items in your cart are no longer available in the quantity requested. Please review your cart.",
  below_minimum_order: "Your order is below the minimum order amount.",
};

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const addressId = typeof body?.addressId === "string" ? body.addressId : null;
  const idempotencyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey : null;
  const deliveryInstructions =
    typeof body?.deliveryInstructions === "string" && body.deliveryInstructions.trim()
      ? body.deliveryInstructions.trim()
      : null;
  const items = Array.isArray(body?.items)
    ? (body.items as unknown[])
        .filter(
          (item: unknown): item is { productId: string; quantity: number } =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as Record<string, unknown>).productId === "string" &&
            typeof (item as Record<string, unknown>).quantity === "number",
        )
        .map((item) => ({ product_id: item.productId, quantity: item.quantity }))
    : [];

  if (!addressId) {
    return NextResponse.json({ error: "address_not_found" }, { status: 400 });
  }
  if (items.length === 0) {
    return NextResponse.json({ error: "no_items" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // customer_id comes only from the verified session above — never from
  // the request body, so there is no way to place an order as someone
  // else. Price/subtotal/total are never accepted here at all; the RPC
  // computes them entirely server-side.
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_id: session.customerId,
    p_address_id: addressId,
    p_items: items,
    p_idempotency_key: idempotencyKey,
    p_delivery_instructions: deliveryInstructions,
  });

  if (error) {
    const code = error.message as string;
    if (ERROR_MESSAGES[code]) {
      return NextResponse.json({ error: code, message: ERROR_MESSAGES[code] }, { status: 400 });
    }
    console.error("checkout/place-order:", error);
    return NextResponse.json({ error: "order_failed", message: "Something went wrong placing your order." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, order: { id: data.id, orderNumber: data.order_number, total: data.total } });
}
