import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  mapAddressRow,
  mapShopSettingsRow,
  type CustomerAddressRow,
  type ShopSettingsRow,
} from "@/lib/supabase/mappers";
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
  const [{ data: addressRow }, { data: settingsRow }] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, address_line, landmark, delivery_instructions, latitude, longitude, is_default")
      .eq("customer_id", session.customerId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("shop_settings")
      .select(
        "delivery_fee, min_order_amount, service_radius_km, base_latitude, base_longitude, customer_cancellable_statuses",
      )
      .limit(1)
      .maybeSingle(),
  ]);

  const address = addressRow ? mapAddressRow(addressRow as CustomerAddressRow) : null;
  const settings = settingsRow
    ? mapShopSettingsRow(settingsRow as ShopSettingsRow)
    : {
        deliveryFee: 0,
        minOrderAmount: 0,
        serviceRadiusKm: null,
        baseLatitude: null,
        baseLongitude: null,
        customerCancellableStatuses: [],
      };

  return <CheckoutClient initialAddress={address} settings={settings} />;
}
