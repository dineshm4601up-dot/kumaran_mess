import { NextResponse } from "next/server";
import { getStaffContext, getStaffSupabaseServerClient } from "@/lib/supabase/staff";

// Staff cancellation is intentionally a separate path from the
// customer's cancel_my_order() RPC: staff may cancel from any
// non-terminal status (enforced by enforce_order_status_transition()),
// not limited by shop_settings.customer_cancellable_statuses, which only
// governs customer self-service. Using the staff's own session (not
// service_role) so the cancellation is attributed in
// order_status_history like any other staff status change.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const reason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "Cancelled by staff";

  const supabase = await getStaffSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_reason: reason })
    .eq("id", id);

  if (error) {
    // Caught live in Phase 9 testing: cancelling an out_for_delivery
    // order hits the trigger's "Illegal order status transition"
    // message, not "terminal state" (it isn't terminal yet at that
    // point) — both mean the same thing to the caller: this order can no
    // longer be cancelled.
    if (error.message.includes("terminal state") || error.message.includes("Illegal order status transition")) {
      return NextResponse.json(
        { error: "already_terminal", message: "This order can no longer be cancelled." },
        { status: 400 },
      );
    }
    console.error("admin/orders/[id]/cancel POST:", error);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
