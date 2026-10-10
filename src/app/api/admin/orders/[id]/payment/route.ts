import { NextResponse } from "next/server";
import { getStaffContext, getStaffSupabaseServerClient } from "@/lib/supabase/staff";

const VALID_PAYMENT_STATUSES = ["collected", "refused", "pending"];

// Deliberately separate from the status route: "COD collection and
// delivery status remain distinct" is both a UI and a schema property —
// this only ever touches payment_status/payment_updated_at/
// payment_updated_by, never `status`, and vice versa for the status route.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const paymentStatus = typeof body?.paymentStatus === "string" ? body.paymentStatus : "";

  if (!VALID_PAYMENT_STATUSES.includes(paymentStatus)) {
    return NextResponse.json({ error: "invalid_payment_status" }, { status: 400 });
  }

  const supabase = await getStaffSupabaseServerClient();
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: paymentStatus,
      payment_updated_at: new Date().toISOString(),
      payment_updated_by: staff.userId,
    })
    .eq("id", id);

  if (error) {
    console.error("admin/orders/[id]/payment PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
