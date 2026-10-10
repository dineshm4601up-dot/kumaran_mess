import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseAddressBody } from "@/lib/validation/address";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const { errors, values } = parseAddressBody(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Scoped explicitly to this customer's own session — never trust the
  // URL alone. An id belonging to someone else simply matches zero rows.
  const { data: existing } = await supabase
    .from("customer_addresses")
    .select("id")
    .eq("id", id)
    .eq("customer_id", session.customerId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if ((body as Record<string, unknown> | null)?.isDefault) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", session.customerId);
  }

  const { error } = await supabase
    .from("customer_addresses")
    .update({
      address_line: values.addressLine,
      landmark: values.landmark,
      latitude: values.latitude,
      longitude: values.longitude,
      delivery_instructions: values.deliveryInstructions,
      ...((body as Record<string, unknown> | null)?.isDefault ? { is_default: true } : {}),
    })
    .eq("id", id);

  if (error) {
    console.error("addresses PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
