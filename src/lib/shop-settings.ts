import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { mapShopSettingsRow, type ShopSettingsRow } from "@/lib/supabase/mappers";
import type { ShopSettings } from "@/types";

const DEFAULT_SETTINGS: ShopSettings = {
  shopName: "Kumaran Mess",
  shopAddress: null,
  // Falls back to the phase's specified default contact number even if
  // the shop_settings query itself fails (e.g. pre-migration) — the
  // customer-facing "Call Kumaran Mess" button should still work rather
  // than silently disappearing before an admin has configured anything.
  shopPhone: "+919344689836",
  whatsappNumber: null,
  gstin: null,
  taxRatePercent: null,
  estimatedDeliveryMinutes: null,
  deliveryFee: 0,
  minOrderAmount: 0,
  serviceRadiusKm: null,
  baseLatitude: null,
  baseLongitude: null,
  customerCancellableStatuses: [],
};

const SHOP_SETTINGS_COLUMNS =
  "shop_name, shop_address, shop_phone, whatsapp_number, gstin, tax_rate_percent, estimated_delivery_minutes, delivery_fee, min_order_amount, service_radius_km, base_latitude, base_longitude, customer_cancellable_statuses";

// Single source of truth for the shop_settings column list and fallback —
// every page/route that needs these settings goes through this instead
// of repeating the select string (which happened to drift once already,
// in Phase 10, prompting this consolidation).
export async function getShopSettings(): Promise<ShopSettings> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from("shop_settings").select(SHOP_SETTINGS_COLUMNS).limit(1).maybeSingle();

  return data ? mapShopSettingsRow(data as ShopSettingsRow) : DEFAULT_SETTINGS;
}
