import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCustomerSession } from "@/lib/customer-session";

export async function GET() {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ customer: null });
  }

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("customer_profiles")
    .select("id, full_name, phone")
    .eq("id", session.customerId)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ customer: null });
  }

  return NextResponse.json({ customer: { id: data.id, fullName: data.full_name, phone: data.phone } });
}
