import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getShopSettings } from "@/lib/shop-settings";
import { mapAddressRow, type CustomerAddressRow } from "@/lib/supabase/mappers";
import { CheckoutClient } from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
};

export default async function CheckoutPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login?next=/checkout");
  }

  const supabase = getSupabaseAdmin();
  const [{ data: addressRow }, settings] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, address_line, landmark, delivery_instructions, latitude, longitude, is_default")
      .eq("customer_id", session.customerId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    getShopSettings(),
  ]);

  const address = addressRow ? mapAddressRow(addressRow as CustomerAddressRow) : null;

  return <CheckoutClient initialAddress={address} settings={settings} />;
}
