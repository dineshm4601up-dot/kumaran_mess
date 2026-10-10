import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCustomerOrderDetail } from "@/lib/orders";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  const supabase = getSupabaseAdmin();

  // customer_id comes only from the verified session — the RPC itself
  // re-checks ownership again regardless (defense in depth: even if this
  // route had a bug, the function alone still can't be tricked into
  // cancelling someone else's order).
  const { error } = await supabase.rpc("cancel_my_order", {
    p_customer_id: session.customerId,
    p_order_id: id,
    p_reason: reason,
  });

  if (error) {
    if (error.message === "order_not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (error.message === "cancellation_not_allowed") {
      return NextResponse.json(
        { error: "cancellation_not_allowed", message: "This order can no longer be cancelled." },
        { status: 400 },
      );
    }
    console.error("orders/[id]/cancel:", error);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  const order = await getCustomerOrderDetail(id, session.customerId);
  return NextResponse.json({ ok: true, order });
}
