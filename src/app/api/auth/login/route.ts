import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createCustomerSession } from "@/lib/customer-session";
import { isValidPin, normalizeIndianMobile } from "@/lib/validation/phone";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const phone = normalizeIndianMobile(typeof body?.phone === "string" ? body.phone : "");
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!phone || !isValidPin(pin)) {
    // Same generic response as a wrong PIN below — never reveal which
    // part of the input was the problem.
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("verify_customer_pin", { p_phone: phone, p_pin: pin });

  if (error) {
    console.error("login: verify_customer_pin failed", error);
    return NextResponse.json({ error: "login_failed" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result?.locked_until && new Date(result.locked_until).getTime() > Date.now()) {
    return NextResponse.json(
      { error: "locked", lockedUntil: result.locked_until },
      { status: 429 },
    );
  }

  if (!result?.success || !result.customer_id) {
    // Deliberately omit attempts_remaining: it's non-null for a real
    // account and null for a nonexistent one, which would let a caller
    // hitting this API directly (bypassing the UI, which never shows this
    // anyway) distinguish "wrong PIN" from "no such account" — a minor
    // account-enumeration leak caught by testing this live. Both cases now
    // return byte-for-byte identical JSON.
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  await createCustomerSession(result.customer_id);

  return NextResponse.json({ ok: true });
}
