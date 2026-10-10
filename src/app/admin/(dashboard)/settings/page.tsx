import type { Metadata } from "next";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapShopSettingsRow, type ShopSettingsRow } from "@/lib/supabase/mappers";
import { ShopSettingsForm } from "@/components/admin/ShopSettingsForm";

export const metadata: Metadata = {
  title: "Shop Settings",
};

export default async function AdminSettingsPage() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("shop_settings")
    .select(
      "delivery_fee, min_order_amount, service_radius_km, base_latitude, base_longitude, customer_cancellable_statuses",
    )
    .limit(1)
    .maybeSingle();

  const settings = data
    ? mapShopSettingsRow(data as ShopSettingsRow)
    : {
        deliveryFee: 0,
        minOrderAmount: 0,
        serviceRadiusKm: null,
        baseLatitude: null,
        baseLongitude: null,
        customerCancellableStatuses: [],
      };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Shop Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Delivery fee and minimum order apply to every checkout. The service radius only applies once
          both it and the store location are set.
        </p>
      </div>
      <ShopSettingsForm settings={settings} />
    </div>
  );
}
