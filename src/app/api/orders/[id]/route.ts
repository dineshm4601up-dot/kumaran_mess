import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getCustomerOrderDetail } from "@/lib/orders";

// Used by the order-detail page's polling refresh (see Phase 6 notes on
// why polling rather than a realtime subscription — customers don't hold
// a real Supabase session for RLS-gated Realtime to key off).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const order = await getCustomerOrderDetail(id, session.customerId);

  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
