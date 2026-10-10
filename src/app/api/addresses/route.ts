import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseAddressBody } from "@/lib/validation/address";

export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { errors, values } = parseAddressBody(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // First address for this customer becomes the default automatically;
  // otherwise this one only becomes default if explicitly requested.
  const { count } = await supabase
    .from("customer_addresses")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", session.customerId);

  const makeDefault = count === 0 || Boolean((body as Record<string, unknown> | null)?.isDefault);

  if (makeDefault) {
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", session.customerId);
  }

  const { data, error } = await supabase
    .from("customer_addresses")
    .insert({
      customer_id: session.customerId,
      address_line: values.addressLine,
      landmark: values.landmark,
      latitude: values.latitude,
      longitude: values.longitude,
      delivery_instructions: values.deliveryInstructions,
      is_default: makeDefault,
    })
    .select("id")
    .single();

  if (error) {
    console.error("addresses POST:", error);
    return NextResponse.json({ error: "create_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id });
}
