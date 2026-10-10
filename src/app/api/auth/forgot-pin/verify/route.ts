import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCustomerSession } from "@/lib/customer-session";
import { isValidOtp, isValidPin, normalizeIndianMobile } from "@/lib/validation/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizeIndianMobile(typeof body?.phone === "string" ? body.phone : "");
  const otp = typeof body?.otp === "string" ? body.otp : "";
  const newPin = typeof body?.newPin === "string" ? body.newPin : "";
  const confirmPin = typeof body?.confirmPin === "string" ? body.confirmPin : "";

  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  if (!isValidOtp(otp)) return NextResponse.json({ error: "invalid_otp_format" }, { status: 400 });
  if (!isValidPin(newPin) || newPin !== confirmPin) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: otpValid, error: otpError } = await supabase.rpc("verify_phone_otp", {
    p_phone: phone,
    p_purpose: "login_recovery",
    p_otp: otp,
  });

  if (otpError || !otpValid) {
    return NextResponse.json({ error: "invalid_otp" }, { status: 400 });
  }

  const { data: updated, error: pinError } = await supabase.rpc("set_customer_pin_for_user", {
    p_phone: phone,
    p_new_pin: newPin,
  });

  if (pinError || !updated) {
    console.error("forgot-pin/verify: set_customer_pin_for_user failed", pinError);
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  }

  await createCustomerSession(updated.id);

  return NextResponse.json({ ok: true });
}
