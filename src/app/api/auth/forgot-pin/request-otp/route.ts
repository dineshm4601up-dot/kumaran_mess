import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { sendSms } from "@/lib/sms/send-sms";
import { normalizeIndianMobile } from "@/lib/validation/phone";

const GENERIC_MESSAGE = "If that mobile number is registered, a verification code has been sent.";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizeIndianMobile(typeof body?.phone === "string" ? body.phone : "");

  // Always the same response, regardless of what happens below — this
  // endpoint must not reveal whether a phone number is registered, so a
  // bad/unregistered input looks identical to a successful send.
  if (!phone) {
    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("customer_profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    const { data: otp, error } = await supabase.rpc("request_phone_otp", {
      p_phone: phone,
      p_purpose: "login_recovery",
    });

    if (!error && otp) {
      const smsResult = await sendSms(
        phone,
        `Your Kumaran Mess PIN reset code is ${otp}. It expires in 10 minutes.`,
      );
      if (!smsResult.ok) {
        console.error("forgot-pin/request-otp: sendSms failed", smsResult.error);
      }
    } else if (error) {
      // otp_cooldown / otp_rate_limited / etc. — logged, never surfaced.
      console.warn("forgot-pin/request-otp:", error.message);
    }
  }

  return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
}
