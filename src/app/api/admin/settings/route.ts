import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { normalizeIndianMobile } from "@/lib/validation/phone";

export async function PATCH(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const shopName = typeof body?.shopName === "string" ? body.shopName.trim() : "";
  const shopAddress = typeof body?.shopAddress === "string" && body.shopAddress.trim() ? body.shopAddress.trim() : null;
  const rawShopPhone = typeof body?.shopPhone === "string" && body.shopPhone.trim() ? body.shopPhone.trim() : null;
  const rawWhatsappNumber =
    typeof body?.whatsappNumber === "string" && body.whatsappNumber.trim() ? body.whatsappNumber.trim() : null;
  const gstin = typeof body?.gstin === "string" && body.gstin.trim() ? body.gstin.trim().toUpperCase() : null;
  const hasTaxRate = body?.taxRatePercent !== null && body?.taxRatePercent !== "" && body?.taxRatePercent !== undefined;
  const taxRatePercent = hasTaxRate ? Number(body.taxRatePercent) : null;
  const hasEstimate =
    body?.estimatedDeliveryMinutes !== null &&
    body?.estimatedDeliveryMinutes !== "" &&
    body?.estimatedDeliveryMinutes !== undefined;
  const estimatedDeliveryMinutes = hasEstimate ? Math.trunc(Number(body.estimatedDeliveryMinutes)) : null;
  const deliveryFee = Number(body?.deliveryFee);
  const minOrderAmount = Number(body?.minOrderAmount);
  const hasRadius = body?.serviceRadiusKm !== null && body?.serviceRadiusKm !== "" && body?.serviceRadiusKm !== undefined;
  const serviceRadiusKm = hasRadius ? Number(body.serviceRadiusKm) : null;
  const hasBase = body?.baseLatitude !== null && body?.baseLatitude !== "" && body?.baseLatitude !== undefined;
  const baseLatitude = hasBase ? Number(body.baseLatitude) : null;
  const baseLongitude = hasBase ? Number(body.baseLongitude) : null;

  // Normalised to E.164 the same way customer_profiles.phone is
  // (requirement 6: "validate phone numbers and normalise them
  // appropriately") — an unrecognisable number is rejected rather than
  // silently saved as-is, since the customer header's Call button and
  // the WhatsApp link both depend on this being in the shape
  // buildTelLink()/toWhatsAppPhoneDigits() expect.
  const shopPhone = rawShopPhone ? normalizeIndianMobile(rawShopPhone) : null;
  if (rawShopPhone && !shopPhone) {
    return NextResponse.json({ error: "invalid_shop_phone" }, { status: 400 });
  }
  const whatsappNumber = rawWhatsappNumber ? normalizeIndianMobile(rawWhatsappNumber) : null;
  if (rawWhatsappNumber && !whatsappNumber) {
    return NextResponse.json({ error: "invalid_whatsapp_number" }, { status: 400 });
  }

  if (!shopName) {
    return NextResponse.json({ error: "shop_name_required" }, { status: 400 });
  }
  if (taxRatePercent !== null && (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100)) {
    return NextResponse.json({ error: "invalid_tax_rate" }, { status: 400 });
  }
  if (estimatedDeliveryMinutes !== null && (!Number.isFinite(estimatedDeliveryMinutes) || estimatedDeliveryMinutes <= 0)) {
    return NextResponse.json({ error: "invalid_estimate" }, { status: 400 });
  }
  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    return NextResponse.json({ error: "invalid_delivery_fee" }, { status: 400 });
  }
  if (!Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
    return NextResponse.json({ error: "invalid_min_order" }, { status: 400 });
  }
  if (serviceRadiusKm !== null && (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0)) {
    return NextResponse.json({ error: "invalid_radius" }, { status: 400 });
  }

  const allowedCancellableStatuses = ["pending", "confirmed", "preparing", "ready"];
  const requestedStatuses = Array.isArray(body?.customerCancellableStatuses)
    ? (body.customerCancellableStatuses as unknown[]).filter((value): value is string => typeof value === "string")
    : [];
  const customerCancellableStatuses = requestedStatuses.filter((status) =>
    allowedCancellableStatuses.includes(status),
  );

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("shop_settings")
    .update({
      shop_name: shopName,
      shop_address: shopAddress,
      shop_phone: shopPhone,
      whatsapp_number: whatsappNumber,
      gstin,
      tax_rate_percent: taxRatePercent,
      estimated_delivery_minutes: estimatedDeliveryMinutes,
      delivery_fee: deliveryFee,
      min_order_amount: minOrderAmount,
      service_radius_km: serviceRadiusKm,
      base_latitude: baseLatitude,
      base_longitude: baseLongitude,
      customer_cancellable_statuses: customerCancellableStatuses,
    })
    .eq("id", true);

  if (error) {
    console.error("admin/settings PATCH:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
