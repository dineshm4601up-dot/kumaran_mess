import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/customer-session";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isValidPin } from "@/lib/validation/phone";

// The customer's own forced PIN change after an admin-assisted reset
// (requirement 3, step 7). p_customer_id comes from the verified session
// cookie, never from the request body — a logged-in customer can only
// ever change their own PIN through this route.
export async function POST(request: Request) {
  const session = await getCustomerSession();
  if (!session) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const currentPin = typeof body?.currentPin === "string" ? body.currentPin : "";
  const newPin = typeof body?.newPin === "string" ? body.newPin : "";
  const confirmPin = typeof body?.confirmPin === "string" ? body.confirmPin : "";

  if (!isValidPin(currentPin) || !isValidPin(newPin) || newPin !== confirmPin) {
    return NextResponse.json({ error: "invalid_pin" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("change_own_customer_pin", {
    p_customer_id: session.customerId,
    p_current_pin: currentPin,
    p_new_pin: newPin,
  });

  if (error) {
    console.error("auth/change-pin POST:", error);
    return NextResponse.json({ error: "change_failed" }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result?.locked_until && new Date(result.locked_until).getTime() > Date.now()) {
    return NextResponse.json({ error: "locked", lockedUntil: result.locked_until }, { status: 429 });
  }

  if (!result?.success) {
    return NextResponse.json({ error: "incorrect_current_pin" }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
