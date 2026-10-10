import { NextResponse } from "next/server";
import { getStaffContext, getStaffSupabaseServerClient } from "@/lib/supabase/staff";

const VALID_STATUSES = ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status : "";

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  // Performed with the staff member's own authenticated session, not the
  // service-role client this project otherwise uses for admin writes —
  // specifically so order_status_history.changed_by (via auth.uid() in
  // the existing trigger) correctly records which staff member made the
  // change. RLS (orders_update_staff, is_staff()) and
  // enforce_order_status_transition() are what actually authorize and
  // validate this, not this route's own check alone.
  const supabase = await getStaffSupabaseServerClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);

  if (error) {
    if (error.message.includes("Illegal order status transition") || error.message.includes("terminal state")) {
      return NextResponse.json({ error: "illegal_transition", message: error.message }, { status: 400 });
    }
    console.error("admin/orders/[id]/status PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
