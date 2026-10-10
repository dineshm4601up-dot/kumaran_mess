import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCustomerSession } from "@/lib/customer-session";
import { isValidPin, normalizeIndianMobile } from "@/lib/validation/phone";

// No OTP step: registration creates the account directly from the
// submitted details. This is a deliberate choice made after the fact (see
// PROJECT_PROGRESS.md) that drops the "verify mobile ownership via OTP"
// requirement from the original spec — nothing here confirms the caller
// actually controls the phone number they typed in. Known consequence:
// since phone is the unique login identifier, someone could register a
// number they don't own, which both misdirects any future SMS to that
// number and blocks its real owner from ever registering with it.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const phone = normalizeIndianMobile(typeof body?.phone === "string" ? body.phone : "");
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const pin = typeof body?.pin === "string" ? body.pin : "";
  const confirmPin = typeof body?.confirmPin === "string" ? body.confirmPin : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const addressLine = typeof body?.addressLine === "string" ? body.addressLine.trim() : "";
  const landmark = typeof body?.landmark === "string" && body.landmark.trim() ? body.landmark.trim() : null;
  const deliveryInstructions =
    typeof body?.deliveryInstructions === "string" && body.deliveryInstructions.trim()
      ? body.deliveryInstructions.trim()
      : null;

  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  if (!fullName) return NextResponse.json({ error: "full_name_required" }, { status: 400 });
  if (!isValidPin(pin) || pin !== confirmPin) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }
  if (!addressLine) return NextResponse.json({ error: "address_required" }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("customer_profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "already_registered" }, { status: 409 });
  }

  const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
    phone: phone.replace("+", ""),
    phone_confirm: true,
  });

  if (createUserError || !createdUser.user) {
    console.error("register: createUser failed", createUserError);
    return NextResponse.json({ error: "register_failed" }, { status: 500 });
  }

  const userId = createdUser.user.id;

  try {
    const { error: profileError } = await supabase.rpc("register_customer_profile_for_user", {
      p_user_id: userId,
      p_full_name: fullName,
      p_phone: phone,
      p_pin: pin,
      p_email: email,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: addressError } = await supabase.from("customer_addresses").insert({
      customer_id: userId,
      address_line: addressLine,
      landmark,
      delivery_instructions: deliveryInstructions,
      is_default: true,
    });
    if (addressError) throw new Error(addressError.message);
  } catch (err) {
    console.error("register: profile/address creation failed, rolling back auth user", err);
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    return NextResponse.json({ error: "register_failed" }, { status: 500 });
  }

  await createCustomerSession(userId);

  return NextResponse.json({ ok: true, customer: { id: userId, fullName } });
}
