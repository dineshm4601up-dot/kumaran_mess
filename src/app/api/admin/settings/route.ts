import { NextResponse } from "next/server";
import { getStaffContext } from "@/lib/supabase/staff";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: Request) {
  const staff = await getStaffContext();
  if (!staff) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const deliveryFee = Number(body?.deliveryFee);
  const minOrderAmount = Number(body?.minOrderAmount);
  const hasRadius = body?.serviceRadiusKm !== null && body?.serviceRadiusKm !== "" && body?.serviceRadiusKm !== undefined;
  const serviceRadiusKm = hasRadius ? Number(body.serviceRadiusKm) : null;
  const hasBase = body?.baseLatitude !== null && body?.baseLatitude !== "" && body?.baseLatitude !== undefined;
  const baseLatitude = hasBase ? Number(body.baseLatitude) : null;
  const baseLongitude = hasBase ? Number(body.baseLongitude) : null;

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
